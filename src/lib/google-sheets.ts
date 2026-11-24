import { google } from 'googleapis';
import { Bill, OrderItem } from '@/types/database';
import { parseSheetDate } from '@/lib/date-utils';

export interface SheetOrderRow {
  order_id: string;
  date: string;
  time: string;
  table: string;
  customer_name: string;
  phone: string;
  items: string;
  subtotal: number;
  tax: number;
  total: number;
  payment_mode: string;
  status: string;
  completed_at: string;
  visit_no: number;
  free_visit: string;
}

export interface SheetOrderItemRow {
  order_id: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
  is_free: boolean;
}

export interface SheetCustomerRow {
  phone: string;
  name: string;
  visit_count: number;
  first_visit: string;
  last_visit: string;
  total_spent: number;
}

const ORDERS_HEADERS = [
  'order_id',
  'date',
  'time',
  'table',
  'customer_name',
  'phone',
  'items',
  'subtotal',
  'tax',
  'total',
  'payment_mode',
  'status',
  'completed_at',
  'visit_no',
  'free_visit',
];

const ORDER_ITEMS_HEADERS = ['order_id', 'item_name', 'qty', 'rate', 'amount', 'is_free'];

const CUSTOMERS_HEADERS = [
  'phone',
  'name',
  'visit_count',
  'first_visit',
  'last_visit',
  'total_spent',
];

const AUDIT_HEADERS = ['timestamp', 'action', 'actor', 'entity_type', 'entity_id', 'title', 'details'];

function resolveSpreadsheetId(customSheetId?: string | null): string | null {
  const id = (customSheetId || process.env.GOOGLE_SHEET_ID || '').trim();
  if (!id || id === 'placeholder-sheet-id') return null;
  return id;
}

/**
 * Normalizes Google Service Account private key supporting all env serialization styles:
 * raw PEM, quoted PEM, escaped newlines (\n or \\n), single-line, and standard PKCS8.
 */
export function normalizePrivateKey(rawKey: string): string {
  if (!rawKey) return '';

  let key = rawKey.trim();

  // Strip all leading and trailing quotes (single, double, backtick, escaped quotes)
  while (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'")) ||
    (key.startsWith('`') && key.endsWith('`')) ||
    (key.startsWith('\\"') && key.endsWith('\\"'))
  ) {
    if (key.startsWith('\\"') && key.endsWith('\\"')) {
      key = key.slice(2, -2).trim();
    } else {
      key = key.slice(1, -1).trim();
    }
  }

  // Normalize all newline variants
  key = key.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  key = key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');

  // If PEM headers are present, reliably reconstruct standard 64-char-line PEM format
  const headerMatch = key.match(/-----BEGIN [A-Z\s]+PRIVATE KEY-----/);
  const footerMatch = key.match(/-----END [A-Z\s]+PRIVATE KEY-----/);

  if (headerMatch && footerMatch) {
    const header = headerMatch[0];
    const footer = footerMatch[0];

    const startIndex = key.indexOf(header) + header.length;
    const endIndex = key.indexOf(footer);
    const body = key.substring(startIndex, endIndex);

    // Strip whitespace, newlines, and escaping backslashes from the base64 body
    const cleanBase64 = body.replace(/[\s\r\n\\]/g, '');

    // Split base64 into standard 64-character lines
    const chunks = cleanBase64.match(/.{1,64}/g) || [];

    return `${header}\n${chunks.join('\n')}\n${footer}\n`;
  }

  return key;
}

/**
 * Initializes and returns the authenticated Google Sheets API client
 * using the Service Account credentials from environment variables.
 */
