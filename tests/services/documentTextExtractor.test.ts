import { describe, expect, it } from "vitest";
import { extractUploadedDocumentText } from "../../server/services/documentTextExtractor";

describe("document text extractor", () => {
  it("extracts plain text from modern Word MSDS files", async () => {
    const buffer = createZip({
      "word/document.xml": [
        "<w:document>",
        "<w:body>",
        "<w:p><w:r><w:t>제품명 CA-13R</w:t></w:r></w:p>",
        "<w:p><w:r><w:t>일산화탄소 630-08-0 1~5</w:t></w:r></w:p>",
        "</w:body>",
        "</w:document>"
      ].join("")
    });

    const result = await extractUploadedDocumentText("sample.docx", buffer);

    expect(result).toEqual({
      text: expect.stringContaining("제품명 CA-13R"),
      pageCount: 1,
      kind: "docx"
    });
    expect(result.text).toContain("일산화탄소 630-08-0 1~5");
  });

  it("extracts shared-string table text from modern Excel MSDS files", async () => {
    const buffer = createZip({
      "xl/sharedStrings.xml": [
        "<sst>",
        "<si><t>화학물질</t></si>",
        "<si><t>일산화탄소</t></si>",
        "<si><t>630-08-0</t></si>",
        "<si><t>1~5</t></si>",
        "</sst>"
      ].join(""),
      "xl/worksheets/sheet1.xml": [
        "<worksheet><sheetData>",
        "<row><c t=\"s\"><v>0</v></c><c t=\"s\"><v>1</v></c><c t=\"s\"><v>2</v></c><c t=\"s\"><v>3</v></c></row>",
        "</sheetData></worksheet>"
      ].join("")
    });

    const result = await extractUploadedDocumentText("sample.xlsx", buffer);

    expect(result).toEqual({
      text: expect.stringContaining("화학물질\t일산화탄소\t630-08-0\t1~5"),
      pageCount: 1,
      kind: "xlsx"
    });
  });

  it("resolves numeric-looking XLSX shared string references before extracting MSDS rows", async () => {
    const buffer = createMinimalXlsx([
      ["3. 구성성분의 명칭 및 함유량"],
      ["화학물질명", "관용명 및 이명(異名)", "CAS 번호 또는 식별번호", "함유량(%)"],
      ["산화 마그네슘", "산화 마그네슘", "1309-48-4 / KE-22728", "80~90"],
      ["산화 알루미늄", "산화 알루미늄", "1344-28-1 / KE-01012", "1~10"],
      ["전화번호", "054-290-0538"],
      ["4. 응급조치 요령"]
    ]);

    const result = await extractUploadedDocumentText("sample.xlsx", buffer);

    expect(result.text).toContain("산화 마그네슘\t1309-48-4 / KE-22728\t80~90");
    expect(result.text).toContain("산화 알루미늄\t1344-28-1 / KE-01012\t1~10");
    expect(result.text).toContain("전화번호\t054-290-0538");
    expect(result.text).not.toContain("산화 마그네슘\t2\t3\t4");
  });
});

function createMinimalXlsx(rows: string[][]) {
  const strings = Array.from(new Set(rows.flat()));
  const sharedXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    ...strings.map((value) => `<si><t>${escapeXml(value)}</t></si>`),
    '</sst>'
  ].join("");
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const ref = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`;
      const index = strings.indexOf(value);
      const asSharedString = columnIndex === 0;
      return asSharedString
        ? `<c r="${ref}" t="s"><v>${index}</v></c>`
        : `<c r="${ref}"><v>${index}</v></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const sheetXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    `<sheetData>${sheetRows}</sheetData>`,
    '</worksheet>'
  ].join("");

  return makeZip({
    "xl/sharedStrings.xml": sharedXml,
    "xl/worksheets/sheet1.xml": sheetXml
  });
}

function makeZip(files: Record<string, string>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name);
    const contentBuffer = Buffer.from(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(contentBuffer.length, 18);
    local.writeUInt32LE(contentBuffer.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, contentBuffer);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(contentBuffer.length, 20);
    central.writeUInt32LE(contentBuffer.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + contentBuffer.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function createZip(entries: Record<string, string>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localFiles = Buffer.concat(localParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(entries).length, 8);
  eocd.writeUInt16LE(Object.keys(entries).length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localFiles.length, 16);
  return Buffer.concat([localFiles, centralDirectory, eocd]);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
