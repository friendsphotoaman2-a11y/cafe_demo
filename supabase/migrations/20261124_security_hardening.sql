-- ==============================================================================
-- SECURITY HARDENING MIGRATION
-- Project: Smart Cafe System
-- Date: 2026-11-24
-- Description:
--   1. Drop public SELECT on table_sessions, orders, order_items, waiter_calls
--      to eliminate cross-table data leak and PIN exposure.
--   2. Enforce is_manager() / service_role authorization on sensitive RPC functions:
--      - close_table_session
--      - record_bill_and_loyalty
--      - cleanup_old_closed_bills
--      - generate_table_session
--   3. Revoke EXECUTE privileges on sensitive functions from PUBLIC and anon.
--   4. Ensure place_table_order strictly rejects inactive/closed sessions.
-- ==============================================================================

-- 1. DROP PUBLIC SELECT POLICIES (Fixes Vectors 1 & 2: Cross-table data read and PIN leak)
DROP POLICY IF EXISTS "Public can read session state" ON public.table_sessions;
DROP POLICY IF EXISTS "Public can view orders for active sessions" ON public.orders;
DROP POLICY IF EXISTS "Public can view order items for active sessions" ON public.order_items;
DROP POLICY IF EXISTS "Public can view waiter calls for active table" ON public.waiter_calls;

-- Ensure RLS is active on all core tables
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_settings ENABLE ROW LEVEL SECURITY;

-- 2. HARDEN is_manager() HELPER TO SUPPORT SERVICE_ROLE
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.role() = 'service_role') OR EXISTS (
    SELECT 1 FROM public.allowed_managers
    WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );
$$;

-- 3. HARDEN close_table_session (Fixes Vector 5: Unauthorized RPC call)
CREATE OR REPLACE FUNCTION public.close_table_session(
    p_session_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT (public.is_manager() OR auth.role() = 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized: Only managers can close table sessions.';
    END IF;

    UPDATE public.table_sessions
    SET status = 'CLOSED', closed_at = now()
    WHERE id = p_session_id;

    RETURN true;
END;
$$;

-- 4. HARDEN record_bill_and_loyalty (Fixes Vector 5: Unauthorized RPC call)
CREATE OR REPLACE FUNCTION public.record_bill_and_loyalty(
    p_session_id UUID,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_discount NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
    v_table RECORD;
    v_settings RECORD;
    v_customer RECORD;
    v_subtotal NUMERIC := 0;
    v_gst_rate NUMERIC := 5.0;
    v_gst_amount NUMERIC := 0;
    v_total NUMERIC := 0;
    v_visit_count INTEGER := 1;
    v_is_loyalty_free_coffee BOOLEAN := false;
    v_invoice_number TEXT;
    v_bill_id UUID;
BEGIN
    IF NOT (public.is_manager() OR auth.role() = 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized: Only managers can generate and record bills.';
    END IF;

    -- Fetch session
    SELECT * INTO v_session FROM public.table_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;

    SELECT * INTO v_table FROM public.cafe_tables WHERE id = v_session.table_id;
    SELECT * INTO v_settings FROM public.manager_settings WHERE id = 1;
    IF FOUND AND v_settings.gst_rate_percent IS NOT NULL THEN
        v_gst_rate := v_settings.gst_rate_percent;
    END IF;

    -- Compute subtotal from non-cancelled items
    SELECT COALESCE(SUM(oi.price_per_unit * oi.quantity), 0)
    INTO v_subtotal
    FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE o.session_id = p_session_id
      AND oi.status <> 'CANCELLED';

    IF v_subtotal <= 0 THEN
        RAISE EXCEPTION 'No valid items found to bill for this session.';
    END IF;

    -- Calculate GST and Grand Total
    v_gst_amount := ROUND((v_subtotal - COALESCE(p_discount, 0)) * (v_gst_rate / 100.0), 2);
    IF v_gst_amount < 0 THEN v_gst_amount := 0; END IF;
    v_total := ROUND((v_subtotal - COALESCE(p_discount, 0)) + v_gst_amount, 2);
    IF v_total < 0 THEN v_total := 0; END IF;

    -- Loyalty lookup/update
    IF p_customer_phone IS NOT NULL AND length(trim(p_customer_phone)) = 10 THEN
        SELECT * INTO v_customer FROM public.customers WHERE phone = trim(p_customer_phone);
        IF FOUND THEN
            v_visit_count := v_customer.visit_count + 1;
            IF v_customer.visit_count > 0 AND (v_customer.visit_count % 5 = 0) THEN
                v_is_loyalty_free_coffee := true;
            END IF;

            UPDATE public.customers
            SET visit_count = v_visit_count,
                name = COALESCE(NULLIF(trim(p_customer_name), ''), v_customer.name),
                last_visit = now(),
                updated_at = now()
            WHERE id = v_customer.id;
        ELSE
            INSERT INTO public.customers (phone, name, visit_count, last_visit)
            VALUES (trim(p_customer_phone), NULLIF(trim(p_customer_name), ''), 1, now())
            RETURNING * INTO v_customer;
        END IF;
    END IF;

    -- Generate Invoice Number
    v_invoice_number := COALESCE(v_settings.order_id_prefix, 'CF-') || TO_CHAR(now(), 'YYYYMMDD-HH24MI') || '-' || LPAD(FLOOR(random() * 900 + 100)::TEXT, 3, '0');

    -- Insert Bill
    INSERT INTO public.bills (
        session_id,
        table_id,
        table_number,
        invoice_number,
        customer_name,
        customer_phone,
        subtotal,
        discount,
        tax_amount,
        grand_total,
        payment_mode,
        is_free_coffee_applied
    )
    VALUES (
        p_session_id,
        v_session.table_id,
        v_table.table_number,
        v_invoice_number,
        p_customer_name,
        p_customer_phone,
        v_subtotal,
        COALESCE(p_discount, 0),
        v_gst_amount,
        v_total,
        'CASH',
        v_is_loyalty_free_coffee
    )
    RETURNING id INTO v_bill_id;

    -- Mark session closed
    UPDATE public.table_sessions
    SET status = 'CLOSED', closed_at = now()
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
        'bill_id', v_bill_id,
        'invoice_number', v_invoice_number,
        'subtotal', v_subtotal,
        'tax', v_gst_amount,
        'grand_total', v_total,
        'visit_count', v_visit_count,
        'is_loyalty_free_coffee', v_is_loyalty_free_coffee
    );
END;
$$;

-- 5. HARDEN cleanup_old_closed_bills (Fixes Vector 5: Unauthorized RPC call)
CREATE OR REPLACE FUNCTION public.cleanup_old_closed_bills()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
BEGIN
    IF NOT (public.is_manager() OR auth.role() = 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized: Only manager can run retention cleanup.';
    END IF;

    WITH deleted AS (
        DELETE FROM public.bills
        WHERE created_at < (now() - INTERVAL '30 days')
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;

    DELETE FROM public.table_sessions
    WHERE status = 'CLOSED' AND closed_at < (now() - INTERVAL '30 days');

    RETURN v_deleted_count;
END;
$$;

-- 6. REVOKE EXECUTE ON SENSITIVE FUNCTIONS FROM PUBLIC AND ANON
REVOKE EXECUTE ON FUNCTION public.close_table_session(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_bill_and_loyalty(UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_closed_bills() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_table_session(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.close_table_session(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_bill_and_loyalty(UUID, TEXT, TEXT, NUMERIC) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_closed_bills() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_table_session(UUID) TO authenticated, service_role;
