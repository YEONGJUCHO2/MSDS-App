import type { RegulatoryMatch, Section3Row } from "./types";

export const REGULATORY_COMPONENT_EXPORT_COLUMNS = [
  { key: "casNo", label: "CAS No." },
  { key: "chemicalName", label: "화학물질" },
  { key: "contentMin", label: "MIN" },
  { key: "contentMax", label: "MAX" },
  { key: "contentSingle", label: "단일" },
  { key: "specialManagement", label: "특별관리물질", categories: ["specialManagement", "specialManagementSubstance"] },
  { key: "controlledHazardous", label: "관리대상유해물질", categories: ["controlledHazardous", "managedHazardousSubstance", "controlledHazardousSubstance"] },
  { key: "permissionRequired", label: "허가대상물질", categories: ["permissionRequired", "permissionRequiredSubstance", "permitRequiredSubstance"] },
  { key: "manufactureProhibited", label: "제조금지물질", categories: ["manufactureProhibited", "manufactureProhibitedSubstance"] },
  { key: "psm", label: "PSM", categories: ["psm", "psmSubstance"] },
  { key: "workEnvironmentMeasurement", label: "작업환경측정 대상물질", categories: ["workEnvironmentMeasurement"] },
  { key: "exposureLimit", label: "노출기준설정물질", categories: ["exposureLimit", "exposureLimitSubstance"] },
  { key: "permissibleLimit", label: "허용기준설정물질", categories: ["permissibleLimit", "permissibleLimitSubstance"] },
  { key: "specialHealthExam", label: "특수건강검진대상물질", categories: ["specialHealthExam"] },
  { key: "prohibited", label: "금지물질", categories: ["prohibited", "prohibitedSubstance"] },
  { key: "restricted", label: "제한물질", categories: ["restricted", "restrictedSubstance"] },
  { key: "permitted", label: "허가물질", categories: ["permitted", "permittedSubstance"] },
  { key: "toxic", label: "유독물질", categories: ["toxic", "toxicSubstance"] },
  { key: "accidentPreparedness", label: "사고대비물질", categories: ["accidentPreparedness", "accidentPreparednessSubstance"] },
  { key: "priorityControl", label: "중점관리물질", categories: ["priorityControl", "priorityControlSubstance"] },
  { key: "registrationTargetExistingChemical", label: "등록대상기존화학물질", categories: ["registrationTargetExistingChemical"] },
  { key: "cmrExistingChemical", label: "암/돌연변이성물질", categories: ["cmrExistingChemical"] },
  { key: "existingChemical", label: "기존화학물질", categories: ["existingChemical"] },
  { key: "persistentOrganicPollutant", label: "잔류성오염물질", categories: ["persistentOrganicPollutant", "persistentOrganicPollutantSubstance"] }
] as const;

export type RegulatoryComponentExportColumn = (typeof REGULATORY_COMPONENT_EXPORT_COLUMNS)[number];

export function formatComponentRowsAsTsv(rows: Section3Row[]) {
  return [
    REGULATORY_COMPONENT_EXPORT_COLUMNS.map((column) => column.label),
    ...rows.map((row) => formatComponentExportRow(row))
  ].map((values) => values.map(escapeTsvCell).join("\t")).join("\n");
}

export function formatComponentExportRow(row: Section3Row) {
  return REGULATORY_COMPONENT_EXPORT_COLUMNS.map((column) => {
    if (column.key === "casNo") return row.casNoCandidate;
    if (column.key === "chemicalName") return displayChemicalName(row);
    if (column.key === "contentMin") return row.contentMinCandidate;
    if (column.key === "contentMax") return row.contentMaxCandidate;
    if (column.key === "contentSingle") return row.contentSingleCandidate;
    return regulatoryValue(row.regulatoryMatches, column);
  });
}

export function displayChemicalName(row: Section3Row) {
  if (hasHangul(row.chemicalNameCandidate)) return row.chemicalNameCandidate;
  return findKoreanChemicalName(row.regulatoryMatches) || row.chemicalNameCandidate;
}

export function formatSingleComponentAsTsv(row: Section3Row) {
  return formatComponentRowsAsTsv([row]);
}

export function countComponentExportRegulatoryHits(rows: Section3Row[]) {
  return rows.reduce((count, row) => {
    const values = REGULATORY_COMPONENT_EXPORT_COLUMNS.filter((column) => "categories" in column)
      .map((column) => regulatoryValue(row.regulatoryMatches, column));
    return count + values.filter(Boolean).length;
  }, 0);
}

export function hasOfficialLookupOnlyMatches(rows: Section3Row[]) {
  return rows.some((row) =>
    (row.regulatoryMatches ?? []).some((match) => match.sourceType === "official_api" && !isExportCategory(match.category))
  );
}

function regulatoryValue(matches: RegulatoryMatch[] | undefined, column: RegulatoryComponentExportColumn) {
  if (!("categories" in column)) return "";
  const match = (matches ?? []).find((candidate) => column.categories.includes(candidate.category as never));
  if (!match) return "";
  if (match.status.startsWith("비해당")) return "";
  if (match.status.includes("확인")) return match.status;
  return "Y";
}

function isExportCategory(category: string) {
  return REGULATORY_COMPONENT_EXPORT_COLUMNS.some((column) => "categories" in column && column.categories.includes(category as never));
}

function findKoreanChemicalName(matches: RegulatoryMatch[] | undefined) {
  const preferred = (matches ?? []).find((match) => match.category === "chemicalInfoLookup" && hasHangul(match.evidenceText))
    ?? (matches ?? []).find((match) => hasHangul(match.evidenceText));
  if (!preferred) return "";

  const candidate = preferred.evidenceText
    .split("/")
    .map((part) => part.trim())
    .find((part) => hasHangul(part) && !looksLikeClassificationName(part));

  return candidate ?? "";
}

function hasHangul(value: string) {
  return /[가-힣]/.test(value);
}

function looksLikeClassificationName(value: string) {
  return /(유해성물질|제한물질|금지물질|허가물질|사고대비물질|관리대상|특별관리|노출기준|허용기준|중점관리|등록대상|기존화학물질|돌연변이성물질|잔류성오염)/.test(value);
}

function escapeTsvCell(value: string) {
  return value.replace(/\t/g, " ").replace(/\r?\n/g, " ").trim();
}
