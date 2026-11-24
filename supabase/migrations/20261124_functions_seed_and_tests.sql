-- ==============================================================================
-- PART 1: ADVANCED BUSINESS FUNCTIONS (SECURITY DEFINER)
-- ==============================================================================

-- 1. PLACE ORDER FUNCTION
-- Enforces open session, server-side verified prices, availability checks,
-- Asia/Kolkata timing window checks, name/price snapshots, and max 150 char notes.
CREATE OR REPLACE FUNCTION public.place_order(
    p_session_id UUID,
    p_items JSONB,              -- Array of { item_id: UUID, qty: INT, note: TEXT }
    p_device_id TEXT DEFAULT 'anon_device',
    p_order_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session RECORD;
    v_order_id UUID;
    v_elem JSONB;
    v_item_id UUID;
    v_qty INTEGER;
    v_item_note TEXT;
    v_item RECORD;
    v_kolkata_time TIME;
    v_total_items INTEGER := 0;
BEGIN
    -- 1. Validate open session
    SELECT * INTO v_session
    FROM public.table_sessions
    WHERE id = p_session_id AND status = 'open';

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'SESSION_NOT_OPEN',
            'message', 'Order rejected: Table session is closed or invalid.'
        );
    END IF;

    -- Check session expiry
    IF v_session.expires_at IS NOT NULL AND v_session.expires_at < now() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'SESSION_EXPIRED',
            'message', 'Order rejected: Table session has expired. Please ask manager for a new PIN.'
        );
    END IF;

    -- Validate overall order notes length (max 150 chars)
    IF p_order_notes IS NOT NULL AND length(p_order_notes) > 150 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'NOTE_TOO_LONG',
            'message', 'Order notes cannot exceed 150 characters.'
        );
    END IF;

    -- Current time in Indian Standard Time (Asia/Kolkata)
    v_kolkata_time := (now() AT TIME ZONE 'Asia/Kolkata')::TIME;

    -- 2. Validate all items before inserting
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EMPTY_ORDER',
            'message', 'Order must contain at least one item.'
        );
    END IF;

    -- Create order header
    INSERT INTO public.orders (
        session_id,
        table_id,
        device_id,
        status,
        notes,
        created_at
    )
    VALUES (
        v_session.id,
        v_session.table_id,
        COALESCE(p_device_id, 'anon_device'),
        'pending',
        p_order_notes,
        now()
    )
    RETURNING id INTO v_order_id;

    -- 3. Loop over items, verify availability & timing
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := (v_elem->>'item_id')::UUID;
        v_qty := COALESCE((v_elem->>'qty')::INTEGER, (v_elem->>'quantity')::INTEGER, 1);
        v_item_note := v_elem->>'note';

        -- Validate individual item note length (max 150 chars)
        IF v_item_note IS NOT NULL AND length(v_item_note) > 150 THEN
            RAISE EXCEPTION 'Item note cannot exceed 150 characters.';
        END IF;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Item quantity must be greater than 0.';
        END IF;

        -- Fetch item from database
        SELECT * INTO v_item
        FROM public.menu_items
        WHERE id = v_item_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Menu item with ID % not found.', v_item_id;
        END IF;

        -- Check if marked "not available today"
        IF NOT v_item.is_available_today THEN
            RAISE EXCEPTION 'Item "%" is marked not available today.', v_item.name_en;
        END IF;

        -- Check meal timing window in Asia/Kolkata time
        IF v_item.available_from IS NOT NULL AND v_item.available_to IS NOT NULL THEN
            IF v_kolkata_time < v_item.available_from OR v_kolkata_time > v_item.available_to THEN
                RAISE EXCEPTION 'Item "%" is only available between % and % IST (Current IST time is %).',
                    v_item.name_en,
                    to_char(v_item.available_from, 'HH12:MI AM'),
                    to_char(v_item.available_to, 'HH12:MI AM'),
                    to_char(v_kolkata_time, 'HH12:MI AM');
            END IF;
        END IF;

        -- Insert order item with frozen snapshots
        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            name_snapshot,
            price_snapshot,
            qty,
            note,
            status,
            created_at
        )
        VALUES (
            v_order_id,
            v_item.id,
            v_item.name_en,
            v_item.price,   -- Server-verified price snapshot
            v_qty,
            v_item_note,
            'pending',
            now()
        );

        v_total_items := v_total_items + v_qty;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'total_items', v_total_items,
        'message', 'Order placed successfully!'
    );
END;
$$;

