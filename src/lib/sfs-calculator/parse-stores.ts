import {
  SFS_STORES_UPLOAD_REQUIRED_HEADERS,
  SFS_STORES_UPLOAD_OPTIONAL_HEADERS,
  type SfsStoreUploadError,
  type SfsStop,
  type SfsStoreUploadRow,
  type StopType,
} from "./types";

export type StoresUploadParseOk = {
  ok: true;
  delimiter: "," | "\t";
  rows: SfsStoreUploadRow[];
  stops: SfsStop[];
  errors: SfsStoreUploadError[];
  /** True if CSV has distance_miles column with values. */
  hasDistanceMiles: boolean;
};

export type StoresUploadParseError = {
  ok: false;
  delimiter?: "," | "\t";
  missingHeaders: string[];
  errors: SfsStoreUploadError[];
};

export type StoresUploadParseResult = StoresUploadParseOk | StoresUploadParseError;

function detectDelimiter(headerLine: string): "," | "\t" {
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const tabCount = (headerLine.match(/\t/g) ?? []).length;
  return tabCount > commaCount ? "\t" : ",";
}

function parseDelimited(text: string, delimiter: "," | "\t"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const normalized = text.replace(/^\uFEFF/, ""); // strip BOM

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = normalized[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      continue;
    }

    if (ch === "\r") continue;
    field += ch;
  }

  row.push(field);
  if (row.length > 1 || row[0].trim() !== "") {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function parseStopType(value: string): StopType | null {
  const v = value.trim().toLowerCase();
  if (v === "anchor") return "Anchor";
  if (v === "satellite") return "Satellite";
  return null;
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseRequiredNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parses a time-of-day string into minutes since midnight.
 * Supports: "08:00", "8:00", "08:00:00".
 */
export function parseTimeToMinutes(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;

  const parts = raw.split(":").map((p) => p.trim());
  if (parts.length < 2) return null;

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

export function parseStoresUploadText(text: string): StoresUploadParseResult {
  const firstLine = (text.split(/\r?\n/)[0] ?? "").trim();
  const delimiter = detectDelimiter(firstLine);
  const matrix = parseDelimited(text, delimiter);

  const errors: SfsStoreUploadError[] = [];
  if (matrix.length === 0) {
    return {
      ok: false,
      delimiter,
      missingHeaders: [...SFS_STORES_UPLOAD_REQUIRED_HEADERS],
      errors: [{ row: 1, message: "File is empty." }],
    };
  }

  const header = matrix[0].map(normalizeHeader);
  const headerIndex = new Map<string, number>();
  header.forEach((h, idx) => headerIndex.set(h, idx));

  const missingHeaders = SFS_STORES_UPLOAD_REQUIRED_HEADERS.filter((h) => !headerIndex.has(h));
  if (missingHeaders.length) {
    return {
      ok: false,
      delimiter,
      missingHeaders,
      errors: [
        {
          row: 1,
          message: `Missing required headers: ${missingHeaders.join(", ")}`,
        },
      ],
    };
  }

  const hasDistanceMilesColumn = headerIndex.has("distance_miles");
  const hasStoreIdColumn = headerIndex.has("store_id");
  let hasAnyDistanceMiles = false;

  const rows: SfsStoreUploadRow[] = [];
  const stops: SfsStop[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const rawRow = matrix[r];
    if (rawRow.every((c) => c.trim() === "")) continue;

    const get = (key: string) => rawRow[headerIndex.get(key) ?? -1] ?? "";

    const anchor_id = get("anchor_id").trim();
    const stopTypeValue = get("stop_type");
    const stop_type = parseStopType(stopTypeValue);

    const route_id = get("route_id").trim();
    const store_id = hasStoreIdColumn ? get("store_id").trim() : undefined;
    const store_name = get("store_name").trim();

    const packagesValue = get("packages");
    const packages = parseRequiredNumber(packagesValue);

    const startStr = get("pickup_window_start_time");
    const endStr = get("pickup_window_end_time");
    const startMin = parseTimeToMinutes(startStr);
    const endMin = parseTimeToMinutes(endStr);

    const distance_miles = hasDistanceMilesColumn
      ? parseOptionalNumber(get("distance_miles"))
      : null;
    if (distance_miles !== null && distance_miles >= 0) {
      hasAnyDistanceMiles = true;
    }

    const avgCube = headerIndex.has("avg_cubic_inches_per_package")
      ? parseOptionalNumber(get("avg_cubic_inches_per_package"))
      : null;
    const service = headerIndex.has("service_time_minutes")
      ? parseOptionalNumber(get("service_time_minutes"))
      : null;

    const rowNumber = r + 1; // include header row (1-based)

    if (!route_id) {
      errors.push({ row: rowNumber, field: "route_id", message: "route_id is required." });
    }
    if (!anchor_id) {
      errors.push({ row: rowNumber, field: "anchor_id", message: "anchor_id is required." });
    }
    if (!stop_type) {
      errors.push({
        row: rowNumber,
        field: "stop_type",
        message: 'stop_type must be "Anchor" or "Satellite".',
      });
    }
    if (!store_name) {
      errors.push({ row: rowNumber, field: "store_name", message: "store_name is required." });
    }
    if (packages === null || packages < 0) {
      errors.push({
        row: rowNumber,
        field: "packages",
        message: "packages must be a non-negative number.",
      });
    }
    if (startMin === null) {
      errors.push({
        row: rowNumber,
        field: "pickup_window_start_time",
        message: 'pickup_window_start_time must be a valid time (e.g. "08:00").',
      });
    }
    if (endMin === null) {
      errors.push({
        row: rowNumber,
        field: "pickup_window_end_time",
        message: 'pickup_window_end_time must be a valid time (e.g. "17:00").',
      });
    }
    if (startMin !== null && endMin !== null && endMin < startMin) {
      errors.push({
        row: rowNumber,
        message: "pickup_window_end_time must be after pickup_window_start_time.",
      });
    }

    const row: SfsStoreUploadRow = {
      route_id,
      anchor_id,
      stop_type: stop_type ?? "Anchor",
      store_id: store_id || undefined,
      store_name,
      packages: packages ?? 0,
      distance_miles: distance_miles ?? undefined,
      avg_cubic_inches_per_package: avgCube,
      pickup_window_start_time: startStr.trim(),
      pickup_window_end_time: endStr.trim(),
      service_time_minutes: service,
    };

    rows.push(row);

    if (
      route_id &&
      anchor_id &&
      stop_type &&
      store_name &&
      packages !== null &&
      packages >= 0 &&
      startMin !== null &&
      endMin !== null &&
      endMin >= startMin
    ) {
      stops.push({
        ...row,
        stop_type,
        packages,
        pickup_window_start_minutes: startMin,
        pickup_window_end_minutes: endMin,
      });
    }
  }

  // Dataset-level validation: exactly one Anchor row per anchor_id.
  const anchorCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.anchor_id) continue;
    if (row.stop_type === "Anchor") {
      anchorCounts.set(row.anchor_id, (anchorCounts.get(row.anchor_id) ?? 0) + 1);
    } else if (!anchorCounts.has(row.anchor_id)) {
      anchorCounts.set(row.anchor_id, 0);
    }
  }

  for (const [anchorId, count] of anchorCounts.entries()) {
    if (count === 0) {
      errors.push({
        row: 1,
        message: `anchor_id "${anchorId}" must have exactly 1 Anchor row (found 0).`,
      });
    } else if (count > 1) {
      errors.push({
        row: 1,
        message: `anchor_id "${anchorId}" must have exactly 1 Anchor row (found ${count}).`,
      });
    }
  }

  return {
    ok: true,
    delimiter,
    rows,
    stops,
    errors,
    hasDistanceMiles: hasAnyDistanceMiles,
  };
}

export function getStoresTemplateCsv(): string {
  const header = [...SFS_STORES_UPLOAD_REQUIRED_HEADERS, ...SFS_STORES_UPLOAD_OPTIONAL_HEADERS].join(",");
  // Header order: route_id, anchor_id, stop_type, store_name, packages, pickup_window_start_time, pickup_window_end_time,
  //               store_id, distance_miles, avg_cubic_inches_per_package, service_time_minutes
  const examples = [
    // route_id, anchor_id, stop_type, store_name, packages, start, end, store_id, distance_miles, avg_cube, service
    ["R-001", "A-CHI-01", "Anchor", "Chicago Anchor", "180", "08:00", "12:00", "CHI_ANCHOR_001", "", "1000", "5"],
    ["R-001", "A-CHI-01", "Satellite", "Chicago Satellite (<=10mi)", "60", "09:00", "12:00", "CHI_SAT_008", "8", "", ""],
    ["R-001", "A-CHI-01", "Satellite", "Chicago Satellite (<=20mi)", "40", "09:15", "12:00", "CHI_SAT_016", "16", "", ""],
    ["R-001", "A-CHI-01", "Satellite", "Chicago Satellite (<=30mi)", "25", "09:30", "12:00", "CHI_SAT_026", "26", "", ""],
    ["R-001", "A-CHI-01", "Satellite", "Chicago Satellite (>30mi)", "15", "10:00", "12:00", "CHI_SAT_045", "45", "", ""],
    ["R-002", "A-DAL-01", "Anchor", "Dallas Anchor", "140", "07:30", "11:00", "DAL_ANCHOR_001", "", "1100", "4"],
    ["R-002", "A-DAL-01", "Satellite", "Dallas Satellite (<=10mi)", "55", "08:15", "11:00", "DAL_SAT_009", "9", "", ""],
    ["R-002", "A-DAL-01", "Satellite", "Dallas Satellite (<=20mi)", "35", "08:30", "11:00", "DAL_SAT_018", "18", "", ""],
    ["R-002", "A-DAL-01", "Satellite", "Dallas Satellite (<=30mi)", "25", "09:00", "11:00", "DAL_SAT_028", "28", "", ""],
    ["R-002", "A-DAL-01", "Satellite", "Dallas Satellite (>30mi)", "15", "09:30", "11:00", "DAL_SAT_050", "50", "", ""],
  ];

  const body = examples.map((row) => row.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
  return `${header}\n${body}\n`;
}
