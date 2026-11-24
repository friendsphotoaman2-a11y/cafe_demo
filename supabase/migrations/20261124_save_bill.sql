-- Function: save_bill
-- Single database transaction:
-- 1. Computes subtotal of non-cancelled items
-- 2. Calculates tax and discount
-- 3. Updates customer visits & loyalty (if phone provided)
-- 4. Generates unique order ID like CF-261124-0012
-- 5. Inserts into bills with synced_to_sheets = false
-- 6. Marks orders as BILLED and closes the table session

CREATE OR REPLACE FUNCTION public.save_bill(
    p_session_id UUID,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_payment_mode TEXT DEFAULT 'cash',
    p_discount NUMERIC DEFAULT 0,
    p_custom_order_id TEXT DEFAULT NULL
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
    v_loyalty_threshold INTEGER := 5;
    v_prefix TEXT := 'CF-';
    v_date_str TEXT;
    v_daily_count INTEGER := 0;
    v_order_id TEXT;
    v_bill_id UUID;
    v_clean_phone TEXT;
    v_clean_name TEXT;
BEGIN
    -- 1. Fetch table session
    SELECT * INTO v_session FROM public.table_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;

    IF v_session.status = 'CLOSED' THEN
        RAISE EXCEPTION 'Session is already closed.';
    END IF;

    -- Fetch table
    SELECT * INTO v_table FROM public.cafe_tables WHERE id = v_session.table_id;

    -- Fetch manager settings
    SELECT * INTO v_settings FROM public.manager_settings WHERE id = 1;
    IF FOUND THEN
        IF v_settings.gst_rate_percent IS NOT NULL THEN
            v_gst_rate := v_settings.gst_rate_percent;
        END IF;
    END IF;

    -- 2. Compute subtotal from all non-cancelled order items for this session
    SELECT COALESCE(SUM(oi.price_per_unit * oi.quantity), 0)
    INTO v_subtotal
    FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE o.session_id = p_session_id
      AND oi.status <> 'CANCELLED';

    -- 3. Normalize inputs
    v_clean_name := COALESCE(NULLIF(TRIM(p_customer_name), ''), 'Guest');
    v_clean_phone := REGEXP_REPLACE(COALESCE(p_customer_phone, ''), '[^0-9]', '', 'g');
    IF LENGTH(v_clean_phone) > 10 AND v_clean_phone LIKE '91%' THEN
        v_clean_phone := SUBSTRING(v_clean_phone FROM 3);
    END IF;

    -- 4. Customer & Loyalty computation (if 10-digit phone provided)
    IF LENGTH(v_clean_phone) = 10 THEN
        SELECT * INTO v_customer
        FROM public.customers
        WHERE phone = v_clean_phone;

        IF FOUND THEN
            v_visit_count := v_customer.total_visits + 1;
            IF (v_visit_count - 1) % v_loyalty_threshold = 0 AND v_visit_count > 1 THEN
                v_is_loyalty_free_coffee := true;
            END IF;

            UPDATE public.customers
            SET name = v_clean_name,
                total_visits = v_visit_count,
                free_coffee_awarded = free_coffee_awarded + CASE WHEN v_is_loyalty_free_coffee THEN 1 ELSE 0 END,
                last_visit_at = now()
            WHERE id = v_customer.id;
        ELSE
            v_visit_count := 1;
            INSERT INTO public.customers (phone, name, total_visits, free_coffee_awarded, last_visit_at)
            VALUES (v_clean_phone, v_clean_name, 1, 0, now())
            RETURNING * INTO v_customer;
        END IF;
    END IF;

    -- 5. Calculate Taxes and Final Total
    v_gst_amount := ROUND((GREATEST(v_subtotal - COALESCE(p_discount, 0), 0) * v_gst_rate / 100.0), 2);
    v_total := ROUND(GREATEST(v_subtotal - COALESCE(p_discount, 0), 0) + v_gst_amount, 2);

    -- 6. Generate Unique Order ID like CF-261124-0012 if not explicitly passed
    IF p_custom_order_id IS NOT NULL AND TRIM(p_custom_order_id) <> '' THEN
        v_order_id := TRIM(p_custom_order_id);
    ELSE
        v_date_str := TO_CHAR(now() AT TIME ZONE 'Asia/Kolkata', 'DDMMYY');

        SELECT COUNT(*) + 1 INTO v_daily_count
        FROM public.bills
        WHERE created_at >= (now() AT TIME ZONE 'Asia/Kolkata')::DATE;

        v_order_id := v_prefix || v_date_str || '-' || LPAD(v_daily_count::TEXT, 4, '0');

        -- Ensure uniqueness in case of race condition
        WHILE EXISTS (SELECT 1 FROM public.bills WHERE invoice_number = v_order_id) LOOP
            v_daily_count := v_daily_count + 1;
            v_order_id := v_prefix || v_date_str || '-' || LPAD(v_daily_count::TEXT, 4, '0');
        END LOOP;
    END IF;

    -- 7. Insert Bill with synced_to_sheets = false
    INSERT INTO public.bills (
        invoice_number,
        session_id,
        table_id,
        table_number,
        customer_name,
        customer_phone,
        subtotal,
        discount,
        gst_rate,
        gst_amount,
        total_amount,
        visit_count,
        is_loyalty_free_coffee,
        synced_to_sheets,
        created_at
    )
    VALUES (
        v_order_id,
        v_session.id,
        v_session.table_id,
        v_table.table_number,
        v_clean_name,
        COALESCE(NULLIF(v_clean_phone, ''), 'N/A'),
        v_subtotal,
        COALESCE(p_discount, 0),
        v_gst_rate,
        v_gst_amount,
        v_total,
        v_visit_count,
        v_is_loyalty_free_coffee,
        false,
        now()
    )
    RETURNING id INTO v_bill_id;

    -- 8. Mark orders as BILLED and close session
    UPDATE public.orders
    SET status = 'BILLED'
    WHERE session_id = p_session_id;

    UPDATE public.table_sessions
    SET status = 'CLOSED', closed_at = now()
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
        'bill_id', v_bill_id,
        'invoice_number', v_order_id,
        'order_id', v_order_id,
        'subtotal', v_subtotal,
        'discount', COALESCE(p_discount, 0),
        'gst_rate', v_gst_rate,
        'gst_amount', v_gst_amount,
        'total_amount', v_total,
        'visit_count', v_visit_count,
        'is_loyalty_free_coffee', v_is_loyalty_free_coffee,
        'customer_name', v_clean_name,
        'customer_phone', v_clean_phone,
        'payment_mode', p_payment_mode
    );
END;
$$;
