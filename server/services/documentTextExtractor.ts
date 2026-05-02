import { inflateRawSync } from "node:zlib";
import { extractPdfText } from "./pdfExtractor";

export type UploadedDocumentKind = "pdf" | "docx" | "xlsx" | "csv";

export interface UploadedDocumentText {
  text: string;
  pageCount: number;
  kind: UploadedDocumentKind;
}

export async function extractUploadedDocumentText(fileName: string, buffer: Buffer): Promise<UploadedDocumentText> {
  const normalizedName = fileName.toLowerCase();
  if (normalizedName.endsWith(".pdf")) {
    return { ...(await extractPdfText(buffer)), kind: "pdf" };
  }
  if (normalizedName.endsWith(".docx")) {
    return { text: extractDocxText(buffer), pageCount: 1, kind: "docx" };
  }
  if (normalizedName.endsWith(".xlsx")) {
    return { text: extractXlsxText(buffer), pageCount: 1, kind: "xlsx" };
  }
  if (normalizedName.endsWith(".csv")) {
    return { text: buffer.toString("utf8"), pageCount: 1, kind: "csv" };
  }
  throw new Error("지원하지 않는 파일 형식입니다. PDF, DOCX, XLSX, CSV 파일을 업로드해주세요.");
}

function extractDocxText(buffer: Buffer) {
  const entries = readZipEntries(buffer);
  const documentXml = entries.get("word/document.xml");
  if (!documentXml) throw new Error("Word 문서 본문을 찾지 못했습니다.");
  const paragraphs = Array.from(documentXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g))
    .map((match) => extractXmlText(match[0]).trim())
    .filter(Boolean);
  return paragraphs.length > 0 ? paragraphs.join("\n") : extractXmlText(documentXml);
}

function extractXlsxText(buffer: Buffer) {
  const entries = readZipEntries(buffer);
  const sharedStrings = readSharedStrings(entries.get("xl/sharedStrings.xml") ?? "");
  const sheetNames = Array.from(entries.keys()).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort();
  const rows = sheetNames.flatMap((name) => readSheetRows(entries.get(name) ?? "", sharedStrings));
  if (rows.length === 0) throw new Error("Excel 문서에서 텍스트 셀을 찾지 못했습니다.");
  return rows.map((row) => row.join("\t")).join("\n");
}

function readSharedStrings(xml: string) {
  return Array.from(xml.matchAll(/<si\b[\s\S]*?<\/si>/g)).map((match) => extractXmlText(match[0]).trim());
}

function readSheetRows(xml: string, sharedStrings: string[]) {
  return Array.from(xml.matchAll(/<row\b[\s\S]*?<\/row>/g))
    .map((rowMatch) => Array.from(rowMatch[0].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g))
      .map((cellMatch) => readCellValue(cellMatch[1], cellMatch[2], sharedStrings))
      .filter((value) => value.trim()))
    .map((row) => normalizeSharedStringRow(row, sharedStrings))
    .filter((row) => row.length > 0);
}

function readCellValue(attributes: string, xml: string, sharedStrings: string[]) {
  if (/\bt=["']s["']/.test(attributes)) {
    const index = Number(xml.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? -1);
    return Number.isFinite(index) && index >= 0 ? sharedStrings[index] ?? "" : "";
  }
  if (/\bt=["']inlineStr["']/.test(attributes)) {
    return extractXmlText(xml);
  }
  return decodeXmlEntities(xml.match(/<v>([\s\S]*?)<\/v>/)?.[1]?.trim() ?? "");
}

function normalizeSharedStringRow(row: string[], sharedStrings: string[]) {
  const shouldResolve = row.some((value) => containsMeaningfulText(value))
    && row.filter((value) => canResolveSharedStringIndex(value, sharedStrings)).length >= Math.max(1, Math.floor(row.length / 2));
  const resolved = shouldResolve
    ? row.map((value) => canResolveSharedStringIndex(value, sharedStrings) ? sharedStrings[Number(value)] : value)
    : row;
  return removeAdjacentDuplicateCells(resolved).map((value) => value.trim()).filter(Boolean);
}

function canResolveSharedStringIndex(value: string, sharedStrings: string[]) {
  if (!/^\d+$/.test(value.trim())) return false;
  const index = Number(value.trim());
  const sharedValue = sharedStrings[index]?.trim();
  return Boolean(sharedValue && containsMeaningfulText(sharedValue));
}

function containsMeaningfulText(value: string) {
  return /[가-힣A-Za-z]/.test(value) || /\d{2,7}-\d{2}-\d/.test(value) || /\d{2,4}[-)]\d{3,4}/.test(value) || /[~%/]/.test(value);
}

function removeAdjacentDuplicateCells(row: string[]) {
  return row.filter((value, index) => value !== row[index - 1]);
}

function readZipEntries(buffer: Buffer) {
  const eocdOffset = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdOffset === -1) throw new Error("Office 문서 압축 구조를 읽지 못했습니다.");
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map<string, string>();
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Office 문서 중앙 디렉터리를 읽지 못했습니다.");
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    entries.set(fileName, readLocalZipEntry(buffer, localHeaderOffset, compressedSize, compressionMethod));
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readLocalZipEntry(buffer: Buffer, offset: number, compressedSize: number, compressionMethod: number) {
  if (buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error("Office 문서 로컬 파일 헤더를 읽지 못했습니다.");
  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
  if (compressionMethod === 0) return compressed.toString("utf8");
  if (compressionMethod === 8) return inflateRawSync(compressed).toString("utf8");
  throw new Error(`지원하지 않는 Office 압축 방식입니다: ${compressionMethod}`);
}

function extractXmlText(xml: string) {
  return decodeXmlEntities(xml
    .replace(/<w:tab\s*\/>/g, "\t")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
