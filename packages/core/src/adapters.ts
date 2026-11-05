import type { AttributeValue, ProcessEvent } from "./types";

export interface ColumnMapping {
  caseId: string;
  activity: string;
  timestamp: string;
  endTimestamp?: string;
  resource?: string;
  /** Extra columns to keep as attributes. Default: none. */
  attributes?: string[];
}

type Row = Record<string, AttributeValue | undefined>;

/** Map plain objects (API rows, parsed JSON) to events using a column mapping. */
export function fromJson(rows: readonly Row[], mapping: ColumnMapping): ProcessEvent[] {
  const events: ProcessEvent[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Row;
    const caseId = row[mapping.caseId];
    const activity = row[mapping.activity];
    const timestamp = row[mapping.timestamp];
    if (caseId == null || activity == null || timestamp == null) {
      throw new Error(`Row ${i} is missing ${missingColumns(row, mapping).join(", ")}`);
    }
    events.push(toEvent(row, mapping, String(caseId), String(activity), timestamp));
  }
  return events;
}

function toEvent(
  row: Row,
  mapping: ColumnMapping,
  caseId: string,
  activity: string,
  timestamp: AttributeValue,
): ProcessEvent {
  const event: ProcessEvent = { caseId, activity, timestamp: timestamp as string | number };
  const end = mapping.endTimestamp ? row[mapping.endTimestamp] : undefined;
  if (end != null && end !== "") event.endTimestamp = end as string | number;
  const resource = mapping.resource ? row[mapping.resource] : undefined;
  if (resource != null && resource !== "") event.resource = String(resource);
  if (mapping.attributes?.length) {
    const attributes: Record<string, AttributeValue> = {};
    for (const name of mapping.attributes) attributes[name] = row[name] ?? null;
    event.attributes = attributes;
  }
  return event;
}

function missingColumns(row: Row, mapping: ColumnMapping): string[] {
  return [mapping.caseId, mapping.activity, mapping.timestamp].filter((c) => row[c] == null);
}

export interface CsvOptions {
  delimiter?: string;
}

/** Parse CSV text (RFC 4180 quoting) and map it to events. The first row is the header. */
export function fromCsv(
  text: string,
  mapping: ColumnMapping,
  options: CsvOptions = {},
): ProcessEvent[] {
  const rows = parseCsv(text, options.delimiter ?? detectDelimiter(text));
  const header = rows[0];
  if (!header) return [];
  const objects: Row[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] as string[];
    if (cells.length === 1 && cells[0] === "") continue;
    const object: Row = {};
    for (let c = 0; c < header.length; c++) object[header[c] as string] = cells[c] ?? "";
    objects.push(object);
  }
  return fromJson(objects, mapping);
}

function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf("\n") >>> 0 || text.length);
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    const count = firstLine.split(d).length;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** Minimal streaming-free CSV parser. Handles quoted cells, escaped quotes and CRLF. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const state = new CsvState();
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (state.quoted) {
      i += state.readQuoted(ch, text[i + 1]);
    } else if (ch === "\n" || ch === "\r") {
      state.endRow();
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else {
      state.readPlain(ch, delimiter);
    }
  }
  state.flush();
  return state.rows;
}

class CsvState {
  rows: string[][] = [];
  quoted = false;
  private row: string[] = [];
  private cell = "";

  /** Returns how many extra characters were consumed (1 for an escaped quote). */
  readQuoted(ch: string, next: string | undefined): number {
    if (ch !== '"') {
      this.cell += ch;
      return 0;
    }
    if (next === '"') {
      this.cell += '"';
      return 1;
    }
    this.quoted = false;
    return 0;
  }

  readPlain(ch: string, delimiter: string): void {
    if (ch === '"') this.quoted = true;
    else if (ch === delimiter) this.endCell();
    else this.cell += ch;
  }

  endCell(): void {
    this.row.push(this.cell);
    this.cell = "";
  }

  endRow(): void {
    this.endCell();
    this.rows.push(this.row);
    this.row = [];
  }

  flush(): void {
    if (this.cell !== "" || this.row.length > 0) this.endRow();
  }
}
