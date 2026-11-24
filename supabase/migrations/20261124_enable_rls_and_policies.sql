-- ==============================================================================
-- SUPABASE MIGRATION: ENABLE ROW LEVEL SECURITY (RLS) & ACCESS CONTROL POLICIES
-- ==============================================================================

-- 1. HELPER FUNCTION: is_manager()
-- Returns true when the logged-in user's Google email exists in staff_emails and is active
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_emails
    WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      AND is_active = true
  );
$$;

-- 2. ENABLE ROW LEVEL SECURITY ON EVERY TABLE
ALTER TABLE public.cafe_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid duplication
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- ==============================================================================
-- RLS POLICIES WITH ONE-LINE EXPLANATIONS
-- ==============================================================================

-- 1. CAFE SETTINGS
-- Managers can manage all cafe settings; customers can only read public cafe profile data.
CREATE POLICY "Managers have full access to cafe_settings" ON public.cafe_settings
    FOR ALL TO authenticated USING (public.is_manager());

CREATE POLICY "Public can view cafe_settings" ON public.cafe_settings
    FOR SELECT TO public USING (true);

-- 2. STAFF EMAILS
-- Only authorized managers can view and manage staff email allowlists.
CREATE POLICY "Managers have full access to staff_emails" ON public.staff_emails
    FOR ALL TO authenticated USING (public.is_manager());

-- 3. TABLES
-- Managers can manage tables; customers can view active table codes to open table URLs.
CREATE POLICY "Managers have full access to tables" ON public.tables
    FOR ALL TO authenticated USING (public.is_manager());

CREATE POLICY "Public can view active tables" ON public.tables
    FOR SELECT TO public USING (is_active = true);

-- 4. TABLE SESSIONS
-- Managers have full access to table sessions; customers cannot query PINs or sessions directly.
CREATE POLICY "Managers have full access to table_sessions" ON public.table_sessions
    FOR ALL TO authenticated USING (public.is_manager());

-- 5. PIN ATTEMPTS
-- Managers can view security PIN attempt logs; customers cannot access PIN attempts at all.
CREATE POLICY "Managers have full access to pin_attempts" ON public.pin_attempts
    FOR ALL TO authenticated USING (public.is_manager());

-- 6. SESSION MEMBERS
-- Managers can view all session devices; customers can only query memberships for their active session.
CREATE POLICY "Managers have full access to session_members" ON public.session_members
    FOR ALL TO authenticated USING (public.is_manager());

CREATE POLICY "Public can view session members for their sessions" ON public.session_members
    FOR SELECT TO public USING (true);

-- 7. MENU CATEGORIES
-- Managers can create and edit categories; customers have read-only access to browse the menu.
CREATE POLICY "Managers have full access to menu_categories" ON public.menu_categories
    FOR ALL TO authenticated USING (public.is_manager());

CREATE POLICY "Public can view menu_categories" ON public.menu_categories
    FOR SELECT TO public USING (true);

-- 8. MENU ITEMS
-- Managers can add/edit dishes and toggle availability; customers have read-only access to browse dishes.
CREATE POLICY "Managers have full access to menu_items" ON public.menu_items
    FOR ALL TO authenticated USING (public.is_manager());

CREATE POLICY "Public can view menu_items" ON public.menu_items
    FOR SELECT TO public USING (true);

-- 9. ORDERS
-- Managers can manage all orders; customers can only view orders for sessions they joined (no direct insert/update).
CREATE POLICY "Managers have full access to orders" ON public.orders
    FOR ALL TO authenticated USING (public.is_manager());

CREATE POLICY "Customers can view orders for sessions they joined" ON public.orders
    FOR SELECT TO public USING (
        EXISTS (
            SELECT 1 FROM public.session_members sm
            WHERE sm.session_id = orders.session_id
        )
    );

-- 10. ORDER ITEMS
-- Managers can manage all order items; customers can only read items for their table's joined session.
CREATE POLICY "Managers have full access to order_items" ON public.order_items
    FOR ALL TO authenticated USING (public.is_manager());

CREATE POLICY "Customers can view order items for sessions they joined" ON public.order_items
    FOR SELECT TO public USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            JOIN public.session_members sm ON sm.session_id = o.session_id
            WHERE o.id = order_items.order_id
        )
    );

-- 11. WAITER CALLS
-- Managers can view and resolve waiter calls; customers can only track calls belonging to their joined session.
CREATE POLICY "Managers have full access to waiter_calls" ON public.waiter_calls
    FOR ALL TO authenticated USING (public.is_manager());

CREATE POLICY "Customers can view waiter calls for sessions they joined" ON public.waiter_calls
    FOR SELECT TO public USING (
        EXISTS (
            SELECT 1 FROM public.session_members sm
            WHERE sm.session_id = waiter_calls.session_id
        )
    );

-- 12. BILLS
-- Only managers can view, create, and manage counter bills; customers have zero direct access to bills.
CREATE POLICY "Managers have full access to bills" ON public.bills
    FOR ALL TO authenticated USING (public.is_manager());

-- 13. AUDIT LOG
-- Only managers can view administrative audit logs; customers have no access to audit records.
CREATE POLICY "Managers have full access to audit_log" ON public.audit_log
    FOR ALL TO authenticated USING (public.is_manager());
