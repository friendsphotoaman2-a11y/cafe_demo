import { google } from 'googleapis';
import { Bill, OrderItem } from '@/types/database';

/**
 * Initializes and returns the authenticated Google Sheets API client
 * using the Service Account credentials from environment variables.
 */
export function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Handle escaped newlines in private key string
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

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
 * Looks up a customer in the Google Sheet by reading ONLY the phone column (Customers!A:A).
 * If found, fetches that specific single row to retrieve previous visit count, name, and loyalty data.
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
  const spreadsheetId = customSheetId || process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId || spreadsheetId === 'placeholder-sheet-id') {
    return { found: false, phone, previousVisits: 0, totalSpent: 0 };
  }

  const sheets = getSheetsClient();
  try {
    // Read ONLY the phone column (Customers!A:A)
    const phoneColRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Customers!A:A',
    });

    const rows = phoneColRes.data.values || [];
    let matchedRowIndex = -1;

    // Row 0 is header ('phone')
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && rows[i][0] && rows[i][0].toString().trim() === phone) {
        matchedRowIndex = i + 1; // 1-based index in sheets
        break;
      }
    }

    if (matchedRowIndex === -1) {
      return { found: false, phone, previousVisits: 0, totalSpent: 0 };
    }

    // Read only the matched single row (Customers!A{row}:F{row})
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
      freeRedeemed: Number(rowData[5]) || 0,
      totalSpent: Number(rowData[5]) || 0,
    };
  } catch (err) {
    console.warn('Error reading phone column from Customers tab:', err);
    return { found: false, phone, previousVisits: 0, totalSpent: 0 };
  }
}

