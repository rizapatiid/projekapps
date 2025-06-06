import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
// Option 1: Directly import the JSON (ensure your bundler/TS setup allows this)
// Make sure "resolveJsonModule": true is in your tsconfig.json compilerOptions
import credentials from '@/config/serviceAccountCredentials.json';

// Option 2: If direct JSON import is problematic, use environment variables
// const credentials = {
//   client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
//   private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'), // Handle newline characters
//   project_id: process.env.GOOGLE_PROJECT_ID!,
// };


const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file' // Added scope for Google Drive file operations
];

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    scopes: SCOPES,
  });
}

async function getSheetsApi(): Promise<sheets_v4.Sheets> {
  const auth = getAuth();
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client as any});
}

export async function getSheetData(spreadsheetId: string, range: string): Promise<{ headers: string[], rows: string[][], sheetId: number | null }> {
  if (spreadsheetId === "YOUR_SPREADSHEET_ID_HERE") {
    console.warn("Using placeholder SPREADSHEET_ID. Please update in src/config/index.ts");
    return { headers: ["Please configure Spreadsheet ID"], rows: [["Update src/config/index.ts with your Google Sheet ID."]], sheetId: null };
  }
  try {
    const sheets = await getSheetsApi();
    
    const sheetNameFromRange = range.includes('!') ? range.split('!')[0] : range;

    let numericSheetId: number | null = null;
    try {
      const spreadsheetMeta = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets(properties(sheetId,title))',
      });
      const foundSheet = spreadsheetMeta.data.sheets?.find(s => s.properties?.title === sheetNameFromRange);
      if (foundSheet && foundSheet.properties?.sheetId != null) {
        numericSheetId = foundSheet.properties.sheetId;
      } else {
        console.warn(`Could not find sheetId for sheet name: ${sheetNameFromRange}`);
      }
    } catch (metaError) {
      console.error("Error fetching spreadsheet metadata:", metaError);
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const values = response.data.values;
    if (!values || values.length === 0) {
      return { headers: [], rows: [], sheetId: numericSheetId };
    }

    const headers = values[0] as string[];
    const rows = values.slice(1) as string[][];
    return { headers, rows, sheetId: numericSheetId };
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching data.';
    if (errorMessage.includes("Requested entity was not found")) {
       return { headers: ["Error"], rows: [["Spreadsheet or sheet not found. Check ID and Name."]], sheetId: null };
    }
    if (errorMessage.includes("PERMISSION_DENIED")) {
      return { headers: ["Error"], rows: [["Permission denied. Share the sheet with the service account email:", credentials.client_email]], sheetId: null };
    }
    throw new Error(`Failed to fetch sheet data: ${errorMessage}`);
  }
}

export async function updateSheetData(spreadsheetId: string, range: string, values: string[][]): Promise<sheets_v4.Schema$UpdateValuesResponse> {
  const sheets = await getSheetsApi();
  const resource: sheets_v4.Schema$ValueRange = { values };
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    resource,
  });
  return response.data;
}

export async function batchUpdateSheetData(spreadsheetId: string, data: sheets_v4.Schema$BatchUpdateValuesRequest): Promise<sheets_v4.Schema$BatchUpdateValuesResponse> {
  const sheets = await getSheetsApi();
  const response = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: data,
  });
  return response.data;
}


export async function deleteSheetRow(spreadsheetId: string, sheetId: number, rowIndex: number): Promise<sheets_v4.Schema$BatchUpdateSpreadsheetResponse> {
  const actualSheetRowIndex = rowIndex + 1; 

  const sheets = await getSheetsApi();
  const requests: sheets_v4.Schema$Request[] = [
    {
      deleteDimension: {
        range: {
          sheetId: sheetId,
          dimension: 'ROWS',
          startIndex: actualSheetRowIndex,
          endIndex: actualSheetRowIndex + 1,
        },
      },
    },
  ];

  const batchUpdateRequest: sheets_v4.Schema$BatchUpdateSpreadsheetRequest = { requests };
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: batchUpdateRequest,
  });
  return response.data;
}

// Helper function to get Drive API client
export async function getDriveApi() {
  const auth = getAuth(); // Uses the same auth with updated SCOPES
  const client = await auth.getClient();
  return google.drive({ version: 'v3', auth: client as any });
}
