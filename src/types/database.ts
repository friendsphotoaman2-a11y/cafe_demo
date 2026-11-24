export type MealTiming = 'all_day' | 'breakfast' | 'lunch';
export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'BILLED' | 'CANCELLED';
export type SessionStatus = 'ACTIVE' | 'CLOSED';
export type WaiterCallStatus = 'PENDING' | 'RESOLVED';

export interface CafeTable {
  id: string;
  table_number: string;
  table_code: string;
  created_at: string;
}

export interface TableSession {
  id: string;
  table_id: string;
  pin_code?: string;
  status: SessionStatus;
  session_token: string;
  failed_attempts: number;
  locked_until: string | null;
  opened_at: string;
  closed_at: string | null;
}

export interface Category {
  id: string;
  name_en: string;
  name_hi: string;
  display_order: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  category_id: string | null;
  name_en: string;
  name_hi: string;
  description_en: string | null;
  description_hi: string | null;
  price: number;
  is_veg: boolean;
  image_url: string | null;
  is_available: boolean;
  is_available_today?: boolean;
  meal_timing: MealTiming;
  breakfast_start?: string;
  breakfast_end?: string;
  lunch_start?: string;
  lunch_end?: string;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_id: string | null;
  item_name_en: string;
  item_name_hi: string;
  price_per_unit: number;
  quantity: number;
  item_notes: string | null;
  status: OrderStatus;
  created_at: string;
}

export interface Order {
  id: string;
  session_id: string;
  table_id: string;
  device_id: string;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
  order_items?: OrderItem[];
}

export interface WaiterCall {
  id: string;
  session_id: string;
  table_id: string;
  table_number: string;
  note: string | null;
  status: WaiterCallStatus;
  created_at: string;
}

export interface Customer {
  id: string;
  phone: string;
  name: string;
  total_visits: number;
  free_coffee_awarded: number;
  last_visit_at: string;
  created_at: string;
}

export interface Bill {
  id: string;
  invoice_number: string;
  session_id: string | null;
  table_id: string | null;
  table_number: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  discount: number;
  gst_rate: number;
  gst_amount: number;
  total_amount: number;
  visit_count: number;
  is_loyalty_free_coffee: boolean;
  synced_to_sheets: boolean;
  sheets_synced_at?: string;
  created_at: string;
  order_items?: OrderItem[];
}

export interface ManagerSettings {
  id: number;
  cafe_name: string;
  cafe_tagline?: string | null;
  cafe_address: string | null;
  cafe_phone: string | null;
  cafe_email?: string | null;
  gst_number: string | null;
  tax_enabled?: boolean;
  gst_rate_percent: number;
  receipt_paper_size: '58mm' | '80mm';
  session_hours?: number;
  loyalty_every_n_visits?: number;
  order_id_prefix?: string;
  kitchen_screen_enabled: boolean;
  google_sheet_id: string | null;
  require_pin?: boolean;
  table_pin_overrides?: Record<string, 'DEFAULT' | 'ON' | 'OFF'>;
  updated_at: string;
}
