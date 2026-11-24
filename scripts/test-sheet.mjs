import fs from 'fs';
import { google } from 'googleapis';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0) {
    const key = line.substring(0, eqIdx).trim();
    let val = line.substring(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
});

const clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
const spreadsheetId = env.GOOGLE_SHEET_ID;

console.log('Testing connection to sheet:', spreadsheetId);
console.log('Using service account email:', clientEmail);

const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function init() {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    console.log('Connected! Spreadsheet title:', meta.data.properties?.title);

    const existingTitles = meta.data.sheets?.map(s => s.properties?.title) || [];
    console.log('Existing sheets:', existingTitles);

    const tabsToCreate = ['Orders', 'OrderItems', 'Customers'].filter(
      t => !existingTitles.includes(t)
    );

    if (tabsToCreate.length > 0) {
      console.log('Creating tabs:', tabsToCreate);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: tabsToCreate.map(title => ({
            addSheet: { properties: { title } },
          })),
        },
      });
    }

    // Set headers
    console.log('Updating Orders headers...');
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Orders!A1:M1',
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
            'subtotal',
            'tax',
            'total',
            'payment_mode',
            'visit_no',
            'free_visit',
            'created_by',
          ],
        ],
      },
    });

    console.log('Updating OrderItems headers...');
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'OrderItems!A1:F1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          ['order_id', 'item_name', 'qty', 'rate', 'amount', 'is_free'],
        ],
      },
    });

    console.log('Updating Customers headers...');
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
            'free_redeemed',
          ],
        ],
      },
    });

    // Delete default 'Sheet1' if exists and other tabs exist
    if (existingTitles.includes('Sheet1')) {
      const sheet1Obj = meta.data.sheets?.find(s => s.properties?.title === 'Sheet1');
      if (sheet1Obj && sheet1Obj.properties?.sheetId !== undefined) {
        try {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  deleteSheet: {
                    sheetId: sheet1Obj.properties.sheetId,
                  },
                },
              ],
            },
          });
          console.log('Deleted default Sheet1!');
        } catch (e) {
          console.log('Note on Sheet1 deletion:', e.message);
        }
      }
    }

    console.log('SUCCESS! Google Sheet has been initialized with all tabs and headers.');
  } catch (err) {
    console.error('ERROR connecting to Google Sheet:', err);
  }
}

init();
