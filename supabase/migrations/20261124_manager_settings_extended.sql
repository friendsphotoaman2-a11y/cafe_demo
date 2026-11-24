-- Extended Manager Settings Columns
ALTER TABLE public.manager_settings
ADD COLUMN IF NOT EXISTS cafe_email TEXT DEFAULT 'contact@brewandbites.com',
ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS session_hours NUMERIC(4,1) DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS loyalty_every_n_visits INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS order_id_prefix TEXT DEFAULT 'ORD-';
