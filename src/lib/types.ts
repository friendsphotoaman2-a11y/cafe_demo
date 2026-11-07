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
  badge?: string; // e.g., "Chef's Special", "Bestseller", "New"
  customizationGroups?: CustomizationGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  iconName: string;
  description: string;
  itemCount?: number;
}

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
  section: "Indoor Main" | "Courtyard Patio" | "Mezzanine Loft" | "Window Bar";
  status: TableStatus;
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
  cartItemId: string; // unique key combining item + selected options
  menuItem: MenuItem;
  quantity: number;
  selectedCustomizations: OrderCustomizationChoice[];
  specialInstructions?: string;
  unitPrice: number;
  totalPrice: number;
}

export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled";

export type PaymentStatus = "unpaid" | "paid_counter";

export interface CafeOrder {
  id: string;
  orderNumber: string; // e.g. "#TBW-1042"
  tableCode: string;
  customerName: string;
  customerPhone: string;
  items: {
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    customizations: OrderCustomizationChoice[];
    classification: VegClassification;
  }[];
  subtotal: number;
  taxAmount: number; // 5% GST
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: "Cash" | "UPI" | "Card";
  notes?: string;
  createdAt: string;
  estimatedPrepMinutes?: number;
}

export interface CafeCustomer {
  id: string;
  name: string;
  phone: string;
  visitsCount: number;
  totalSpent: number;
  stampsEarned: number; // 0 to 5
  rewardEligible: boolean; // true if 5 stamps reached (6th coffee free)
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
  gstRatePercent: number; // 5%
  currencySymbol: string;
  currencyCode: string;
  openingHours: string;
  wifiSsid: string;
  wifiPassword: string;
  upiId: string;
}

