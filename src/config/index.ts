
// IMPORTANT: Replace with your actual Spreadsheet ID and Sheet Name.
// You can find the Spreadsheet ID in the URL of your Google Sheet.
// For example, if the URL is https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit,
// then YOUR_SPREADSHEET_ID is the value you need.
export const GOOGLE_SPREADSHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SPREADSHEET_ID || "1CphjZ4n9_Ogrxt_NJOLUECl0iAdZ8ExUm1R8wpfWuW8";

// The name of the sheet within your spreadsheet you want to work with (e.g., "Sheet1").
export const GOOGLE_SHEET_NAME = process.env.NEXT_PUBLIC_GOOGLE_SHEET_NAME || "Sheet1";

// Service account credentials are now imported directly in google-sheets.ts
// For production, it's highly recommended to use environment variables for these.
// Example:
// export const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
// export const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
// export const GOOGLE_PROJECT_ID = process.env.GOOGLE_PROJECT_ID;