-- 2. CALL WAITER FUNCTION (WITH 45-SECOND TABLE COOLDOWN)
CREATE OR REPLACE FUNCTION public.call_waiter(
    p_session_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session RECORD;
    v_last_call_time TIMESTAMPTZ;
    v_seconds_since_last_call INTEGER;
    v_cooldown_remaining INTEGER;
    v_call_id UUID;
BEGIN
    -- 1. Validate open session
    SELECT * INTO v_session
    FROM public.table_sessions
    WHERE id = p_session_id AND status = 'open';

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'SESSION_NOT_OPEN',
            'message', 'Cannot call waiter: Table session is closed or inactive.'
        );
    END IF;

    -- Validate note length (max 150 chars)
    IF p_note IS NOT NULL AND length(p_note) > 150 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'NOTE_TOO_LONG',
            'message', 'Waiter note cannot exceed 150 characters.'
        );
    END IF;

    -- 2. Check 45-second cooldown per table
    SELECT MAX(created_at) INTO v_last_call_time
    FROM public.waiter_calls
    WHERE table_id = v_session.table_id;

    IF v_last_call_time IS NOT NULL THEN
        v_seconds_since_last_call := EXTRACT(EPOCH FROM (now() - v_last_call_time))::INTEGER;
        IF v_seconds_since_last_call < 45 THEN
            v_cooldown_remaining := 45 - v_seconds_since_last_call;
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'COOLDOWN_ACTIVE',
                'cooldown_remaining_seconds', v_cooldown_remaining,
                'message', 'Staff was already alerted. Please wait ' || v_cooldown_remaining || ' seconds before calling again.'
            );
        END IF;
    END IF;

    -- 3. Insert waiter call
    INSERT INTO public.waiter_calls (
        session_id,
        table_id,
        note,
        status,
        created_at
    )
    VALUES (
        v_session.id,
        v_session.table_id,
        p_note,
        'pending',
        now()
    )
    RETURNING id INTO v_call_id;

    RETURN jsonb_build_object(
        'success', true,
        'call_id', v_call_id,
        'message', 'Waiter has been alerted!'
    );
END;
$$;

-- 3. SET ITEM AVAILABILITY (Manager Only with Audit Log)
CREATE OR REPLACE FUNCTION public.set_item_availability(
    p_item_id UUID,
    p_is_available BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_item RECORD;
    v_actor_email TEXT;
BEGIN
    IF NOT public.is_manager() AND auth.role() <> 'service_role' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHORIZED',
            'message', 'Only managers can change item availability.'
        );
    END IF;

    SELECT * INTO v_item FROM public.menu_items WHERE id = p_item_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ITEM_NOT_FOUND',
            'message', 'Menu item not found.'
        );
    END IF;

    v_actor_email := COALESCE(auth.jwt() ->> 'email', 'service_role');

    -- Update item availability
    UPDATE public.menu_items
    SET is_available_today = p_is_available
    WHERE id = p_item_id;

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
        'SET_ITEM_AVAILABILITY',
        'menu_items',
        p_item_id::TEXT,
        jsonb_build_object(
            'item_name', v_item.name_en,
            'previous_availability', v_item.is_available_today,
            'new_availability', p_is_available
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'item_id', p_item_id,
        'item_name', v_item.name_en,
        'is_available_today', p_is_available
    );
END;
$$;

-- ==============================================================================
-- PART 2: SEED DATA (8 Tables, 3 Categories, 12 Sample Items)
-- ==============================================================================

-- 8 Tables
INSERT INTO public.tables (table_code, table_name)
VALUES
    ('T1', 'Table 1'),
    ('T2', 'Table 2'),
    ('T3', 'Table 3'),
    ('T4', 'Table 4'),
    ('T5', 'Table 5'),
    ('T6', 'Table 6'),
    ('T7', 'Table 7'),
    ('T8', 'Table 8')
ON CONFLICT (table_code) DO NOTHING;

-- 3 Categories
INSERT INTO public.menu_categories (id, name_en, name_hi, available_from, available_to, display_order)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Hot Brews & Teas', 'गर्म कॉफ़ी और चाय', NULL, NULL, 1),
    ('a0000000-0000-0000-0000-000000000002', 'Breakfast Specials', 'नाश्ता विशेष', '07:00:00', '11:30:00', 2),
    ('a0000000-0000-0000-0000-000000000003', 'All-Day Bites', 'स्नैक्स और बाइट्स', '11:30:00', '23:00:00', 3)
ON CONFLICT (id) DO NOTHING;