/**
 * Searches for an invoice in the Google Sheet Orders tab by order_id or phone number.
 * If found, fetches its associated line items from the OrderItems tab.
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
  const spreadsheetId = customSheetId || process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId || spreadsheetId === 'placeholder-sheet-id') {
    return { found: false };
  }

  const sheets = getSheetsClient();
  const trimmed = query.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');
  const cleanPhone =
    digitsOnly.length > 10 && digitsOnly.startsWith('91') ? digitsOnly.slice(2) : digitsOnly;

  try {
    // 1. Fetch Orders tab rows (range: Orders!A:M)
    const ordersRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Orders!A:M',
    });

    const orders = ordersRes.data.values || [];
    let matchedOrder: string[] | null = null;

    // Row 0 is headers
    for (let i = 1; i < orders.length; i++) {
      const row = orders[i];
      if (!row || row.length === 0) continue;
      const orderId = (row[0] || '').toString().trim();
      const phone = (row[5] || '').toString().replace(/\D/g, '');

      // Match by order ID (case-insensitive) or by 10-digit phone number
      if (
        orderId.toLowerCase() === trimmed.toLowerCase() ||
        (cleanPhone.length >= 10 && phone.includes(cleanPhone))
      ) {
        matchedOrder = row;
        break;
      }
    }

    if (!matchedOrder) {
      return { found: false };
    }

    const orderId = matchedOrder[0];

    // 2. Fetch OrderItems for this order_id (range: OrderItems!A:F)
    const itemsRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'OrderItems!A:F',
    });

    const allItemRows = itemsRes.data.values || [];
    const matchedItemRows = allItemRows.filter(
      (r, idx) => idx > 0 && r[0] && r[0].toString().trim() === orderId
    );

    const items: OrderItem[] = matchedItemRows.map((r, idx) => ({
      id: `sheet-item-${idx}-${r[0]}`,
      order_id: r[0],
      item_id: `item-${idx}`,
      item_name_en: r[1] || 'Menu Item',
      item_name_hi: '',
      price_per_unit: Number(r[3]) || 0,
      quantity: Number(r[2]) || 1,
      status: 'SERVED',
      item_notes: null,
      created_at: matchedOrder ? `${matchedOrder[1]}T00:00:00.000Z` : new Date().toISOString(),
    }));

    // Reconstruct Bill structure from Google Sheet row
    const reconstructedBill: Bill = {
      id: `sheet-bill-${orderId}`,
      invoice_number: orderId,
      session_id: '00000000-0000-0000-0000-000000000000',
      table_id: '00000000-0000-0000-0000-000000000000',
      table_number: matchedOrder[3] || 'Table',
      customer_name: matchedOrder[4] || 'Guest',
      customer_phone: matchedOrder[5] || 'N/A',
      subtotal: Number(matchedOrder[6]) || 0,
      discount: 0,
      gst_rate: 5.0,
      gst_amount: Number(matchedOrder[7]) || 0,
      total_amount: Number(matchedOrder[8]) || 0,
      visit_count: Number(matchedOrder[10]) || 1,
      is_loyalty_free_coffee: matchedOrder[11] === 'YES',
      synced_to_sheets: true,
      sheets_synced_at: new Date().toISOString(),
      created_at:
        matchedOrder[1] && matchedOrder[2]
          ? new Date(`${matchedOrder[1]} ${matchedOrder[2]}`).toISOString()
          : new Date().toISOString(),
    };

    return {
      found: true,
      source: 'google_sheets',
      bill: reconstructedBill,
      items,
    };
  } catch (err) {
    console.warn('Error searching invoice in Google Sheet:', err);
    return { found: false };
  }
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
  const spreadsheetId = customSheetId || process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId || spreadsheetId === 'placeholder-sheet-id') {
    return { found: false, invoices: [] };
  }

  const sheets = getSheetsClient();
  const trimmed = query.trim();
  const queryLower = trimmed.toLowerCase();
  const digitsOnly = trimmed.replace(/\D/g, '');
  const cleanPhone =
    digitsOnly.length > 10 && digitsOnly.startsWith('91') ? digitsOnly.slice(2) : digitsOnly;

  try {
    // 1. Fetch Customers tab to get customer profile
    let customerProfile: {
      name: string;
      phone: string;
      totalVisits: number;
      totalSpent: number;
      firstVisit?: string;
      lastVisit?: string;
      freeRedeemed?: number;
    } | undefined = undefined;

    try {
      const customersRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Customers!A:F',
      });
      const customerRows = customersRes.data.values || [];
      for (let i = 1; i < customerRows.length; i++) {
        const row = customerRows[i];
        if (!row || row.length === 0) continue;
        const phone = (row[0] || '').toString().replace(/\D/g, '');
        const name = (row[1] || '').toString().trim();

        if (
          (cleanPhone.length >= 7 && phone.includes(cleanPhone)) ||
          (queryLower.length >= 3 && name.toLowerCase().includes(queryLower))
        ) {
          customerProfile = {
            phone: row[0] || cleanPhone,
            name: row[1] || 'Guest',
            totalVisits: Number(row[2]) || 0,
            firstVisit: row[3] || '',
            lastVisit: row[4] || '',
            freeRedeemed: Number(row[5]) || 0,
            totalSpent: 0,
          };
          break;
        }
      }
    } catch (custErr) {
      console.warn('Error reading Customers tab in sheet search:', custErr);
    }

    // 2. Fetch Orders tab rows (range: Orders!A:M)
    const ordersRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Orders!A:M',
    });

    const orders = ordersRes.data.values || [];
    const matchedOrders: string[][] = [];

    // Row 0 is headers
    for (let i = 1; i < orders.length; i++) {
      const row = orders[i];
      if (!row || row.length === 0) continue;
      const orderId = (row[0] || '').toString().trim();
      const name = (row[4] || '').toString().trim();
      const phone = (row[5] || '').toString().replace(/\D/g, '');

      const isMatch =
        (trimmed && orderId.toLowerCase().includes(queryLower)) ||
        (cleanPhone.length >= 7 && phone.includes(cleanPhone)) ||
        (queryLower.length >= 3 && name.toLowerCase().includes(queryLower));

      if (isMatch) {
        matchedOrders.push(row);
      }
    }

    if (matchedOrders.length === 0 && !customerProfile) {
      return { found: false, invoices: [] };
    }

    // 3. Fetch OrderItems tab (range: OrderItems!A:F) if we have matched orders
    let allItemRows: string[][] = [];
    if (matchedOrders.length > 0) {
      try {
        const itemsRes = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: 'OrderItems!A:F',
        });
        allItemRows = itemsRes.data.values || [];
      } catch (itemsErr) {
        console.warn('Error reading OrderItems in searchAllCustomerInvoicesFromSheet:', itemsErr);
      }
    }

    // Map items by orderId
    const itemsByOrderId = new Map<string, OrderItem[]>();
    for (let i = 1; i < allItemRows.length; i++) {
      const r = allItemRows[i];
      if (!r || !r[0]) continue;
      const oId = r[0].toString().trim();
      if (!itemsByOrderId.has(oId)) {
        itemsByOrderId.set(oId, []);
      }
      const existingItems = itemsByOrderId.get(oId)!;
      existingItems.push({
        id: `sheet-item-${i}-${oId}`,
        order_id: oId,
        item_id: `item-${existingItems.length}`,
        item_name_en: r[1] || 'Menu Item',
        item_name_hi: '',
        price_per_unit: Number(r[3]) || 0,
        quantity: Number(r[2]) || 1,
        status: 'SERVED',
        item_notes: null,
        created_at: new Date().toISOString(),
      });
    }

    let calculatedTotalSpent = 0;
    const reconstructedInvoices: Array<{
      bill: Bill;
      items: OrderItem[];
      source: 'google_sheets';
    }> = [];

    for (const ord of matchedOrders) {
      const orderId = (ord[0] || '').toString().trim();
      const totalAmount = Number(ord[8]) || 0;
      calculatedTotalSpent += totalAmount;

      const billDateStr = ord[1] && ord[2] ? `${ord[1]} ${ord[2]}` : null;
      const billIsoDate = billDateStr && !isNaN(Date.parse(billDateStr))
        ? new Date(billDateStr).toISOString()
        : new Date().toISOString();

      const bill: Bill = {
        id: `sheet-bill-${orderId}`,
        invoice_number: orderId,
        session_id: '00000000-0000-0000-0000-000000000000',
        table_id: '00000000-0000-0000-0000-000000000000',
        table_number: ord[3] || 'Table',
        customer_name: ord[4] || 'Guest',
        customer_phone: ord[5] || 'N/A',
        subtotal: Number(ord[6]) || 0,
        discount: 0,
        gst_rate: 5.0,
        gst_amount: Number(ord[7]) || 0,
        total_amount: totalAmount,
        visit_count: Number(ord[10]) || 1,
        is_loyalty_free_coffee: ord[11] === 'YES',
        synced_to_sheets: true,
        sheets_synced_at: new Date().toISOString(),
        created_at: billIsoDate,
      };

      const billItems = itemsByOrderId.get(orderId) || [];
      reconstructedInvoices.push({
        bill,
        items: billItems,
        source: 'google_sheets',
      });
    }

    if (customerProfile) {
      customerProfile.totalSpent = calculatedTotalSpent;
      if (customerProfile.totalVisits === 0) {
        customerProfile.totalVisits = matchedOrders.length;
      }
    } else if (matchedOrders.length > 0) {
      const firstOrd = matchedOrders[0];
      customerProfile = {
        phone: firstOrd[5] || cleanPhone,
        name: firstOrd[4] || 'Guest',
        totalVisits: matchedOrders.length,
        totalSpent: calculatedTotalSpent,
        firstVisit: matchedOrders[matchedOrders.length - 1][1] || '',
        lastVisit: matchedOrders[0][1] || '',
        freeRedeemed: matchedOrders.filter(o => o[11] === 'YES').length,
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
 * Ensures required tabs ('Orders', 'OrderItems', 'Customers') exist in the spreadsheet with headers.
 */
