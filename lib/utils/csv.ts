// Tiny CSV helper. RFC 4180-ish: quote fields containing comma, quote,
// or newline; double-up quotes inside quoted fields. Good enough for
// every spreadsheet we'd reasonably target (Excel, Numbers, Sheets).

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce<Set<string>>((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set()),
  );
  const out: string[] = [];
  out.push(headers.map(quote).join(","));
  for (const r of rows) {
    out.push(headers.map((h) => quote(serialize(r[h]))).join(","));
  }
  return out.join("\n");
}

function serialize(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function quote(s: string): string {
  if (s === "") return "";
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// =============================================================
// Parse — RFC 4180-ish, handles quoted fields with embedded
// commas / newlines / doubled quotes. Returns array of records
// keyed by the header row.
// =============================================================
export function fromCsv(text: string): Array<Record<string, string>> {
  const rows = parseRows(text.replace(/\r\n/g, "\n"));
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: Array<Record<string, string>> = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length === 1 && r[0] === "") continue; // blank line
    const rec: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      rec[headers[j]] = (r[j] ?? "").trim();
    }
    out.push(rec);
  }
  return out;
}

function parseRows(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQ = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQ = true;
      } else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n") {
        row.push(cur);
        out.push(row);
        row = [];
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  // Flush any tail.
  if (cur !== "" || row.length > 0) {
    row.push(cur);
    out.push(row);
  }
  return out;
}
