import type { BasicInfoField } from "../../shared/types";
import { normalizeUploadedFileName } from "./fileName";

interface BasicInfoInput {
  fileName: string;
  textContent: string;
  siteNames?: string;
  queueCount?: number;
}

const fieldOrder: Array<{ key: string; label: string }> = [
  { key: "supplier", label: "공급사" },
  { key: "manufacturer", label: "제조사" },
  { key: "phone", label: "대표전화" },
  { key: "email", label: "E-mail" },
  { key: "productName", label: "제품명" },
  { key: "usage", label: "용도" },
  { key: "itemCode", label: "ITEM코드" },
  { key: "msdsNumber", label: "MSDS번호" },
  { key: "manufacturingType", label: "제조구분" },
  { key: "site", label: "사업장" },
  { key: "revisionDate", label: "최종개정일자" },
  { key: "reviewCategory", label: "구분" },
  { key: "reviewer", label: "검토자" },
  { key: "reviewOpinion", label: "검토의견" }
];

export function extractDocumentBasicInfo(input: BasicInfoInput) {
  const text = input.textContent.replace(/\r/g, "\n");
  const normalizedFileName = normalizeUploadedFileName(input.fileName);
  const sectionOneBlock = extractSectionOneLabelBlock(text);
  const values: Record<string, Omit<BasicInfoField, "key" | "label">> = {
    supplier: value(sectionOneBlock.supplier || extractByLabels(text, ["생산 및 공급 회사명", "제조-공급회사명", "공급사", "공급자", "공급업체", "회사명"]), "msds_text"),
    manufacturer: value(sectionOneBlock.manufacturer || extractByLabels(text, ["생산 및 공급 회사명", "제조-공급회사명", "제조사", "제조업체", "제조자"]), "msds_text"),
    phone: value(sectionOneBlock.phone || extractPhone(text), "msds_text"),
    email: value(extractEmail(text), "msds_text"),
    productName: value(sectionOneBlock.productName || extractByLabels(text, ["제품명", "제품의 명칭", "화학제품명"]) || stripPdf(normalizedFileName), "file_name"),
    usage: value(sectionOneBlock.usage || extractByLabels(text, ["용도", "용 도", "제품의 권고 용도", "권고 용도"]), "msds_text"),
    itemCode: value("", "manual_required"),
    msdsNumber: value(extractMsdsNumber(text), "msds_text"),
    manufacturingType: value(extractManufacturingType(text), "msds_text"),
    site: value(input.siteNames ?? "", input.siteNames ? "linked_site" : "manual_required"),
    revisionDate: value(extractRevisionDate(text), "msds_text"),
    reviewCategory: value((input.queueCount ?? 0) > 0 ? "검수 필요" : "검토완료", "system"),
    reviewer: value("", "manual_required"),
    reviewOpinion: value((input.queueCount ?? 0) > 0 ? "검수 필요 항목 검토 필요" : "검토완료", "system")
  };

  return fieldOrder.map(({ key, label }) => ({
    key,
    label,
    ...values[key]
  }));
}

function value(valueText: string, source: BasicInfoField["source"]) {
  return { value: valueText.trim(), source: valueText.trim() ? source : "manual_required" as const };
}

function stripPdf(fileName: string) {
  return fileName.replace(/\.pdf$/i, "");
}

function extractByLabels(text: string, labels: string[]) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (let index = 0; index < lines.length; index += 1) {
      const line = stripLinePrefix(lines[index]);
      const match = line.match(new RegExp(`^${escaped}\\s*[:：]?\\s*(.+)$`, "i"));
      const cleaned = cleanupValue(match?.[1] ?? "");
      if (cleaned && !looksLikeLabelOnly(cleaned)) return cleaned;
      if (line.match(new RegExp(`^${escaped}\\s*[:：]?\\s*$`, "i"))) {
        const nextValue = findNextValue(lines, index + 1);
        if (nextValue) return nextValue;
      }
    }
  }
  return "";
}

function findNextValue(lines: string[], startIndex: number) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const cleaned = cleanupValue(stripLinePrefix(lines[index]));
    if (!cleaned) continue;
    if (looksLikeLabelOnly(cleaned)) continue;
    if (/^(가|나|다|라|마)\.?$/.test(cleaned)) continue;
    if (/정보$/.test(cleaned) && cleaned.includes("/")) continue;
    return cleaned;
  }
  return "";
}

