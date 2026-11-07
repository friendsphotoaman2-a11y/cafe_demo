-- =============================================================================
-- Migration: 20261107000001_initial_cafe_schema.sql
-- Description: Core schema for The Business Work — Café Website & QR Ordering Platform
-- Features: 19 tables, UUID keys, foreign key constraints, indexes, RLS, and Realtime
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Restaurants
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    tagline TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Restaurant Settings
CREATE TABLE IF NOT EXISTS public.restaurant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE UNIQUE,
    address TEXT,
    area TEXT,
    city TEXT,
    postal_code TEXT,
    phone TEXT,
    email TEXT,
    gst_number TEXT,
    gst_rate_percent NUMERIC(5,2) DEFAULT 5.00,
    currency_symbol TEXT DEFAULT '₹',
    currency_code TEXT DEFAULT 'INR',
    opening_hours TEXT,
    wifi_ssid TEXT,
    wifi_password TEXT,
    upi_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Restaurant Staff (Roles: owner, manager, cashier, kitchen)
CREATE TABLE IF NOT EXISTS public.restaurant_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    auth_user_id UUID,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier', 'kitchen')),
    is_active BOOLEAN DEFAULT true,
    pin_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(restaurant_id, email)
);

-- 4. Restaurant Tables
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    capacity INT DEFAULT 4,
    section TEXT DEFAULT 'Indoor Main',
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'order_pending', 'preparing', 'billed')),
    is_active BOOLEAN DEFAULT true,
    qr_nonce TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(restaurant_id, code)
);

-- 5. Menu Categories
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    icon_name TEXT,
    description TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(restaurant_id, slug)
);

-- 6. Menu Items
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    image_url TEXT,
    ingredients TEXT[] DEFAULT '{}',
    classification TEXT DEFAULT 'veg' CHECK (classification IN ('veg', 'non-veg', 'vegan')),
    flavour TEXT,
    serving_temperature TEXT DEFAULT 'Hot',
    spice_level TEXT DEFAULT 'None',
    allergens TEXT[] DEFAULT '{}',
    badge TEXT,
    is_available BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    customization_groups JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(restaurant_id, name)
);

-- 7. Customers (Identified by unique Indian 10-digit mobile number)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Customer Sessions (Browser session tokens for remembered customers)
CREATE TABLE IF NOT EXISTS public.customer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Dining Sessions (Associates guest + table for active dining session)
CREATE TABLE IF NOT EXISTS public.dining_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    session_code TEXT NOT NULL,
    guest_name TEXT NOT NULL,
    guest_phone TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'billed', 'closed')),
    opened_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ
);

-- 10. Orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    dining_session_id UUID REFERENCES public.dining_sessions(id) ON DELETE CASCADE,
    table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'accepted', 'preparing', 'ready', 'served', 'completed', 'cancelled')),
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid_counter')),
    notes TEXT,
    subtotal NUMERIC(10,2) NOT NULL,
    tax_amount NUMERIC(10,2) NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Order Items (Includes historical price & customization snapshot)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    item_name_snapshot TEXT NOT NULL,
    unit_price_snapshot NUMERIC(10,2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    total_price NUMERIC(10,2) NOT NULL,
    customizations_snapshot JSONB DEFAULT '[]'::jsonb,
    classification TEXT DEFAULT 'veg',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Bills (Authoritative server consolidated dining session bill)
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    dining_session_id UUID REFERENCES public.dining_sessions(id) ON DELETE CASCADE UNIQUE,
    bill_number TEXT NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL,
    tax_percent NUMERIC(5,2) DEFAULT 5.00,
    tax_amount NUMERIC(10,2) NOT NULL,
    discount_amount NUMERIC(10,2) DEFAULT 0,
    total_payable NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'voided')),
    created_at TIMESTAMPTZ DEFAULT now(),
    paid_at TIMESTAMPTZ
);

-- 13. Bill Items
CREATE TABLE IF NOT EXISTS public.bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    quantity INT NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    customizations JSONB DEFAULT '[]'::jsonb
);

-- 14. Payments (Cashier counter settlements)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'UPI', 'Card', 'Other')),
    transaction_reference TEXT,
    cashier_name TEXT NOT NULL,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'voided')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. Payment Audit Events
CREATE TABLE IF NOT EXISTS public.payment_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 16. Loyalty Accounts (5-stamp program)
CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE UNIQUE,
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    stamps_earned INT DEFAULT 0 CHECK (stamps_earned >= 0 AND stamps_earned <= 5),
    total_visits INT DEFAULT 0,
    total_spent NUMERIC(12,2) DEFAULT 0,
    reward_eligible BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 17. Customer Visits
CREATE TABLE IF NOT EXISTS public.customer_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    dining_session_id UUID REFERENCES public.dining_sessions(id) ON DELETE SET NULL,
    bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
    amount_spent NUMERIC(10,2) DEFAULT 0,
    visited_at TIMESTAMPTZ DEFAULT now()
);

-- 18. Loyalty Events
CREATE TABLE IF NOT EXISTS public.loyalty_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loyalty_account_id UUID REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    stamps_delta INT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 19. Reward Redemptions (Owner PIN only)
CREATE TABLE IF NOT EXISTS public.reward_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loyalty_account_id UUID REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE,
    authorized_by_staff_id UUID REFERENCES public.restaurant_staff(id) ON DELETE SET NULL,
    reward_description TEXT NOT NULL DEFAULT '6th Complimentary Artisan Coffee',
    redeemed_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON public.restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_code ON public.restaurant_tables(code);
CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant ON public.menu_categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_dining_session ON public.orders(dining_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_table ON public.orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_bills_dining_session ON public.bills(dining_session_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_token ON public.customer_sessions(session_token);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

-- 1. Public customer read policies for active catalog (anon & authenticated)
CREATE POLICY "Public read active restaurants" ON public.restaurants FOR SELECT USING (true);
CREATE POLICY "Public read restaurant settings" ON public.restaurant_settings FOR SELECT USING (true);
CREATE POLICY "Public read active tables" ON public.restaurant_tables FOR SELECT USING (is_active = true);
CREATE POLICY "Public read active categories" ON public.menu_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Public read active menu items" ON public.menu_items FOR SELECT USING (is_available = true);

-- 2. Authenticated Staff access policies (Protected Control Room operations)
CREATE POLICY "Staff read orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff update orders" ON public.orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff read order items" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read bills" ON public.bills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read bill items" ON public.bill_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read payment audits" ON public.payment_audit_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read dining sessions" ON public.dining_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read loyalty" ON public.loyalty_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read visits" ON public.customer_visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read staff directory" ON public.restaurant_staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff update tables" ON public.restaurant_tables FOR UPDATE TO authenticated USING (true);

-- =============================================================================
-- REALTIME PUBLICATION FOR LIVE MULTI-DEVICE SYNCHRONIZATION
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_tables;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