export function getSheetsClient() {
  const rawEmail =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_CLIENT_EMAIL ||
    process.env.GOOGLE_EMAIL ||
    '';

  const rawKey =
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    process.env.GOOGLE_PRIVATE_KEY ||
    process.env.GOOGLE_SHEETS_PRIVATE_KEY ||
    '';

  const clientEmail = rawEmail.trim().replace(/^["']|["']$/g, '');
  const privateKey = normalizePrivateKey(rawKey);

  if (!clientEmail || !privateKey) {
    throw new Error('Google Service Account credentials missing in environment.');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * Parses a row from the Orders tab supporting both 15-col and legacy 13-col layouts.
 */
function parseOrderRow(r: string[]): SheetOrderRow {
  const colG = (r[6] ?? '').toString().trim();
  const isLegacy13Col = r.length <= 13 && colG !== '' && !isNaN(Number(colG));
  if (isLegacy13Col) {
    const date = (r[1] || '').toString();
    const time = (r[2] || '').toString();
    return {
      order_id: (r[0] || '').toString().trim(),
      date,
      time,
      table: (r[3] || '').toString(),
      customer_name: (r[4] || '').toString(),
      phone: (r[5] || '').toString(),
      items: '',
      subtotal: Number(r[6]) || 0,
      tax: Number(r[7]) || 0,
      total: Number(r[8]) || 0,
      payment_mode: (r[9] || 'COUNTER').toString(),
      status: 'COMPLETED',
      completed_at: `${date} ${time}`.trim(),
      visit_no: Number(r[10]) || 1,
      free_visit: (r[11] || 'NO').toString(),
    };
  }

  return {
    order_id: (r[0] || '').toString().trim(),
    date: (r[1] || '').toString(),
    time: (r[2] || '').toString(),
    table: (r[3] || '').toString(),
    customer_name: (r[4] || '').toString(),
    phone: (r[5] || '').toString(),
    items: (r[6] || '').toString(),
    subtotal: Number(r[7]) || 0,
    tax: Number(r[8]) || 0,
    total: Number(r[9]) || 0,
    payment_mode: (r[10] || 'COUNTER').toString(),
    status: (r[11] || 'COMPLETED').toString(),
    completed_at: (r[12] || '').toString(),
    visit_no: Number(r[13]) || 1,
    free_visit: (r[14] || 'NO').toString(),
  };
}

function parseOrderSortTimestamp(o: { completed_at?: string; date?: string; time?: string }): number {
  const candidates = [o.completed_at, `${o.date || ''} ${o.time || ''}`.trim(), o.date];
  for (const c of candidates) {
    const parsed = parseSheetDate(c);
    if (parsed) return parsed.getTime();
  }
  return 0;
}

const initializedTabsAt = new Map<string, number>();
const TABS_INIT_TTL_MS = 5 * 60 * 1000;

/**
 * Ensures required tabs ('Orders', 'OrderItems', 'Customers', 'AuditLog') exist with canonical headers.
 * Safely upgrades header rows on empty tabs (<= 1 row) if legacy columns are present.
 * Cached briefly per spreadsheetId to avoid redundant Sheets API metadata calls on every request.
 */
export async function initializeSheetTabs(spreadsheetId: string, force = false) {
  const lastChecked = initializedTabsAt.get(spreadsheetId) || 0;
  if (!force && Date.now() - lastChecked < TABS_INIT_TTL_MS) {
    return;
  }

  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = meta.data.sheets?.map(s => s.properties?.title || '') || [];

  const requiredTabs = ['Orders', 'OrderItems', 'Customers', 'AuditLog'];
  const tabsToCreate = requiredTabs.filter(t => !existingTitles.includes(t));

  if (tabsToCreate.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: tabsToCreate.map(title => ({
          addSheet: { properties: { title } },
        })),
      },
    });
  }

  const ensureHeader = async (tab: string, range: string, headers: string[], forceUpgradeIfEmpty = false) => {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A1:O2`,
    });
    const rows = existing.data.values || [];
    const headerRow = rows[0] || [];
    const hasDataRows = rows.length > 1;

    const needsWrite =
      rows.length === 0 ||
      headerRow.length === 0 ||
      (forceUpgradeIfEmpty && !hasDataRows && headerRow.join('|') !== headers.join('|'));

    if (needsWrite) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });
    }
  };

  await Promise.all([
    ensureHeader('Orders', 'Orders!A1:O1', ORDERS_HEADERS, true),
    ensureHeader('OrderItems', 'OrderItems!A1:F1', ORDER_ITEMS_HEADERS, true),
    ensureHeader('Customers', 'Customers!A1:F1', CUSTOMERS_HEADERS, true),
    ensureHeader('AuditLog', 'AuditLog!A1:G1', AUDIT_HEADERS, true),
  ]);

  initializedTabsAt.set(spreadsheetId, Date.now());
}

/**
 * Deletes rows matching a predicate (0-based data row index including header row at index 0;
 * header row 0 is always protected). Deletes bottom-to-top to keep sheet indices valid.
 */
async function deleteRowsByPredicate(
  spreadsheetId: string,
  tabName: string,
  readRange: string,
  shouldDelete: (row: string[], rowIndexZeroBased: number) => boolean
): Promise<number> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const targetSheet = meta.data.sheets?.find(s => s.properties?.title === tabName);
  const sheetId = targetSheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) return 0;

  const valRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: readRange });
  const rows = (valRes.data.values as string[][]) || [];
  const indicesToDelete: number[] = [];

  for (let i = 1; i < rows.length; i++) {
    if (shouldDelete(rows[i] || [], i)) {
      indicesToDelete.push(i);
    }
  }

  if (indicesToDelete.length === 0) return 0;

  // Build contiguous bottom-to-top deleteDimension ranges for fast single-batch deletion
  indicesToDelete.sort((a, b) => b - a);
  const requests: Array<{
    deleteDimension: {
      range: { sheetId: number; dimension: 'ROWS'; startIndex: number; endIndex: number };
    };
  }> = [];

  let rangeEnd = indicesToDelete[0] + 1;
  let rangeStart = indicesToDelete[0];

  for (let k = 1; k < indicesToDelete.length; k++) {
    const idx = indicesToDelete[k];
    if (idx === rangeStart - 1) {
      rangeStart = idx;
    } else {
      requests.push({
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rangeStart, endIndex: rangeEnd },
        },
      });
      rangeEnd = idx + 1;
      rangeStart = idx;
    }
  }
  requests.push({
    deleteDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex: rangeStart, endIndex: rangeEnd },
    },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  return indicesToDelete.length;
}

/**
 * Generates the next unique daily invoice counter for a prefix+date directly from Google Sheets.
 */
export async function getNextDailyOrderSequenceFromSheet(
  prefix: string,
  dateStr: string,
  customSheetId?: string | null
): Promise<string> {
  const spreadsheetId = resolveSpreadsheetId(customSheetId);
  if (!spreadsheetId) return '0001';

  try {
    const sheets = getSheetsClient();
    await initializeSheetTabs(spreadsheetId);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Orders!A:A',
    });
    const rows = res.data.values || [];
    const expectedPrefix = `${prefix}${dateStr}-`.toLowerCase();
    let maxSeq = 0;

    for (let i = 1; i < rows.length; i++) {
      const id = (rows[i]?.[0] || '').toString().trim().toLowerCase();
      if (id.startsWith(expectedPrefix)) {
        const suffix = parseInt(id.slice(expectedPrefix.length), 10);
        if (!isNaN(suffix) && suffix > maxSeq) maxSeq = suffix;
      }
    }

    return String(maxSeq + 1).padStart(4, '0');
  } catch (err) {
    console.warn('Error computing daily sequence from Google Sheets:', err);
    return String(Math.floor(1000 + Math.random() * 9000));
  }
}

/**
 * Reads all completed orders directly from the Google Sheets Orders tab.
 */
export async function readOrdersFromSheet(
  customSheetId?: string | null
): Promise<{ success: boolean; orders: SheetOrderRow[]; error?: string }> {
  const spreadsheetId = resolveSpreadsheetId(customSheetId);
  if (!spreadsheetId) {
    return { success: false, orders: [], error: 'Google Sheet ID is not configured.' };
  }

  try {
    const sheets = getSheetsClient();
    await initializeSheetTabs(spreadsheetId);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Orders!A:O',
    });
    const rows = (res.data.values as string[][]) || [];
    const orders: SheetOrderRow[] = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      orders.push(parseOrderRow(r));
    }

    orders.sort((a, b) => parseOrderSortTimestamp(b) - parseOrderSortTimestamp(a));
    return { success: true, orders };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to read Orders from Google Sheets.';
    console.error('readOrdersFromSheet error:', msg);
    return { success: false, orders: [], error: msg };
  }
}

/**
 * Reads all line items directly from the Google Sheets OrderItems tab.
 */
export async function readOrderItemsFromSheet(
  customSheetId?: string | null
): Promise<{ success: boolean; items: SheetOrderItemRow[]; error?: string }> {
  const spreadsheetId = resolveSpreadsheetId(customSheetId);
  if (!spreadsheetId) {
    return { success: false, items: [], error: 'Google Sheet ID is not configured.' };
  }

  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'OrderItems!A:F',
    });
    const rows = (res.data.values as string[][]) || [];
    const items: SheetOrderItemRow[] = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      items.push({
        order_id: (r[0] || '').toString().trim(),
        item_name: (r[1] || 'Menu Item').toString(),
        qty: Number(r[2]) || 1,
        rate: Number(r[3]) || 0,
        amount: Number(r[4]) || 0,
        is_free: (r[5] || '').toString().toUpperCase() === 'YES',
      });
    }

    return { success: true, items };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to read OrderItems from Google Sheets.';
    console.error('readOrderItemsFromSheet error:', msg);
    return { success: false, items: [], error: msg };
  }
}

/**
 * Reads all customers directly from the Google Sheets Customers tab.
 */
export async function readCustomersFromSheet(
  customSheetId?: string | null
): Promise<{ success: boolean; customers: SheetCustomerRow[]; error?: string }> {
  const spreadsheetId = resolveSpreadsheetId(customSheetId);
  if (!spreadsheetId) {
    return { success: false, customers: [], error: 'Google Sheet ID is not configured.' };
  }

  try {
    const sheets = getSheetsClient();
    await initializeSheetTabs(spreadsheetId);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Customers!A:F',
    });
    const rows = (res.data.values as string[][]) || [];
    const customers: SheetCustomerRow[] = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      customers.push({
        phone: (r[0] || '').toString().trim(),
        name: (r[1] || 'Valued Customer').toString(),
        visit_count: Number(r[2]) || 1,
        first_visit: (r[3] || '').toString(),
        last_visit: (r[4] || '').toString(),
        total_spent: Number(r[5]) || 0,
      });
    }

    customers.sort((a, b) => {
      const timeA = parseSheetDate(a.last_visit)?.getTime() || 0;
      const timeB = parseSheetDate(b.last_visit)?.getTime() || 0;
      return timeB - timeA;
    });

    return { success: true, customers };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to read Customers from Google Sheets.';
    console.error('readCustomersFromSheet error:', msg);
    return { success: false, customers: [], error: msg };
  }
}

/**
 * Looks up a customer in the Google Sheet by reading ONLY the phone column (Customers!A:A).
 * If found, fetches that specific single row to retrieve previous visit count, name, and total spent.
 */
export async function lookupCustomerPhoneInSheet(
  phone: string,
  customSheetId?: string | null
): Promise<{
  found: boolean;
  rowIndex?: number;
  phone: string;
  name?: string;
  previousVisits: number;
  firstVisit?: string;
  lastVisit?: string;
  freeRedeemed?: number;
  totalSpent?: number;
}> {
  const spreadsheetId = resolveSpreadsheetId(customSheetId);
  if (!spreadsheetId) {
    return { found: false, phone, previousVisits: 0, totalSpent: 0 };
  }

  const sheets = getSheetsClient();
  const cleanTarget = phone.replace(/\D/g, '').slice(-10);

  try {
    const phoneColRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Customers!A:A',
    });

    const rows = phoneColRes.data.values || [];
    let matchedRowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
      const cell = (rows[i]?.[0] || '').toString().trim();
      const cleanCell = cell.replace(/\D/g, '').slice(-10);
      if (cell === phone || (cleanTarget && cleanCell === cleanTarget)) {
        matchedRowIndex = i + 1; // 1-based index in sheets
        break;
      }
    }

    if (matchedRowIndex === -1) {
      return { found: false, phone, previousVisits: 0, totalSpent: 0 };
    }

    const rowRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `Customers!A${matchedRowIndex}:F${matchedRowIndex}`,
    });

    const rowData = rowRes.data.values?.[0] || [];
    return {
      found: true,
      rowIndex: matchedRowIndex,
      phone: rowData[0] || phone,
      name: rowData[1] || '',
      previousVisits: Number(rowData[2]) || 0,
      firstVisit: rowData[3] || '',
      lastVisit: rowData[4] || '',
      totalSpent: Number(rowData[5]) || 0,
    };
  } catch (err) {
    console.warn('Error reading phone column from Customers tab:', err);
    return { found: false, phone, previousVisits: 0, totalSpent: 0 };
  }
}

/**
 * Searches for a single invoice in the Google Sheet Orders tab by order_id or phone number.
 */
export async function searchInvoiceInSheet(
  query: string,
  customSheetId?: string | null
): Promise<{
  found: boolean;
  bill?: Bill;
  items?: OrderItem[];
  source?: 'google_sheets';
}> {
  const result = await searchAllCustomerInvoicesFromSheet(query, customSheetId);
  if (!result.found || result.invoices.length === 0) {
    return { found: false };
  }
  return {
    found: true,
    source: 'google_sheets',
    bill: result.invoices[0].bill,
    items: result.invoices[0].items,
  };
}

/**
 * Searches all historical orders and customer stats in Google Sheets by phone, order_id, or name.
 */
export async function searchAllCustomerInvoicesFromSheet(
  query: string,
  customSheetId?: string | null
): Promise<{
  found: boolean;
  customer?: {
    name: string;
    phone: string;
    totalVisits: number;
    totalSpent: number;
    firstVisit?: string;
    lastVisit?: string;
    freeRedeemed?: number;
  };
  invoices: Array<{
    bill: Bill;
    items: OrderItem[];
    source: 'google_sheets';
  }>;
}> {
  const spreadsheetId = resolveSpreadsheetId(customSheetId);
  if (!spreadsheetId) {
    return { found: false, invoices: [] };
  }

  const trimmed = query.trim();
  const queryLower = trimmed.toLowerCase();
  const digitsOnly = trimmed.replace(/\D/g, '');
  const cleanPhone =
    digitsOnly.length > 10 && digitsOnly.startsWith('91') ? digitsOnly.slice(2) : digitsOnly;

  try {
    const [customersRes, ordersRes] = await Promise.all([
      readCustomersFromSheet(spreadsheetId),
      readOrdersFromSheet(spreadsheetId),
    ]);

    let customerProfile:
      | {
          name: string;
          phone: string;
          totalVisits: number;
          totalSpent: number;
          firstVisit?: string;
          lastVisit?: string;
          freeRedeemed?: number;
        }
      | undefined;

    if (customersRes.success) {
      const matchedCust = customersRes.customers.find(c => {
        const phoneDigits = c.phone.replace(/\D/g, '');
        return (
          (cleanPhone.length >= 7 && phoneDigits.includes(cleanPhone)) ||
          (queryLower.length >= 3 && c.name.toLowerCase().includes(queryLower))
        );
      });

      if (matchedCust) {
        customerProfile = {
          phone: matchedCust.phone || cleanPhone,
          name: matchedCust.name || 'Guest',
          totalVisits: matchedCust.visit_count,
          totalSpent: matchedCust.total_spent,
          firstVisit: matchedCust.first_visit,
          lastVisit: matchedCust.last_visit,
          freeRedeemed: 0,
        };
      }
    }

    const matchedOrders = ordersRes.orders.filter(ord => {
      const phone = ord.phone.replace(/\D/g, '');
      return (
        (trimmed && ord.order_id.toLowerCase().includes(queryLower)) ||
        (cleanPhone.length >= 7 && phone.includes(cleanPhone)) ||
        (queryLower.length >= 3 && ord.customer_name.toLowerCase().includes(queryLower))
      );
    });

    if (matchedOrders.length === 0 && !customerProfile) {
      return { found: false, invoices: [] };
    }

    const itemsByOrderId = new Map<string, OrderItem[]>();
    if (matchedOrders.length > 0) {
      const itemsRes = await readOrderItemsFromSheet(spreadsheetId);
      if (itemsRes.success) {
        for (let i = 0; i < itemsRes.items.length; i++) {
          const it = itemsRes.items[i];
          const key = it.order_id.toLowerCase();
          if (!itemsByOrderId.has(key)) itemsByOrderId.set(key, []);
          itemsByOrderId.get(key)!.push({
            id: `sheet-item-${i}-${it.order_id}`,
            order_id: it.order_id,
            item_id: `item-${i}`,
            item_name_en: it.item_name,
            item_name_hi: '',
            price_per_unit: it.rate,
            quantity: it.qty,
            status: 'SERVED',
            item_notes: it.is_free ? 'Loyalty Free Reward' : null,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    let calculatedTotalSpent = 0;
    const reconstructedInvoices: Array<{
      bill: Bill;
      items: OrderItem[];
      source: 'google_sheets';
    }> = [];

    for (const ord of matchedOrders) {
      calculatedTotalSpent += ord.total;
      const ts = parseOrderSortTimestamp(ord);
      const billIsoDate = ts ? new Date(ts).toISOString() : new Date().toISOString();

      const bill: Bill = {
        id: `sheet-bill-${ord.order_id}`,
        invoice_number: ord.order_id,
        session_id: '00000000-0000-0000-0000-000000000000',
        table_id: '00000000-0000-0000-0000-000000000000',
        table_number: ord.table || 'Table',
        customer_name: ord.customer_name || 'Guest',
        customer_phone: ord.phone || 'N/A',
        subtotal: ord.subtotal,
        discount: 0,
        gst_rate: 5.0,
        gst_amount: ord.tax,
        total_amount: ord.total,
        visit_count: ord.visit_no || 1,
        is_loyalty_free_coffee: ord.free_visit.toUpperCase() === 'YES',
        synced_to_sheets: true,
        sheets_synced_at: billIsoDate,
        created_at: billIsoDate,
      };

      const billItems = itemsByOrderId.get(ord.order_id.toLowerCase()) || [];
      reconstructedInvoices.push({
        bill,
        items: billItems,
        source: 'google_sheets',
      });
    }

    const freeCount = matchedOrders.filter(o => o.free_visit.toUpperCase() === 'YES').length;
    if (customerProfile) {
      customerProfile.totalSpent = calculatedTotalSpent || customerProfile.totalSpent;
      customerProfile.freeRedeemed = freeCount;
      if (customerProfile.totalVisits === 0) {
        customerProfile.totalVisits = matchedOrders.length;
      }
    } else if (matchedOrders.length > 0) {
      const firstOrd = matchedOrders[0];
      const oldestOrd = matchedOrders[matchedOrders.length - 1];
      customerProfile = {
        phone: firstOrd.phone || cleanPhone,
        name: firstOrd.customer_name || 'Guest',
        totalVisits: Math.max(...matchedOrders.map(o => o.visit_no || 1), matchedOrders.length),
        totalSpent: calculatedTotalSpent,
        firstVisit: oldestOrd.completed_at || oldestOrd.date,
        lastVisit: firstOrd.completed_at || firstOrd.date,
        freeRedeemed: freeCount,
      };
    }

    return {
      found: true,
      customer: customerProfile,
      invoices: reconstructedInvoices,
    };
  } catch (err) {
    console.warn('Error in searchAllCustomerInvoicesFromSheet:', err);
    return { found: false, invoices: [] };
  }
}

/**
 * Syncs billed order details to Google Sheets (Orders, OrderItems, and Customers tabs).
 */
export async function syncBillToGoogleSheets(
  bill: Bill,
  items: OrderItem[],
  customSheetId?: string | null,
  paymentMode?: string,
  freeCoffeeItemId?: string
): Promise<{ success: boolean; reason?: string; error?: string }> {
  const spreadsheetId = resolveSpreadsheetId(customSheetId);
  if (!spreadsheetId) {
    return { success: false, reason: 'Google Sheet ID not configured' };
  }

  try {
    const sheets = getSheetsClient();
    await initializeSheetTabs(spreadsheetId);

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const timeFormatted = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
    const time24Formatted = now.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
    });
    const nowFormatted = `${dateFormatted} ${time24Formatted}`;

    // Group identical item names across multiple orders in the same table session
    const aggregatedItems = new Map<
      string,
      { itemName: string; qty: number; rate: number; amount: number; isFree: boolean }
    >();
    for (const item of items || []) {
      const displayName = item.item_name_en.trim() || 'Menu Item';
      const key = displayName.toLowerCase();
      const isFreeLine = freeCoffeeItemId === item.id;
      const rawAmt = (Number(item.price_per_unit) || 0) * (Number(item.quantity) || 1);
      const freeDiscount = isFreeLine ? Math.min(rawAmt, Number(item.price_per_unit) || 0) : 0;
      const paidAmt = Math.max(0, rawAmt - freeDiscount);

      const prev = aggregatedItems.get(key);
      if (prev) {
        prev.qty += Number(item.quantity) || 1;
        prev.amount += paidAmt;
        prev.isFree = prev.isFree || isFreeLine;
        prev.rate = prev.qty > 0 ? Math.round((prev.amount / prev.qty) * 100) / 100 : prev.rate;
      } else {
        aggregatedItems.set(key, {
          itemName: displayName,
          qty: Number(item.quantity) || 1,
          rate: isFreeLine && item.quantity === 1 ? 0 : Number(item.price_per_unit) || 0,
          amount: paidAmt,
          isFree: isFreeLine,
        });
      }
    }

    const groupedItemList = Array.from(aggregatedItems.values());
    const itemsSummaryText =
      groupedItemList.length > 0
        ? groupedItemList.map(it => `${it.qty}x ${it.itemName}`).join(', ')
        : 'Order Items';

    const orderRow = [
      bill.invoice_number,
      dateFormatted,
      timeFormatted,
      bill.table_number,
      bill.customer_name,
      bill.customer_phone,
      itemsSummaryText,
      bill.subtotal,
      bill.gst_amount,
      bill.total_amount,
      paymentMode ? paymentMode.toUpperCase() : 'COUNTER',
      'COMPLETED',
      nowFormatted,
      bill.visit_count,
      bill.is_loyalty_free_coffee ? 'YES' : 'NO',
    ];

    let matchedOrderRowIndex = -1;
    const targetOrderId = (bill.invoice_number || '').trim().toLowerCase();

    const ordersRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Orders!A:A',
    });
    const orderRows = ordersRes.data.values || [];

    for (let i = 1; i < orderRows.length; i++) {
      const oId = (orderRows[i]?.[0] || '').toString().trim().toLowerCase();
      if (oId === targetOrderId) {
        matchedOrderRowIndex = i + 1;
        break;
      }
    }

    if (matchedOrderRowIndex !== -1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Orders!A${matchedOrderRowIndex}:O${matchedOrderRowIndex}`,
        valueInputOption: 'RAW',
        requestBody: { values: [orderRow] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Orders!A:O',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [orderRow] },
      });
    }

    // Sync OrderItems deduplicating strictly by (order_id AND item_name), batching appends in 1 API call
    if (groupedItemList.length > 0) {
      const itemsRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'OrderItems!A:F',
      });
      const existingItemRows = (itemsRes.data.values as string[][]) || [];
      const rowsToAppend: Array<[string, string, number, number, number, string]> = [];

      for (const item of groupedItemList) {
        const targetName = item.itemName.toLowerCase();
        let matchedItemRowIndex = -1;

        for (let r = 1; r < existingItemRows.length; r++) {
          const row = existingItemRows[r];
          if (
            row &&
            row[0] &&
            row[1] &&
            row[0].trim().toLowerCase() === targetOrderId &&
            row[1].trim().toLowerCase() === targetName
          ) {
            matchedItemRowIndex = r + 1;
            break;
          }
        }

        if (matchedItemRowIndex !== -1) {
          const existingRow = existingItemRows[matchedItemRowIndex - 1];
          const updatedRow = [
            bill.invoice_number,
            item.itemName,
            item.qty,
            item.rate,
            item.amount,
            item.isFree ? 'YES' : existingRow[5] || 'NO',
          ];

          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `OrderItems!A${matchedItemRowIndex}:F${matchedItemRowIndex}`,
            valueInputOption: 'RAW',
            requestBody: { values: [updatedRow] },
          });
        } else {
          rowsToAppend.push([
            bill.invoice_number,
            item.itemName,
            item.qty,
            item.rate,
            item.amount,
            item.isFree ? 'YES' : 'NO',
          ]);
        }
      }

      if (rowsToAppend.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'OrderItems!A:F',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: rowsToAppend },
        });
      }
    }

    // Update or Append Customers tab
    if (bill.customer_phone && bill.customer_phone !== 'N/A') {
      const existing = await lookupCustomerPhoneInSheet(bill.customer_phone, spreadsheetId);
      const firstVisit = existing.firstVisit || nowFormatted;
      const prevTotalSpent = existing.totalSpent || 0;
      const updatedTotalSpent = prevTotalSpent + (Number(bill.total_amount) || 0);

      if (existing.found && existing.rowIndex) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Customers!A${existing.rowIndex}:F${existing.rowIndex}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              [
                bill.customer_phone,
                bill.customer_name || existing.name || 'Valued Customer',
                bill.visit_count,
                firstVisit,
                nowFormatted,
                updatedTotalSpent,
              ],
            ],
          },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Customers!A:F',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [
              [
                bill.customer_phone,
                bill.customer_name || 'Valued Customer',
                bill.visit_count || 1,
                nowFormatted,
                nowFormatted,
                Number(bill.total_amount) || 0,
              ],
            ],
          },
        });
      }
    }

    return { success: true };
  } catch (err: unknown) {
    initializedTabsAt.delete(spreadsheetId);
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Failed to sync to Google Sheets:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Deletes an order from Orders and OrderItems tabs in Google Sheets.
 */
export async function deleteOrderFromSheet(
  orderId: string,
  customSheetId?: string | null
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  const spreadsheetId = resolveSpreadsheetId(customSheetId);
  if (!spreadsheetId) {
    return { success: false, deletedCount: 0, error: 'Google Sheet ID is not configured.' };
  }

  const target = orderId.trim().toLowerCase();
  if (!target) {
    return { success: false, deletedCount: 0, error: 'Order ID is required.' };
  }

  try {
    const deletedOrders = await deleteRowsByPredicate(
      spreadsheetId,
      'Orders',
      'Orders!A:A',
      row => (row[0] || '').toString().trim().toLowerCase() === target
    );

    await deleteRowsByPredicate(
      spreadsheetId,
      'OrderItems',
      'OrderItems!A:A',
      row => (row[0] || '').toString().trim().toLowerCase() === target
    );

    return { success: true, deletedCount: deletedOrders };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, deletedCount: 0, error: msg };
  }
}