-- 12 Sample Items
INSERT INTO public.menu_items (
    id, category_id, name_en, name_hi, price, is_veg, photo_url, is_available_today, available_from, available_to
)
VALUES
    -- Category 1: Hot Brews & Teas (All Day)
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'South Indian Filter Coffee', 'फ़िल्टर कॉफ़ी', 80.00, true, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600', true, NULL, NULL),
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Adrak Elaichi Chai', 'अदरक इलायची चाय', 60.00, true, 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600', true, NULL, NULL),
    ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Espresso Macchiato', 'एस्प्रेसो मैकिआटो', 130.00, true, 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=600', true, NULL, NULL),
    ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Signature Hot Chocolate', 'हॉट चॉकलेट', 170.00, true, 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=600', true, NULL, NULL),

    -- Category 2: Breakfast Specials (07:00 AM - 11:30 AM IST)
    ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'Bun Maska & Jam', 'बन मस्का और जैम', 90.00, true, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600', true, '07:00:00', '11:30:00'),
    ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'Poha with Sev & Peanuts', 'इंदौरी पोहा', 110.00, true, 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600', true, '07:00:00', '11:30:00'),
    ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'Masala Akuri on Sourdough', 'मसाला अकुरी टोस्ट', 160.00, false, 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600', true, '07:00:00', '11:30:00'),
    ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', 'Avocado & Herb Toast', 'एवोकाडो हर्ब टोस्ट', 210.00, true, 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=600', true, '07:00:00', '11:30:00'),

    -- Category 3: All-Day Bites (11:30 AM - 11:00 PM IST)
    ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000003', 'Bombay Masala Cheese Toast', 'बॉम्बे मसाला चीज़ टोस्ट', 150.00, true, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600', true, '11:30:00', '23:00:00'),
    ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000003', 'Peri Peri Crinkle Fries', 'पेरी पेरी फ्राइज़', 120.00, true, 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600', true, '11:30:00', '23:00:00'),
    ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000003', 'Crispy Paneer Slider', 'पनीर बर्गर', 180.00, true, 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600', true, '11:30:00', '23:00:00'),
    ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000003', 'Tandoori Chicken Tikka Pav', 'तंदूरी चिकन पाव', 220.00, false, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600', true, '11:30:00', '23:00:00')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- PART 3: SQL VERIFICATION / TEST SCRIPT
-- ==============================================================================
-- Run this block to PROVE:
-- 1. Wrong PIN is rejected by join_session
-- 2. An anonymous user CANNOT read table_sessions
-- 3. An anonymous user CANNOT read another session's orders
-- ==============================================================================

DO $$
DECLARE
    v_tbl_id UUID;
    v_session_res JSONB;
    v_join_wrong JSONB;
    v_sess_id UUID;
    v_test_device TEXT := 'test_device_x99';
    v_anon_session_count INTEGER;
    v_other_order_count INTEGER;
BEGIN
    RAISE NOTICE '--- STARTING SECURITY & RLS VERIFICATION TESTS ---';

    -- Setup: Get Table 1 and generate an open session
    SELECT id INTO v_tbl_id FROM public.tables WHERE table_code = 'T1';
    
    -- Direct internal call to generate session for test
    INSERT INTO public.table_sessions (table_id, pin, status, session_token, opened_at, expires_at)
    VALUES (v_tbl_id, '7412', 'open', gen_random_uuid(), now(), now() + INTERVAL '4 hours')
    RETURNING id INTO v_sess_id;

    -- --------------------------------------------------------------------------
    -- TEST 1: PROVE WRONG PIN IS REJECTED
    -- --------------------------------------------------------------------------
    SELECT public.join_session('T1', '0000', v_test_device) INTO v_join_wrong;
    
    IF (v_join_wrong->>'success')::BOOLEAN = false AND v_join_wrong->>'error_code' = 'INVALID_PIN' THEN
        RAISE NOTICE ' [PASSED] Test 1: Wrong PIN was correctly rejected with error code: %', v_join_wrong->>'error_code';
    ELSE
        RAISE EXCEPTION ' [FAILED] Test 1: Expected wrong PIN rejection, but got: %', v_join_wrong;
    END IF;

    -- --------------------------------------------------------------------------
    -- TEST 2: PROVE ANON USER CANNOT SELECT FROM table_sessions
    -- --------------------------------------------------------------------------
    -- Simulate anonymous role (anon)
    SET LOCAL ROLE anon;
    
    SELECT COUNT(*) INTO v_anon_session_count FROM public.table_sessions;
    
    -- Reset back to postgres superuser
    RESET ROLE;

    IF v_anon_session_count = 0 THEN
        RAISE NOTICE ' [PASSED] Test 2: Anonymous user queried table_sessions and received 0 rows (RLS blocked read).';
    ELSE
        RAISE EXCEPTION ' [FAILED] Test 2: Anonymous user was able to read % rows from table_sessions!', v_anon_session_count;
    END IF;

    -- --------------------------------------------------------------------------
    -- TEST 3: PROVE ANON USER CANNOT READ ANOTHER SESSION''S ORDERS
    -- --------------------------------------------------------------------------
    -- Create an order belonging to v_sess_id
    INSERT INTO public.orders (session_id, table_id, device_id, status)
    VALUES (v_sess_id, v_tbl_id, 'device_legit_customer', 'pending');

    -- Switch to anon user (who is NOT in session_members for this session)
    SET LOCAL ROLE anon;
    
    SELECT COUNT(*) INTO v_other_order_count 
    FROM public.orders 
    WHERE session_id = v_sess_id;

    RESET ROLE;

    IF v_other_order_count = 0 THEN
        RAISE NOTICE ' [PASSED] Test 3: Anonymous user cannot read orders of unjoined session (Returned 0 rows due to RLS).';
    ELSE
        RAISE EXCEPTION ' [FAILED] Test 3: Anonymous user was able to read another session''s orders!';
    END IF;

    -- Clean up test records
    DELETE FROM public.orders WHERE session_id = v_sess_id;
    DELETE FROM public.table_sessions WHERE id = v_sess_id;

    RAISE NOTICE '--- ALL 3 SECURITY TESTS PASSED SUCCESSFULLY! ---';
END $$;
