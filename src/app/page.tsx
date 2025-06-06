
import { SheetDataTable } from '@/components/SheetDataTable';
import { GOOGLE_SPREADSHEET_ID, GOOGLE_SHEET_NAME } from '@/config';

export default async function Home() {
  return (
    <main className="flex-grow">
      <SheetDataTable 
        initialDefaultSpreadsheetId={GOOGLE_SPREADSHEET_ID}
        initialDefaultSheetName={GOOGLE_SHEET_NAME}
      />
    </main>
  );
}
