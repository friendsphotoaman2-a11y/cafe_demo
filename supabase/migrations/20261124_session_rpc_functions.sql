-- ==============================================================================
-- SUPABASE MIGRATION: SECURE SESSION & PIN RPC FUNCTIONS
-- ==============================================================================
-- Functions implemented:
-- 1. generate_table_pin(table_id)        - For Managers (4-hr expiry, closes old open sessions, audit log)
-- 2. join_session(table_code, pin, dev)  - For Anonymous Users (5 wrong attempts = 5 min lock, session_members)
-- 3. close_session(session_id)           - For Managers (closes session, removes members, audit log)
-- 4. regenerate_pin(session_id)          - For Managers (new PIN, refreshes expiry, audit log)
-- 5. auto_close_expired_sessions()       - Cron-style cleanup for sessions where expires_at < now()
-- All functions are SECURITY DEFINER with safe search_path = public, pg_temp
-- ==============================================================================

-- 1. GENERATE TABLE PIN (Manager Only)
CREATE OR REPLACE FUNCTION public.generate_table_pin(
    p_table_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pin TEXT;
    v_session RECORD;
    v_table RECORD;
    v_actor_email TEXT;
BEGIN
    -- Authorization check
    IF NOT public.is_manager() AND auth.role() <> 'service_role' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHORIZED',
            'message', 'Only managers can generate table sessions.'
        );
    END IF;

    -- Verify table exists
    SELECT * INTO v_table FROM public.tables WHERE id = p_table_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TABLE_NOT_FOUND',
            'message', 'Specified table was not found.'
        );
    END IF;

    v_actor_email := COALESCE(auth.jwt() ->> 'email', 'service_role');

    -- Close any existing open session for this table
    UPDATE public.table_sessions
    SET status = 'closed',
        closed_at = now()
    WHERE table_id = p_table_id AND status = 'open';

    -- Generate random 4-digit numeric PIN (1000 - 9999)
    v_pin := LPAD(FLOOR(random() * 9000 + 1000)::TEXT, 4, '0');

    -- Create new open session with 4-hour expiry
    INSERT INTO public.table_sessions (
        table_id,
        pin,
        status,
        session_token,
        opened_at,
        expires_at
    )
    VALUES (
        p_table_id,
        v_pin,
        'open',
        gen_random_uuid(),
        now(),
        now() + INTERVAL '4 hours'
    )
    RETURNING * INTO v_session;

    -- Write to audit log
    INSERT INTO public.audit_log (
        actor_email,
        action,
        entity_type,
        entity_id,
        details
    )
    VALUES (
        v_actor_email,
        'GENERATE_PIN',
        'table_sessions',
        v_session.id::TEXT,
        jsonb_build_object(
            'table_id', p_table_id,
            'table_code', v_table.table_code,
            'pin', v_pin,
            'expires_at', v_session.expires_at
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session.id,
        'table_id', p_table_id,
        'table_code', v_table.table_code,
        'table_name', v_table.table_name,
        'pin', v_pin,
        'session_token', v_session.session_token,
        'opened_at', v_session.opened_at,
        'expires_at', v_session.expires_at
    );
END;
$$;

-- 2. JOIN SESSION (Anonymous Customers)
CREATE OR REPLACE FUNCTION public.join_session(
    p_table_code TEXT,
    p_pin TEXT,
    p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_table RECORD;
    v_session RECORD;
    v_failed_attempts INTEGER;
    v_lock_window_seconds INTEGER := 300; -- 5 minutes
    v_first_failed_time TIMESTAMPTZ;
    v_lock_remaining_seconds INTEGER;
    v_device TEXT;
BEGIN
    v_device := COALESCE(NULLIF(TRIM(p_device_id), ''), 'anon_device');

    -- 1. Find table by code
    SELECT * INTO v_table
    FROM public.tables
    WHERE LOWER(table_code) = LOWER(TRIM(p_table_code));

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_TABLE',
            'message', 'Invalid table code. Please scan the QR code on your table.'
        );
    END IF;

    -- 2. Find currently open session for this table
    SELECT * INTO v_session
    FROM public.table_sessions
    WHERE table_id = v_table.id AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'NO_ACTIVE_SESSION',
            'message', 'This table is currently closed. Please ask the manager to generate a PIN.'
        );
    END IF;

    -- 3. Check if session has expired (>4 hours)
    IF v_session.expires_at IS NOT NULL AND v_session.expires_at < now() THEN
        -- Auto close the expired session
        UPDATE public.table_sessions
        SET status = 'closed', closed_at = now()
        WHERE id = v_session.id;

        DELETE FROM public.session_members WHERE session_id = v_session.id;

        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'SESSION_EXPIRED',
            'message', 'Table session has expired. Please ask the manager for a new PIN.'
        );
    END IF;

    -- 4. Check 5-minute lockout (5 wrong attempts per table and device in last 5 minutes)
    SELECT COUNT(*), MIN(attempted_at)
    INTO v_failed_attempts, v_first_failed_time
    FROM public.pin_attempts
    WHERE table_id = v_table.id
      AND (ip_address = v_device OR v_device = 'anon_device')
      AND is_successful = false
      AND attempted_at >= (now() - INTERVAL '5 minutes');

    IF v_failed_attempts >= 5 THEN
        v_lock_remaining_seconds := GREATEST(0, EXTRACT(EPOCH FROM ((v_first_failed_time + INTERVAL '5 minutes') - now()))::INTEGER);
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TABLE_LOCKED',
            'lock_remaining_seconds', v_lock_remaining_seconds,
            'message', 'Too many wrong attempts. Table is locked for 5 minutes. Please talk to the manager.'
        );
    END IF;

    -- 5. Verify PIN match
    IF v_session.pin = TRIM(p_pin) THEN
        -- Log successful attempt
        INSERT INTO public.pin_attempts (
            table_id,
            session_id,
            attempted_pin,
            ip_address,
            is_successful,
            attempted_at
        )
        VALUES (
            v_table.id,
            v_session.id,
            p_pin,
            v_device,
            true,
            now()
        );

        -- Add device to session_members
        INSERT INTO public.session_members (
            session_id,
            device_id,
            last_seen_at
        )
        VALUES (
            v_session.id,
            v_device,
            now()
        )
        ON CONFLICT (session_id, device_id)
        DO UPDATE SET last_seen_at = now();

        RETURN jsonb_build_object(
            'success', true,
            'session_token', v_session.session_token,
            'session_id', v_session.id,
            'table_id', v_table.id,
            'table_code', v_table.table_code,
            'table_name', v_table.table_name,
            'expires_at', v_session.expires_at
        );
    ELSE
        -- Log failed attempt
        INSERT INTO public.pin_attempts (
            table_id,
            session_id,
            attempted_pin,
            ip_address,
            is_successful,
            attempted_at
        )
        VALUES (
            v_table.id,
            v_session.id,
            p_pin,
            v_device,
            false,
            now()
        );

        v_failed_attempts := v_failed_attempts + 1;

        IF v_failed_attempts >= 5 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'TABLE_LOCKED',
                'lock_remaining_seconds', 300,
                'message', 'Invalid PIN. 5 wrong attempts recorded. Table is locked for 5 minutes.'
            );
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'INVALID_PIN',
                'attempts_left', 5 - v_failed_attempts,
                'message', 'Invalid PIN. Please talk to the manager and get your PIN again.'
            );
        END IF;
    END IF;
