import { google } from 'googleapis';

let sheetsClient: any = null;

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!credentialsJson || !sheetId) {
    throw new Error('Google Sheets credentials not configured');
  }

  try {
    // Decode base64 encoded credentials
    const credentials = JSON.parse(Buffer.from(credentialsJson, 'base64').toString('utf-8'));
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
    return sheetsClient;
  } catch (error: any) {
    console.error('Error initializing Google Sheets client:', error);
    throw new Error(`Failed to initialize Google Sheets: ${error.message}`);
  }
}

export async function checkDuplicateEmail(email: string): Promise<boolean> {
  try {
    const sheets = getSheetsClient();
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!sheetId) {
      throw new Error('GOOGLE_SHEET_ID not configured');
    }

    // Read column B (Email column) starting from row 2 (skip header)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Sheet1!B2:B', // Column B, starting from row 2
    });

    const rows = response.data.values || [];
    const emails = rows.map((row: any[]) => (row[0] || '').toLowerCase().trim());
    const normalizedEmail = email.toLowerCase().trim();

    return emails.includes(normalizedEmail);
  } catch (error: any) {
    console.error('Error checking duplicate email:', error);
    throw new Error(`Failed to check duplicate email: ${error.message}`);
  }
}

export async function appendWaitlistRow(data: {
  email: string;
  name: string;
  phone: string;
  link: string;
  excitement: string;
}): Promise<void> {
  try {
    const sheets = getSheetsClient();
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!sheetId) {
      throw new Error('GOOGLE_SHEET_ID not configured');
    }

    const timestamp = new Date().toISOString();
    const row = [
      timestamp,
      data.email.toLowerCase().trim(),
      data.name.trim(),
      data.phone.trim(),
      data.link.trim(),
      data.excitement,
      false, // Notified flag
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:G',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row],
      },
    });
  } catch (error: any) {
    console.error('Error appending waitlist row:', error);
    throw new Error(`Failed to append waitlist row: ${error.message}`);
  }
}

