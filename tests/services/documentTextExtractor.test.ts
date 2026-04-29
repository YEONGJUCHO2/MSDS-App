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
});

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
