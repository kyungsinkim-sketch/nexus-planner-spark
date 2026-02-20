/**
 * Google Sheets API client utility for Edge Functions.
 * Handles spreadsheet creation, reading, writing, and formatting.
 * Reuses token management from gcal-client.ts.
 */

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3/files';

// ─── Types ──────────────────────────────────────────

export interface SheetProperties {
  sheetId: number;
  title: string;
  index: number;
}

export interface SpreadsheetResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheets: Array<{ properties: SheetProperties }>;
}

export interface SpreadsheetInfo {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: Array<{ properties: SheetProperties }>;
  modifiedTime?: string; // from Drive API
}

export interface SheetData {
  sheetName: string;
  values: (string | number | boolean | null)[][];
}

// ─── Spreadsheet Operations ─────────────────────────

/**
 * Create a new Google Spreadsheet with multiple sheets
 */
export async function createSpreadsheet(
  accessToken: string,
  title: string,
  sheetTitles: string[] = ['Sheet1'],
): Promise<SpreadsheetResponse> {
  const body = {
    properties: { title },
    sheets: sheetTitles.map((sheetTitle, index) => ({
      properties: {
        sheetId: index,
        title: sheetTitle,
        index,
      },
    })),
  };

  const res = await fetch(SHEETS_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create spreadsheet: ${res.status} ${err}`);
  }

  return await res.json() as SpreadsheetResponse;
}

/**
 * Write data to a specific sheet range using values API
 * @param rows - 2D array of cell values (first row = headers)
 */
export async function writeSheetData(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rows: (string | number | boolean | null)[][],
): Promise<void> {
  const range = `'${sheetName}'!A1`;

  const res = await fetch(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: rows,
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to write sheet data: ${res.status} ${err}`);
  }
}

/**
 * Apply formatting to a sheet (bold header, auto-resize columns, number formatting)
 */
export async function formatSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetId: number,
  columnCount: number,
  numberColumnIndices: number[] = [],
): Promise<void> {
  const requests: Record<string, unknown>[] = [
    // Bold header row
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: columnCount,
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.9, green: 0.9, blue: 0.95 },
          },
        },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    },
    // Freeze header row
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    // Auto-resize columns
    {
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: columnCount,
        },
      },
    },
  ];

  // Number format for currency columns (###,##0)
  for (const colIdx of numberColumnIndices) {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1, // skip header
          startColumnIndex: colIdx,
          endColumnIndex: colIdx + 1,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: 'NUMBER',
              pattern: '#,##0',
            },
          },
        },
        fields: 'userEnteredFormat.numberFormat',
      },
    });
  }

  const res = await fetch(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to format sheet: ${res.status} ${err}`);
  }
}

// ─── Read Operations ────────────────────────────────

/**
 * Get spreadsheet metadata (title, sheet names, etc.)
 */
export async function getSpreadsheetInfo(
  accessToken: string,
  spreadsheetId: string,
): Promise<SpreadsheetInfo> {
  const res = await fetch(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get spreadsheet info: ${res.status} ${err}`);
  }

  const data = await res.json();
  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || '',
    spreadsheetUrl: data.spreadsheetUrl,
    sheets: data.sheets || [],
  };
}

/**
 * Get the last modified time of a spreadsheet via Drive API
 */
export async function getSpreadsheetModifiedTime(
  accessToken: string,
  spreadsheetId: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${DRIVE_BASE}/${encodeURIComponent(spreadsheetId)}?fields=modifiedTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.modifiedTime || null;
  } catch {
    return null;
  }
}

/**
 * Read data from a specific sheet range
 * Returns a 2D array of cell values (rows × columns)
 */
export async function readSheetData(
  accessToken: string,
  spreadsheetId: string,
  range: string,
): Promise<(string | number | boolean | null)[][]> {
  const res = await fetch(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to read sheet data: ${res.status} ${err}`);
  }

  const data = await res.json();
  return (data.values || []) as (string | number | boolean | null)[][];
}

/**
 * Read all sheets' data from a spreadsheet.
 * Returns an array of { sheetName, values } objects.
 */
export async function readAllSheets(
  accessToken: string,
  spreadsheetId: string,
): Promise<SheetData[]> {
  // First get sheet names
  const info = await getSpreadsheetInfo(accessToken, spreadsheetId);
  const sheetNames = info.sheets.map(s => s.properties.title);

  // Build batch ranges for all sheets
  const ranges = sheetNames.map(name => `'${name}'`);
  const rangeParams = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');

  const res = await fetch(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchGet?${rangeParams}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to batch read sheets: ${res.status} ${err}`);
  }

  const data = await res.json();
  const valueRanges = data.valueRanges || [];

  return sheetNames.map((sheetName, i) => ({
    sheetName,
    values: (valueRanges[i]?.values || []) as (string | number | boolean | null)[][],
  }));
}

/**
 * Clear a sheet then write new data (for push sync)
 */
export async function clearAndWriteSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rows: (string | number | boolean | null)[][],
): Promise<void> {
  // Clear existing data
  const clearRange = `'${sheetName}'`;
  await fetch(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(clearRange)}:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    },
  );

  // Write new data
  if (rows.length > 0) {
    await writeSheetData(accessToken, spreadsheetId, sheetName, rows);
  }
}
