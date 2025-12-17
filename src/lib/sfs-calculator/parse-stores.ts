import {
  SFS_STORES_UPLOAD_HEADERS,
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
      missingHeaders: [...SFS_STORES_UPLOAD_HEADERS],
      errors: [{ row: 1, message: "File is empty." }],
    };
  }

  const header = matrix[0].map(normalizeHeader);
  const headerIndex = new Map<string, number>();
  header.forEach((h, idx) => headerIndex.set(h, idx));

  const missingHeaders = SFS_STORES_UPLOAD_HEADERS.filter((h) => !headerIndex.has(h));
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

  const rows: SfsStoreUploadRow[] = [];
  const stops: SfsStop[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const rawRow = matrix[r];
    if (rawRow.every((c) => c.trim() === "")) continue;

    const get = (key: (typeof SFS_STORES_UPLOAD_HEADERS)[number]) =>
      rawRow[headerIndex.get(key)!] ?? "";

    const anchor_id = get("anchor_id").trim();
    const stopTypeValue = get("stop_type");
    const stop_type = parseStopType(stopTypeValue);

    const packagesValue = get("packages");
    const packages = parseRequiredNumber(packagesValue);

    const startStr = get("pickup_window_start_time");
    const endStr = get("pickup_window_end_time");
    const startMin = parseTimeToMinutes(startStr);
    const endMin = parseTimeToMinutes(endStr);

    const avgCube = parseOptionalNumber(get("avg_cubic_inches_per_package"));
    const service = parseOptionalNumber(get("service_time_minutes"));

    const rowNumber = r + 1; // include header row (1-based)

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
      route_id: get("route_id").trim(),
      anchor_id,
      stop_type: stop_type ?? "Anchor",
      store_name: get("store_name").trim(),
      address: get("address").trim(),
      city: get("city").trim(),
      state: get("state").trim(),
      zip: get("zip").trim(),
      packages: packages ?? 0,
      avg_cubic_inches_per_package: avgCube,
      pickup_window_start_time: startStr.trim(),
      pickup_window_end_time: endStr.trim(),
      service_time_minutes: service,
    };

    rows.push(row);

    if (
      anchor_id &&
      stop_type &&
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

  return { ok: true, delimiter, rows, stops, errors };
}

export function getStoresTemplateCsv(): string {
  const header = SFS_STORES_UPLOAD_HEADERS.join(",");
  const examples = [
    [
      "R-001",
      "A-100",
      "Anchor",
      "Anchor Store A",
      "100 Main St",
      "Chicago",
      "IL",
      "60601",
      "120",
      "1000",
      "08:00",
      "12:00",
      "5",
    ],
    [
      "R-001",
      "A-100",
      "Satellite",
      "Satellite Store A1",
      "200 State St",
      "Chicago",
      "IL",
      "60602",
      "40",
      "",
      "09:00",
      "12:00",
      "",
    ],
    [
      "R-002",
      "A-200",
      "Anchor",
      "Anchor Store B",
      "10 Market St",
      "Dallas",
      "TX",
      "75201",
      "80",
      "1200",
      "07:30",
      "10:30",
      "4",
    ],
    [
      "R-002",
      "A-200",
      "Satellite",
      "Satellite Store B1",
      "20 Elm St",
      "Dallas",
      "TX",
      "75202",
      "25",
      "",
      "08:00",
      "10:00",
      "",
    ],
  ];

  const body = examples.map((row) => row.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

