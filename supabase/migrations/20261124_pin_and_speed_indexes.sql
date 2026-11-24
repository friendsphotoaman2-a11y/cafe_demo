-- Migration: PIN Switch, Table Overrides, Storage Stats, and Performance Indexes
-- Date: 2026-11-24

-- 1. Add require_pin master toggle to manager_settings
ALTER TABLE public.manager_settings 
ADD COLUMN IF NOT EXISTS require_pin BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Add per-table pin_override to cafe_tables ('DEFAULT', 'ON', 'OFF')
ALTER TABLE public.cafe_tables 
ADD COLUMN IF NOT EXISTS pin_override TEXT NOT NULL DEFAULT 'DEFAULT';

-- 3. Speed & Performance Indexes
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_status ON public.table_sessions(table_id, status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_token ON public.table_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON public.orders(session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON public.order_items(status);
CREATE INDEX IF NOT EXISTS idx_bills_customer_phone ON public.bills(customer_phone);
CREATE INDEX IF NOT EXISTS idx_bills_invoice_number ON public.bills(invoice_number);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON public.bills(created_at);
CREATE INDEX IF NOT EXISTS idx_bills_synced ON public.bills(synced_to_sheets);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_status ON public.waiter_calls(status);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_created_at ON public.waiter_calls(created_at);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON public.menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category_id);

-- 4. RPC to get effective table PIN requirement
-- Returns require_pin: boolean, effective_mode: 'ON' | 'OFF'
CREATE OR REPLACE FUNCTION public.get_table_pin_mode(p_table_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_master_pin BOOLEAN;
  v_table_override TEXT;
  v_effective_pin BOOLEAN;
BEGIN
  SELECT COALESCE(require_pin, TRUE) INTO v_master_pin 
  FROM public.manager_settings 
  WHERE id = 1;
  
  IF v_master_pin IS NULL THEN
    v_master_pin := TRUE;
  END IF;

  SELECT COALESCE(pin_override, 'DEFAULT') INTO v_table_override
  FROM public.cafe_tables
  WHERE id = p_table_id;

  IF v_table_override = 'ON' THEN
    v_effective_pin := TRUE;
  ELSIF v_table_override = 'OFF' THEN
    v_effective_pin := FALSE;
  ELSE
    v_effective_pin := v_master_pin;
  END IF;

  RETURN jsonb_build_object(
    'master_pin', v_master_pin,
    'table_override', COALESCE(v_table_override, 'DEFAULT'),
    'require_pin', v_effective_pin
  );
END;
$$;
