/**
 * Error report CSV generation helpers for SFS Calculator.
 */

import type { SfsStoreUploadError, SfsStoreUploadRow } from "./types";
import type { MissingDistanceError } from "./parse-stores";

function csvEscape(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate error report CSV from validation errors.
 * Columns: row_number, anchor_id, stop_type, field, error_message
 */
export function generateErrorReportCsv(
  errors: SfsStoreUploadError[],
  rows: SfsStoreUploadRow[] | null
): string {
  const header = "row_number,anchor_id,stop_type,field,error_message";
  
  const lines = errors.map((err) => {
    // Try to find the corresponding row (row is 1-based, includes header, so data row is row - 2)
    const rowIndex = err.row - 2;
    const dataRow = rows && rowIndex >= 0 ? rows[rowIndex] : null;
    
    return [
      String(err.row),
      csvEscape(dataRow?.anchor_id ?? ""),
      csvEscape(dataRow?.stop_type ?? ""),
      csvEscape(err.field ?? ""),
      csvEscape(err.message),
    ].join(",");
  });

  return [header, ...lines].join("\n");
}

/**
 * Generate missing distance CSV - includes only satellite rows missing distance_miles.
 * Preserves original columns plus row_number and required_fix.
 */
export function generateMissingDistanceCsv(
  missingErrors: MissingDistanceError[],
  allRows: SfsStoreUploadRow[] | null
): string {
  if (!allRows || missingErrors.length === 0) {
    return "row_number,anchor_id,stop_type,store_name,store_id,packages,pickup_window_start_time,pickup_window_end_time,distance_miles,required_fix\nNo missing distance rows found.";
  }

  const header = "row_number,anchor_id,stop_type,store_name,store_id,packages,pickup_window_start_time,pickup_window_end_time,distance_miles,required_fix";
  
  // Build a set of row numbers that have missing distances
  const missingRowNumbers = new Set(missingErrors.map((e) => e.row));
  
  const lines: string[] = [];
  
  // Iterate through all rows and include only those with missing distances
  for (let i = 0; i < allRows.length; i++) {
    const rowNumber = i + 2; // 1-based, accounting for header
    if (!missingRowNumbers.has(rowNumber)) continue;
    
    const row = allRows[i]!;
    lines.push([
      String(rowNumber),
      csvEscape(row.anchor_id),
      csvEscape(row.stop_type),
      csvEscape(row.store_name),
      csvEscape(row.store_id ?? ""),
      String(row.packages),
      csvEscape(row.pickup_window_start_time),
      csvEscape(row.pickup_window_end_time),
      row.distance_miles != null ? String(row.distance_miles) : "",
      "Add distance_miles (miles from anchor to this satellite)",
    ].join(","));
  }

  return [header, ...lines].join("\n");
}

/**
 * Copy affected anchor_ids to clipboard as a comma-separated string.
 */
export function getAffectedAnchorIdsText(missingErrors: MissingDistanceError[]): string {
  const uniqueAnchors = [...new Set(missingErrors.map((e) => e.anchor_id))];
  return uniqueAnchors.join(", ");
}



