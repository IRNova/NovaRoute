// Nova Bot — text extraction from binary documents (Hermes read_extract style).
// Zero-dependency: PDF via zlib inflate of FlateDecode streams + Tj/TJ ops;
// DOCX/XLSX (zip) via manual central-directory parse + raw inflate.

import { readFile } from "node:fs/promises";
import zlib from "node:zlib";

/* ── ZIP (docx / xlsx) ─────────────────────────────────────────────── */

async function zipReadEntry(buf, wantedName) {
  // Find End Of Central Directory.
  const eocd = buf.lastIndexOf(Buffer.from("PK\x05\x06"));
  if (eocd === -1) throw new Error("not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOff = buf.readUInt32LE(ptr + 42);
    const name = buf.subarray(ptr + 46, ptr + 46 + nameLen).toString("utf8");

    if (name === wantedName) {
      const lh = localOff;
      if (buf.readUInt32LE(lh) !== 0x04034b50) throw new Error("bad local header");
      const lNameLen = buf.readUInt16LE(lh + 26);
      const lExtraLen = buf.readUInt16LE(lh + 28);
      const dataStart = lh + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(dataStart, dataStart + compSize);
      if (method === 0) return data; // stored
      if (method === 8) return zlib.inflateRawSync(data); // deflate
      throw new Error(`unsupported zip method ${method}`);
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const stripXml = (xml) =>
  String(xml)
    .replace(/<w:p[ >]/g, "\n<w:p ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export async function extractDocx(filePath) {
  const buf = await readFile(filePath);
  const xml = await zipReadEntry(buf, "word/document.xml");
  if (!xml) return "(no document.xml found)";
  return stripXml(xml.toString("utf8")).slice(0, FILE_CAP);
}

export async function extractXlsx(filePath) {
  const buf = await readFile(filePath);
  const shared = await zipReadEntry(buf, "xl/sharedStrings.xml");
  const strings = [];
  if (shared) {
    const xml = shared.toString("utf8");
    for (const m of xml.matchAll(/<si>[\s\S]*?<\/si>/g)) {
      strings.push(stripXml(m[0]));
    }
  }
  const sheet = await zipReadEntry(buf, "xl/worksheets/sheet1.xml");
  if (!sheet) return strings.join("\n").slice(0, FILE_CAP) || "(no sheets)";
  const rows = [];
  for (const rowM of sheet.toString("utf8").matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const c of rowM[1].matchAll(/<c[^>]*?(?: t="(\w+)")?[^>]*>(?:<v>([\s\S]*?)<\/v>)?/g)) {
      const [, type, raw] = c;
      if (raw == null) { cells.push(""); continue; }
      cells.push(type === "s" ? strings[parseInt(raw, 10)] ?? "" : raw);
    }
    rows.push(cells.join(" | "));
  }
  return rows.join("\n").slice(0, FILE_CAP) || "(empty sheet)";
}

/* ── PDF ───────────────────────────────────────────────────────────── */

function pdfDecodeStream(raw) {
  try { return zlib.inflateSync(raw); } catch {}
  try { return zlib.inflateRawSync(raw); } catch {}
  return null;
}

function pdfTextFromContent(contentBuf) {
  const s = contentBuf.toString("latin1");
  const out = [];
  // (text) Tj   and   [(a) -2 (b)] TJ
  for (const m of s.matchAll(/\((?:\\.|[^\\)])*\)\s*(?:Tj|TJ)|\[[\s\S]{0,2000}?\]\s*TJ/g)) {
    for (const str of m[0].matchAll(/\((?:\\.|[^\\)])*\)/g)) {
      out.push(str[0].slice(1, -1).replace(/\\([()\\])/g, "$1"));
    }
    out.push(" ");
  }
  return out.join("").replace(/[ \t]+/g, " ").replace(/\s{3,}/g, "\n\n").trim();
}

export async function extractPdf(filePath) {
  const buf = await readFile(filePath);
  const chunks = [];
  const latin = buf.toString("latin1");
  const re = /stream\r?\n?/g;
  let m;
  while ((m = re.exec(latin))) {
    const start = m.index + m[0].length;
    const end = latin.indexOf("endstream", start);
    if (end === -1) break;
    const raw = buf.subarray(start, end);
    const decoded = pdfDecodeStream(raw);
    const content = decoded || raw; // uncompressed streams used directly
    const head = content.subarray(0, 40).toString("latin1");
    if (/BT|Tj|TJ/.test(head) || /BT|Tj|TJ/.test(content.toString("latin1", 0, 400))) {
      const text = pdfTextFromContent(content);
      if (text) chunks.push(text);
    }
    re.lastIndex = end;
  }
  const joined = chunks.join("\n\n").trim();
  return joined ? joined.slice(0, FILE_CAP) : "(no extractable text layer — scanned PDF needs OCR)";
}

/* ── Dispatcher ────────────────────────────────────────────────────── */

const FILE_CAP = 60_000;

export async function extractAny(filePath) {
  const lower = String(filePath).toLowerCase();
  try {
    if (lower.endsWith(".pdf")) return await extractPdf(filePath);
    if (lower.endsWith(".docx")) return await extractDocx(filePath);
    if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) return await extractXlsx(filePath);
    return null; // not a supported binary doc — caller falls back to plain read
  } catch (e) {
    return `ERROR extracting document: ${String(e?.message || e).slice(0, 200)}`;
  }
}