export async function initializeSheetTabs(spreadsheetId: string) {
  const sheets = getSheetsClient();
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingTitles = meta.data.sheets?.map(s => s.properties?.title) || [];

    const tabsToCreate = ['Orders', 'OrderItems', 'Customers'].filter(
      t => !existingTitles.includes(t)
    );

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

    // Initialize headers if first row is empty
    if (!existingTitles.includes('Orders')) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Orders!A1:O1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [
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
            ],
          ],
        },
      });
    }

    if (!existingTitles.includes('OrderItems')) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'OrderItems!A1:F1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [
              'order_id',
              'item_name',
              'qty',
              'rate',
              'amount',
              'is_free',
            ],
          ],
        },
      });
    }

    if (!existingTitles.includes('Customers')) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Customers!A1:F1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [
              'phone',
              'name',
              'visit_count',
              'first_visit',
              'last_visit',
              'total_spent',
            ],
          ],
        },
      });
    }
  } catch (error) {
    console.error('Error ensuring Google Sheets tabs:', error);
  }
}

/**
 * Syncs billed order details to Google Sheets (Orders, OrderItems, and Customers tabs)
 */
export async function syncBillToGoogleSheets(
  bill: Bill,
  items: OrderItem[],
  customSheetId?: string | null,
  paymentMode?: string,
  freeCoffeeItemId?: string
) {
  const spreadsheetId = customSheetId || process.env.GOOGLE_SHEET_ID;

  if (!spreadsheetId || spreadsheetId === 'placeholder-sheet-id') {
    console.warn('Google Sheet ID not configured. Skipping Google Sheets sync.');
    return { success: false, reason: 'Google Sheet ID not configured' };
  }

  const sheets = getSheetsClient();

  try {
    // 1. Ensure sheet tabs exist
    await initializeSheetTabs(spreadsheetId);

    const now = new Date();
    const dateFormatted = now.toISOString().split('T')[0];
    const timeFormatted = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
    const nowFormatted = `${dateFormatted} ${timeFormatted}`;
    const itemsSummaryText = items && items.length > 0
      ? items.map(it => `${it.quantity}x ${it.item_name_en}`).join(', ')
      : 'Order Items';

    // 2. Update or Append Orders tab (deduplicate strictly by order_id)
    // Headers: order_id, date, time, table, customer_name, phone, items, subtotal, tax, total, payment_mode, status, completed_at, visit_no, free_visit
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

    try {
      const ordersRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Orders!A:A',
      });
      const orderRows = ordersRes.data.values || [];

      for (let i = 1; i < orderRows.length; i++) {
        const row = orderRows[i];
        if (!row || row.length === 0) continue;
        const oId = (row[0] || '').toString().trim().toLowerCase();

        if (oId === targetOrderId) {
          matchedOrderRowIndex = i + 1; // 1-based index
          break;
        }
      }
    } catch (orderReadErr) {
      console.warn('Error reading Orders tab for existing order_id:', orderReadErr);
    }

    if (matchedOrderRowIndex !== -1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Orders!A${matchedOrderRowIndex}:O${matchedOrderRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [orderRow],
        },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Orders!A:O',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [orderRow],
        },
      });
    }

    // 3. Update or Append OrderItems tab (aggregates total quantity & amount per item)
    // Headers: order_id, item_name, qty, rate, amount, is_free
    if (items && items.length > 0) {
      let existingItemRows: string[][] = [];
      try {
        const itemsRes = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: 'OrderItems!A:F',
        });
        existingItemRows = (itemsRes.data.values as string[][]) || [];
      } catch (itemsReadErr) {
        console.warn('Error reading OrderItems tab:', itemsReadErr);
      }

      for (const item of items) {
        const isFree = freeCoffeeItemId === item.id;
        const rate = isFree ? 0 : item.price_per_unit;
        const addedAmount = isFree ? 0 : item.price_per_unit * item.quantity;
        const targetName = item.item_name_en.trim().toLowerCase();

        let matchedItemRowIndex = -1;
        for (let r = 1; r < existingItemRows.length; r++) {
          const row = existingItemRows[r];
          if (row && row[1] && row[1].trim().toLowerCase() === targetName) {
            matchedItemRowIndex = r + 1; // 1-based index
            break;
          }
        }

        if (matchedItemRowIndex !== -1) {
          const existingRow = existingItemRows[matchedItemRowIndex - 1];
          const prevQty = Number(existingRow[2]) || 0;
          const prevAmount = Number(existingRow[4]) || 0;
          const updatedQty = prevQty + item.quantity;
          const updatedAmount = prevAmount + addedAmount;
          const updatedRow = [
            bill.invoice_number,
            item.item_name_en,
            updatedQty,
            rate > 0 ? rate : existingRow[3] || 0,
            updatedAmount,
            isFree ? 'YES' : existingRow[5] || 'NO',
          ];

          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `OrderItems!A${matchedItemRowIndex}:F${matchedItemRowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [updatedRow],
            },
          });

          // Update local cache for subsequent items in the same bill
          existingItemRows[matchedItemRowIndex - 1] = updatedRow.map(String);
        } else {
          const newRow = [
            bill.invoice_number,
            item.item_name_en,
            item.quantity,
            rate,
            addedAmount,
            isFree ? 'YES' : 'NO',
          ];

          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'OrderItems!A:F',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
              values: [newRow],
            },
          });

          // Add to local cache
          existingItemRows.push(newRow.map(String));
        }
      }
    }

    // 4. Update or Append Customers tab (using phone column lookup to prevent double counting on retries)
    // Headers: phone, name, visit_count, first_visit, last_visit, total_spent
    if (bill.customer_phone && bill.customer_phone !== 'N/A') {
      const existing = await lookupCustomerPhoneInSheet(bill.customer_phone, spreadsheetId);
      const firstVisit = existing.firstVisit || nowFormatted;
      const prevTotalSpent = existing.totalSpent || 0;
      const updatedTotalSpent = prevTotalSpent + (Number(bill.total_amount) || 0);

      if (existing.found && existing.rowIndex) {
        // Safe idempotent update: sets exact visit_count & accumulated total_spent
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Customers!A${existing.rowIndex}:F${existing.rowIndex}`,
          valueInputOption: 'USER_ENTERED',
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
        // Append new customer
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Customers!A:F',
          valueInputOption: 'USER_ENTERED',
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
    console.error('Failed to sync to Google Sheets:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Appends a row to the AuditLog tab in the Google Sheet.
 * Ensures the AuditLog tab exists with headers if missing.
 */
export async function appendAuditLogToSheet(entry: {
  timestamp: string;
  action: string;
  actor: string;
  entity_type: string;
  entity_id: string;
  title: string;
  details: Record<string, unknown>;
}, customSheetId?: string | null): Promise<boolean> {
  const spreadsheetId = customSheetId || process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId || spreadsheetId === 'placeholder-sheet-id') {
    return false;
  }

  try {
    const sheets = getSheetsClient();
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
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row],
      },
    });

    return true;
  } catch (err) {
    console.warn('Google Sheets appendAuditLogToSheet error:', err);
    return false;
  }
}