END;
$$;

-- 3. CLOSE SESSION (Manager Only)
CREATE OR REPLACE FUNCTION public.close_session(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session RECORD;
    v_actor_email TEXT;
BEGIN
    IF NOT public.is_manager() AND auth.role() <> 'service_role' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHORIZED',
            'message', 'Only managers can close sessions.'
        );
    END IF;

    SELECT * INTO v_session FROM public.table_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'SESSION_NOT_FOUND',
            'message', 'Session not found.'
        );
    END IF;

    v_actor_email := COALESCE(auth.jwt() ->> 'email', 'service_role');

    -- Mark session closed
    UPDATE public.table_sessions
    SET status = 'closed',
        closed_at = now()
    WHERE id = p_session_id;

    -- Remove all session members so customer access stops immediately
    DELETE FROM public.session_members
    WHERE session_id = p_session_id;

    -- Write to audit log
    INSERT INTO public.audit_log (
        actor_email,
        action,
        entity_type,
        entity_id,
        details
    )
    VALUES (
        v_actor_email,
        'CLOSE_SESSION',
        'table_sessions',
        p_session_id::TEXT,
        jsonb_build_object(
            'table_id', v_session.table_id,
            'closed_at', now()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'session_id', p_session_id,
        'closed_at', now()
    );
END;
$$;

-- 4. REGENERATE PIN (Manager Only)
CREATE OR REPLACE FUNCTION public.regenerate_pin(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session RECORD;
    v_new_pin TEXT;
    v_actor_email TEXT;
BEGIN
    IF NOT public.is_manager() AND auth.role() <> 'service_role' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHORIZED',
            'message', 'Only managers can regenerate table PINs.'
        );
    END IF;

    SELECT * INTO v_session
    FROM public.table_sessions
    WHERE id = p_session_id AND status = 'open';

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'NO_OPEN_SESSION',
            'message', 'No active open session found for this ID.'
        );
    END IF;

    v_actor_email := COALESCE(auth.jwt() ->> 'email', 'service_role');

    -- Generate fresh 4-digit PIN
    v_new_pin := LPAD(FLOOR(random() * 9000 + 1000)::TEXT, 4, '0');

    -- Update PIN and refresh 4-hour expiry
    UPDATE public.table_sessions
    SET pin = v_new_pin,
        expires_at = now() + INTERVAL '4 hours'
    WHERE id = p_session_id;

    -- Write to audit log
    INSERT INTO public.audit_log (
        actor_email,
        action,
        entity_type,
        entity_id,
        details
    )
    VALUES (
        v_actor_email,
        'REGENERATE_PIN',
        'table_sessions',
        p_session_id::TEXT,
        jsonb_build_object(
            'table_id', v_session.table_id,
            'old_pin', v_session.pin,
            'new_pin', v_new_pin,
            'expires_at', now() + INTERVAL '4 hours'
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'session_id', p_session_id,
        'table_id', v_session.table_id,
        'pin', v_new_pin,
        'expires_at', now() + INTERVAL '4 hours'
    );
END;
$$;

-- 5. AUTO-CLOSE EXPIRED SESSIONS (Cron / Scheduled Worker)
CREATE OR REPLACE FUNCTION public.auto_close_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_closed_count INTEGER := 0;
    v_rec RECORD;
BEGIN
    FOR v_rec IN (
        SELECT id, table_id
        FROM public.table_sessions
        WHERE status = 'open' AND expires_at < now()
    ) LOOP
        -- Mark closed
        UPDATE public.table_sessions
        SET status = 'closed',
            closed_at = now()
        WHERE id = v_rec.id;

        -- Remove members to revoke access
        DELETE FROM public.session_members
        WHERE session_id = v_rec.id;

        -- Audit log entry
        INSERT INTO public.audit_log (
            actor_email,
            action,
            entity_type,
            entity_id,
            details
        )
        VALUES (
            'system_cron',
            'AUTO_CLOSE_EXPIRED',
            'table_sessions',
            v_rec.id::TEXT,
            jsonb_build_object(
                'table_id', v_rec.table_id,
                'expired_at', now()
            )
        );

        v_closed_count := v_closed_count + 1;
    END LOOP;

    RETURN v_closed_count;
END;
$$;