/**
 * Clears all order data rows (preserving Row 1 headers) from Orders and OrderItems tabs.
 */
export async function deleteAllOrdersFromSheet(
  customSheetId?: string | null
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  const spreadsheetId = resolveSpreadsheetId(customSheetId);
  if (!spreadsheetId) {
    return { success: false, deletedCount: 0, error: 'Google Sheet ID is not configured.' };
  }

  try {
    const deletedOrders = await deleteRowsByPredicate(spreadsheetId, 'Orders', 'Orders!A:A', () => true);
    await deleteRowsByPredicate(spreadsheetId, 'OrderItems', 'OrderItems!A:A', () => true);
    return { success: true, deletedCount: deletedOrders };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, deletedCount: 0, error: msg };
  }
}

/**
 * Deletes a customer row from Customers tab in Google Sheets by phone.
 */
export async function deleteCustomerFromSheet(
  phone: string,
  customSheetId?: string | null
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  const spreadsheetId = resolveSpreadsheetId(customSheetId);
  if (!spreadsheetId) {
    return { success: false, deletedCount: 0, error: 'Google Sheet ID is not configured.' };
  }

  const targetRaw = phone.trim().toLowerCase();
  const targetDigits = phone.replace(/\D/g, '').slice(-10);

  try {
    const deletedCount = await deleteRowsByPredicate(
      spreadsheetId,
      'Customers',
      'Customers!A:A',
      row => {
        const cellRaw = (row[0] || '').toString().trim().toLowerCase();
        const cellDigits = cellRaw.replace(/\D/g, '').slice(-10);
        return cellRaw === targetRaw || (Boolean(targetDigits) && cellDigits === targetDigits);
      }
    );

    return { success: true, deletedCount };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, deletedCount: 0, error: msg };
  }
}