/**
 * Reads all audit log rows from the AuditLog tab in the Google Sheet.
 */
export async function readAuditLogsFromSheet(customSheetId?: string | null): Promise<Array<{
  id: string;
  timestamp: string;
  action: string;
  actor_email: string;
  entity_type: string;
  entity_id: string;
  title: string;
  details: Record<string, unknown>;
}>> {
  const spreadsheetId = customSheetId || process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId || spreadsheetId === 'placeholder-sheet-id') {
    return [];
  }

  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'AuditLog!A2:G',
    });

    const rows = res.data.values;
    if (!rows || !Array.isArray(rows)) return [];

    return rows.map((row, idx) => {
      let parsedDetails: Record<string, unknown> = {};
      try {
        if (row[6]) parsedDetails = JSON.parse(row[6]);
      } catch {
        // fallback
      }

      return {
        id: `sheet-audit-${idx}-${row[0] || Date.now()}`,
        timestamp: row[0] || new Date().toISOString(),
        action: row[1] || 'UNKNOWN',
        actor_email: row[2] || 'manager',
        entity_type: row[3] || 'general',
        entity_id: row[4] || '',
        title: row[5] || '',
        details: parsedDetails,
      };
    });
  } catch (err) {
    console.warn('Google Sheets readAuditLogsFromSheet error:', err);
    return [];
  }
}
