export type VegClassification = "veg" | "non-veg" | "vegan";
export type ServingTemperature = "Hot" | "Cold" | "Room Temperature";
export type SpiceLevel = "None" | "Mild" | "Medium" | "High";

export interface CustomizationOption {
  id: string;
  name: string;
  priceDelta: number; // in INR
}

export interface CustomizationGroup {
  id: string;
  title: string;
  required?: boolean;
  options: CustomizationOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  price: number; // in INR
  image: string;
  description: string;
  ingredients: string[];
  classification: VegClassification;
  flavour: string;
  servingTemperature: ServingTemperature;
  spiceLevel: SpiceLevel;
  allergens: string[];
  isAvailable: boolean;
  isFeatured?: boolean;
  badge?: string;
  customizationGroups?: CustomizationGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  iconName: string;
  description: string;
  itemCount?: number;
}

export type TableSection =
  | "Indoor Main"
  | "Courtyard Patio"
  | "Mezzanine Loft"
  | "Window Bar";

export type TableStatus =
  | "available"
  | "occupied"
  | "order_pending"
  | "preparing"
  | "billed";

export interface CafeTable {
  id: string;
  code: string; // e.g., "01", "02"
  name: string; // e.g., "Table 01"
  capacity: number;
  section: TableSection;
  status: TableStatus;
  isActive: boolean; // enable/disable table
  qrNonce?: string; // unique token for QR link security/regeneration
  currentCustomerName?: string;
  currentCustomerPhone?: string;
  currentOrderId?: string;
  lastActiveTime?: string;
}

export interface OrderCustomizationChoice {
  groupTitle: string;
  optionName: string;
  priceDelta: number;
}

export interface CartItem {
  cartItemId: string;
  menuItem: MenuItem;
  quantity: number;
  selectedCustomizations: OrderCustomizationChoice[];
  specialInstructions?: string;
  unitPrice: number;
  totalPrice: number;
}

export type OrderStatus =
  | "new"
  | "accepted"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled";

export type PaymentStatus = "unpaid" | "paid_counter";
export type PaymentMethod = "Cash" | "UPI" | "Card" | "Other";

export interface OrderItemRecord {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customizations: OrderCustomizationChoice[];
  classification: VegClassification;
}

export interface PaymentAuditRecord {
  amount: number;
  method: PaymentMethod;
  transactionRef?: string;
  cashierName: string;
  paidAt: string;
  correctionReason?: string;
}

export interface CafeOrder {
  id: string;
  orderNumber: string; // e.g. "#TBW-1041"
  tableCode: string;
  customerName: string;
  customerPhone: string;
  items: OrderItemRecord[];
  subtotal: number;
  taxAmount: number; // Configured GST (e.g. 5%)
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentAudit?: PaymentAuditRecord;
  notes?: string;
  createdAt: string;
  timestamp: number;
  estimatedPrepMinutes?: number;
}

// Consolidated Dining Session Bill for a Table (supports multiple orders)
export interface TableSessionBill {
  tableCode: string;
  tableName: string;
  customerName: string;
  customerPhone: string;
  orderNumbers: string[];
  orderIds: string[];
  consolidatedItems: {
    key: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    customizations: OrderCustomizationChoice[];
  }[];
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  isAllServed: boolean;
  isPaid: boolean;
  paymentMethod?: PaymentMethod;
  paymentAudit?: PaymentAuditRecord;
}

export interface CafeCustomer {
  id: string;
  name: string;
  phone: string;
  visitsCount: number;
  totalSpent: number;
  stampsEarned: number; // 0 to 5
  rewardEligible: boolean;
  lastVisit: string;
  favoriteItem: string;
}

export interface CafeSettings {
  brandName: string;
  tagline: string;
  address: string;
  area: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  gstNumber: string;
  gstRatePercent: number; // 5% configurable
  currencySymbol: string;
  currencyCode: string;
  openingHours: string;
  wifiSsid: string;
  wifiPassword: string;
  upiId: string;
}