/**
 * Clears all customer rows (preserving Row 1 headers) from Customers tab.
 */
export async function deleteAllCustomersFromSheet(
  customSheetId?: string | null
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  const spreadsheetId = resolveSpreadsheetId(customSheetId);
  if (!spreadsheetId) {
    return { success: false, deletedCount: 0, error: 'Google Sheet ID is not configured.' };
  }

  try {
    const deletedCount = await deleteRowsByPredicate(spreadsheetId, 'Customers', 'Customers!A:A', () => true);
    return { success: true, deletedCount };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, deletedCount: 0, error: msg };
  }
}

/**
 * Appends a row to the AuditLog tab in the Google Sheet.
 */
export async function appendAuditLogToSheet(
  entry: {
    timestamp: string;
    action: string;
    actor: string;
    entity_type: string;
    entity_id: string;
    title: string;
    details: Record<string, unknown>;
  },
  customSheetId?: string | null
): Promise<boolean> {
  const spreadsheetId = resolveSpreadsheetId(customSheetId);
  if (!spreadsheetId) return false;

  try {
    const sheets = getSheetsClient();
    await initializeSheetTabs(spreadsheetId);

    const row = [
      entry.timestamp,
      entry.action,
      entry.actor,
      entry.entity_type,
      entry.entity_id,
      entry.title,
      JSON.stringify(entry.details),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'AuditLog!A:G',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    return true;
  } catch (err) {
    initializedTabsAt.delete(spreadsheetId);
    console.warn('Google Sheets appendAuditLogToSheet error:', err);
    return false;
  }
}

/**
 * Reads all audit log rows from the AuditLog tab in the Google Sheet.
 */
export async function readAuditLogsFromSheet(customSheetId?: string | null): Promise<{
  success: boolean;
  logs: Array<{
    id: string;
    timestamp: string;
    action: string;
    actor_email: string;
    entity_type: string;
    entity_id: string;
    title: string;
    details: Record<string, unknown>;
  }>;
  error?: string;
}> {
  const spreadsheetId = resolveSpreadsheetId(customSheetId);
  if (!spreadsheetId) {
    return { success: false, logs: [], error: 'Google Sheet ID is not configured.' };
  }

  try {
    const sheets = getSheetsClient();
    await initializeSheetTabs(spreadsheetId);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'AuditLog!A2:G',
    });

    const rows = (res.data.values as string[][]) || [];
    const logs = rows
      .filter(row => row && row[0])
      .map((row, idx) => {
        let parsedDetails: Record<string, unknown> = {};
        try {
          if (row[6]) parsedDetails = JSON.parse(row[6]);
        } catch {
          // ignore invalid json
        }

        return {
          id: `sheet-audit-${idx}-${row[0] || ''}`,
          timestamp: row[0] || new Date().toISOString(),
          action: row[1] || 'UNKNOWN',
          actor_email: row[2] || 'manager',
          entity_type: row[3] || 'general',
          entity_id: row[4] || '',
          title: row[5] || '',
          details: parsedDetails,
        };
      });

    return { success: true, logs };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('Google Sheets readAuditLogsFromSheet error:', msg);
    return { success: false, logs: [], error: msg };
  }
}

/**
 * Deletes an audit log entry by timestamp/entity_id or clears all audit log data rows.
 */
export async function deleteAuditLogFromSheet(
  params: { timestamp?: string; entity_id?: string; clearAll?: boolean },
  customSheetId?: string | null
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  const spreadsheetId = resolveSpreadsheetId(customSheetId);
  if (!spreadsheetId) {
    return { success: false, deletedCount: 0, error: 'Google Sheet ID is not configured.' };
  }

  try {
    const deletedCount = await deleteRowsByPredicate(
      spreadsheetId,
      'AuditLog',
      'AuditLog!A:E',
      row => {
        if (params.clearAll) return true;
        const tsMatch = Boolean(params.timestamp) && (row[0] || '').trim() === params.timestamp?.trim();
        const entMatch = !params.entity_id || (row[4] || '').trim() === params.entity_id.trim();
        return tsMatch && entMatch;
      }
    );

    return { success: true, deletedCount };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, deletedCount: 0, error: msg };
  }
}
