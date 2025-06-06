
"use server";
import { revalidatePath } from 'next/cache';
import { getSheetData, updateSheetData, deleteSheetRow, batchUpdateSheetData } from '@/lib/google-sheets';
import type { sheets_v4 } from 'googleapis';
import { uploadFileToDrive as libUploadFileToDrive } from '@/lib/google-drive-utils';
// GOOGLE_SPREADSHEET_ID and GOOGLE_SHEET_NAME are no longer used directly here.
// They will be passed as arguments to the functions.

export interface SheetState {
  headers: string[];
  rows: string[][];
  sheetId: number | null;
  error?: string;
  lastUpdated?: number;
  currentSpreadsheetId?: string;
  currentSheetName?: string;
}

export async function fetchSheetDataAction(spreadsheetId: string, sheetName: string): Promise<SheetState> {
  try {
    if (!spreadsheetId || spreadsheetId === "YOUR_SPREADSHEET_ID_HERE" || !sheetName) {
      return {
        headers: ["Configuration Required"],
        rows: [["Spreadsheet ID or Sheet Name is missing or invalid."]],
        sheetId: null,
        error: "Configuration required: Spreadsheet ID or Sheet Name is not set or is invalid.",
        currentSpreadsheetId: spreadsheetId,
        currentSheetName: sheetName,
      };
    }
    const range = `${sheetName}`; // Fetches the entire sheet by its name
    const { headers, rows, sheetId } = await getSheetData(spreadsheetId, range);
    return { headers, rows, sheetId, lastUpdated: Date.now(), currentSpreadsheetId: spreadsheetId, currentSheetName: sheetName };
  } catch (error) {
    console.error("fetchSheetDataAction Error:", error);
    return {
      headers: [],
      rows: [],
      sheetId: null,
      error: error instanceof Error ? error.message : "Failed to fetch data",
      currentSpreadsheetId: spreadsheetId,
      currentSheetName: sheetName,
    };
  }
}

export async function batchUpdateSheetDataAction(
  spreadsheetId: string,
  sheetName: string, // Added sheetName parameter
  data: { range: string; values: string[][] }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const valueInputOption = 'USER_ENTERED';
    const requestBody: sheets_v4.Schema$BatchUpdateValuesRequest = {
      valueInputOption,
      data: data.map(item => ({
        range: `${sheetName}!${item.range}`, // Prepends sheetName to the range
        values: item.values,
      })),
    };
    await batchUpdateSheetData(spreadsheetId, requestBody);
    revalidatePath('/'); // Consider revalidating a more specific path if possible
    return { success: true };
  } catch (error) {
    console.error("batchUpdateSheetDataAction Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to batch update cells" };
  }
}

export async function deleteSheetRowAction(spreadsheetId: string, sheetId: number, rowIndex: number): Promise<{ success: boolean; error?: string }> {
  try {
    if (sheetId === null) {
      throw new Error("Sheet ID is not available. Cannot delete row.");
    }
    await deleteSheetRow(spreadsheetId, sheetId, rowIndex);
    revalidatePath('/'); // Consider revalidating a more specific path
    return { success: true };
  } catch (error) {
    console.error("deleteSheetRowAction Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete row" };
  }
}

export interface UploadFileParams {
  fileName: string;
  mimeType: string;
  base64Content: string;
  folderId?: string;
}

export async function uploadFileAction(params: UploadFileParams): Promise<{ success: boolean; link?: string; fileId?: string; error?: string }> {
  try {
    const { fileName, mimeType, base64Content, folderId } = params;
    const result = await libUploadFileToDrive(fileName, mimeType, base64Content, folderId);
    return { success: true, link: result.webViewLink, fileId: result.id };
  } catch (error) {
    console.error("uploadFileAction Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Gagal mengunggah file ke Google Drive." };
  }
}