function extractSectionOneLabelBlock(text: string) {
  const lines = text.split("\n").map((line) => cleanupValue(stripLinePrefix(line))).filter(Boolean);
  const startIndex = lines.findIndex((line) => /화학제품과\s*회사에\s*관한\s*정보/.test(line));
  const scopedLines = startIndex >= 0 ? lines.slice(startIndex + 1) : lines;
  const endIndex = scopedLines.findIndex((line) => /^2[.)]?\s*/.test(line) || /^2\.\s*/.test(line));
  const sectionLines = (endIndex >= 0 ? scopedLines.slice(0, endIndex) : scopedLines).slice(0, 60);
  const labels: Array<{ key: "productName" | "usage" | "supplier" | "address" | "phone"; index: number }> = [];

  for (let index = 0; index < sectionLines.length; index += 1) {
    const line = sectionLines[index];
    if (/^제품명\s*[:：]?$/.test(line)) labels.push({ key: "productName", index });
    if (/^제품의\s*권고\s*용도와\s*사용상의\s*제한\s*[:：]?$/.test(line) || /^권고\s*용도\s*[:：]?$/.test(line)) {
      labels.push({ key: "usage", index });
    }
    if (/^(?:제조[-\s]*공급회사명|생산\s*및\s*공급\s*회사명)\s*[:：]?$/.test(line)) {
      labels.push({ key: "supplier", index });
    }
    if (/^주소\s*[:：]?$/.test(line)) {
      labels.push({ key: "address", index });
    }
    if (/^(?:긴급연락전화번호|정보\s*제공\s*및\s*긴급연락\s*전화번호|전화번호)\s*[:：]?$/.test(line)) {
      labels.push({ key: "phone", index });
    }
  }

  if (labels.length < 2) return {};

  const valueStart = Math.max(...labels.map((label) => label.index)) + 1;
  const valueLines = sectionLines.slice(valueStart).filter((line) => !looksLikeLabelOnly(line) && !looksLikeSectionTitle(line));
  const mapped: Partial<Record<"productName" | "usage" | "supplier" | "manufacturer" | "phone", string>> = {};

  labels
    .sort((left, right) => left.index - right.index)
    .forEach((label, offset) => {
      const nextValue = valueLines[offset];
      if (!nextValue) return;
      if (label.key === "address") return;
      if (label.key === "phone") {
        mapped.phone = nextValue.match(/[0-9]{2,4}[-)\s][0-9]{3,4}[-\s][0-9]{4}/)?.[0] ?? nextValue;
        return;
      }
      mapped[label.key] = nextValue;
      if (label.key === "supplier") mapped.manufacturer = nextValue;
    });

  return mapped;
}

function extractPhone(text: string) {
  return text.match(/(?:대표전화|전화(?:번호)?|TEL|Tel\.?)\s*[:：]?\s*([0-9]{2,4}[-)\s][0-9]{3,4}[-\s][0-9]{4})/i)?.[1]?.trim() ?? "";
}

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
}

function extractMsdsNumber(text: string) {
  return text.match(/[A-Z]{2}\d{5,}-\d{8,}/)?.[0] ?? extractByLabels(text, ["MSDS번호", "MSDS 번호", "제출번호"]);
}

function extractRevisionDate(text: string) {
  const labeled = text.match(/(?:최종\s*개정\s*일자|최종개정일자|개정일자|작성일자|개정일)\s*[:：]?\s*(\d{4}[./-]\d{1,2}[./-]\d{1,2})/i)?.[1] ?? "";
  if (labeled) return normalizeDate(labeled);
  const koreanDate = text.match(/(?:최종\s*개정\s*일자|최종개정일자|개정일자|작성일자|개정일)\s*[:：]?\s*(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/i);
  if (koreanDate) return normalizeDate(`${koreanDate[1]}-${koreanDate[2]}-${koreanDate[3]}`);
  const nearRevision = text.match(/(?:개정|Revision|Rev)[^\d]{0,20}(\d{4}[./-]\d{1,2}[./-]\d{1,2})/i)?.[1] ?? "";
  return normalizeDate(nearRevision);
}

function extractManufacturingType(text: string) {
  if (/국내|대한민국|Korea/i.test(text)) return "국내";
  if (/수입|import/i.test(text)) return "수입";
  return "";
}

function cleanupValue(valueText: string) {
  return valueText
    .replace(/\s{2,}/g, " ")
    .replace(/^[|:：-]+/, "")
    .replace(/[|]+$/, "")
    .trim();
}

function stripLinePrefix(line: string) {
  return line
    .replace(/^[◦•\-.\s]+/, "")
    .replace(/^\d+(?:-\d+)?[.)]\s*/, "")
    .trim();
}

function looksLikeLabelOnly(valueText: string) {
  return /^(제품명|공급사|제조사|용도|작성일자|개정일자|전화|주소)\s*[:：]?$/i.test(valueText)
    || /^제품의\s*권고\s*용도와\s*사용상의\s*제한\s*[:：]?$/i.test(valueText)
    || /^제조[-\s]*공급회사명\s*[:：]?$/i.test(valueText)
    || /^긴급연락전화번호\s*[:：]?$/i.test(valueText)
    || /유통정보$/.test(valueText);
}

function looksLikeSectionTitle(valueText: string) {
  return /^\d+(?:-\d+)?[.)]?\s+/.test(valueText)
    || /^[가-하]\.\s*/.test(valueText)
    || /정보$/.test(valueText);
}

function normalizeDate(valueText: string) {
  return valueText ? valueText.replace(/[./]/g, "-").replace(/-(\d)(?=-|$)/g, "-0$1") : "";
}
