import type { Section3Row } from "../../shared/types";
import { resolveCasNoFromChemicalName } from "./chemicalNameResolver";

const casPattern = /\b\d{2,7}-\d{2}-\d\b/g;
const concentrationPattern = /(?:<\s*)?\d+(?:\.\d+)?\s*(?:~|-|to)\s*\d+(?:\.\d+)?\s*%?|(?:<\s*)?\d+(?:\.\d+)?\s*%?/i;
const trailingConcentrationPattern = /(?:<\s*)?\d+(?:\.\d+)?\s*(?:~|-|to)\s*\d+(?:\.\d+)?\s*%?$|(?:<\s*)?\d+(?:\.\d+)?\s*%?$/i;
const conciseNamesByCas = new Map<string, { ko: string; en: string }>([
  ["1333-74-0", { ko: "수소", en: "Hydrogen" }],
  ["7727-37-9", { ko: "질소", en: "Nitrogen" }]
]);

export function extractSection3Rows(text: string): Section3Row[] {
  const extractedSection = extractSection3Text(text);
  const section = extractedSection.text;
  const lines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: Section3Row[] = [];
  let pendingNameLines: string[] = [];
  let seenSectionHeader = false;

  for (const line of lines) {
    if (isLikelyNonCompositionLine(line)) {
      pendingNameLines = [];
      continue;
    }
    if (isSection3HeaderLine(line)) {
      seenSectionHeader = true;
      pendingNameLines = [];
      continue;
    }
    const casMatches = Array.from(line.matchAll(casPattern));
    if (casMatches.length === 0) {
      const noCasRow = seenSectionHeader && !extractedSection.hasCasRowsBeforeHeader ? parseNoCasComponentLine(line, rows.length) : undefined;
      if (noCasRow) {
        rows.push(noCasRow);
        pendingNameLines = [];
        continue;
      }
      if (isPossibleChemicalNameLine(line)) {
        pendingNameLines = [...pendingNameLines, cleanChemicalNameLine(line)].slice(-2);
      } else {
        pendingNameLines = [];
      }
      continue;
    }

    for (const casMatch of casMatches) {
      const casNoCandidate = casMatch[0];
      const lineAfterCas = line.slice((casMatch.index ?? line.indexOf(casNoCandidate)) + casNoCandidate.length);
      const lineWithoutCas = line.replace(casNoCandidate, " ");
      const concentrationMatch = lineAfterCas.trim()
        ? lineAfterCas.match(trailingConcentrationPattern) ?? lineAfterCas.match(concentrationPattern)
        : lineWithoutCas.match(concentrationPattern);
      const contentText = concentrationMatch?.[0]?.replace(/\s+/g, "") ?? "";
      const { min, max, single } = parseConcentration(contentText);
      const chemicalNameCandidate = normalizeChemicalNameCandidate(
        extractChemicalName(line, casNoCandidate, contentText, pendingNameLines),
        casNoCandidate
      );

      rows.push({
        rowIndex: rows.length,
        rawRowText: [...pendingNameLines, line].join(" "),
        casNoCandidate,
        chemicalNameCandidate,
        contentMinCandidate: min,
        contentMaxCandidate: max,
        contentSingleCandidate: single,
        contentText,
        confidence: chemicalNameCandidate && contentText ? 0.82 : 0.55,
        evidenceLocation: `SECTION 3 / row ${rows.length + 1}`,
        reviewStatus: "needs_review"
      });
    }
    pendingNameLines = [];
  }

  return rows.length > 0 ? rows : extractKnownChemicalRowsFromOcrText(text, extractedSection.hasSectionHeader);
}

function extractSection3Text(text: string) {
  const startPatterns = [/3\.\s*구성성분/i, /구성성분의\s*명칭\s*및\s*함유량/i, /composition/i];
  const endPatterns = [/\n\s*4\.\s*/i, /\n\s*응급조치/i, /\n\s*first aid/i];

  const startIndex = startPatterns
    .map((pattern) => text.search(pattern))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (startIndex === undefined) {
    return {
      text: "",
      hasSectionHeader: false,
      hasCasRowsBeforeHeader: false
    };
  }

  const scopedStart = findSectionStartWithPrefix(text, startIndex);
  const scoped = text.slice(scopedStart);
  const prefix = text.slice(scopedStart, startIndex);
  if (prefix.match(casPattern)) {
    return {
      text: prefix,
      hasSectionHeader: true,
      hasCasRowsBeforeHeader: true
    };
  }
  const endIndex = endPatterns
    .map((pattern) => scoped.search(pattern))
    .filter((index) => index > Math.max(0, startIndex - findSectionStartWithPrefix(text, startIndex)))
    .sort((a, b) => a - b)[0];

  return {
    text: endIndex ? scoped.slice(0, endIndex) : scoped,
    hasSectionHeader: true,
    hasCasRowsBeforeHeader: Boolean(prefix.match(casPattern))
  };
}

function findSectionStartWithPrefix(text: string, startIndex: number) {
  const prefix = text.slice(0, startIndex);
  const lineStarts = Array.from(prefix.matchAll(/\n/g)).map((match) => (match.index ?? 0) + 1);
  const prefixLineCount = 40;
  return lineStarts[Math.max(0, lineStarts.length - prefixLineCount)] ?? 0;
}

function parseConcentration(value: string) {
  const cleaned = value.replace("%", "").replace(/\s+/g, "");
  const range = cleaned.match(/^(<?\d+(?:\.\d+)?)(?:~|-|to)(\d+(?:\.\d+)?)$/i);
  if (range) {
    return { min: range[1], max: range[2], single: "" };
  }
  return { min: "", max: "", single: cleaned };
}

function extractChemicalName(line: string, casNo: string, contentText: string, pendingNameLines: string[]) {
  const beforeCas = line.split(casNo)[0] ?? "";
  const withoutHeaders = beforeCas
    .replace(/3\.\s*구성성분의?\s*명칭\s*및\s*함유량/gi, "")
    .replace(/구성성분|명칭|함유량|CAS\s*No\.?/gi, "")
    .trim();
  const pendingName = pendingNameLines.join(" ").replace(/\s{2,}/g, " ").trim();

  if (withoutHeaders && !isConcentrationOnly(withoutHeaders)) {
    return [pendingName, withoutHeaders].filter(Boolean).join(" ").replace(/\s{2,}/g, " ").trim();
  }

  if (pendingName && !isConcentrationOnly(pendingName)) {
    return pendingName;
  }

  const fallback = line
    .replace(casNo, "")
    .replace(contentText, "")
    .replace(/%/g, "")
    .trim();

  return isConcentrationOnly(fallback) ? "" : fallback.replace(/\s{2,}/g, " ").trim();
}

function normalizeChemicalNameCandidate(value: string, casNo: string) {
  const cleaned = cleanChemicalNameLine(value).replace(/\s{2,}/g, " ").trim();
  if (!cleaned) return "";

  const conciseName = conciseNamesByCas.get(casNo);
  if (conciseName && looksLikeSynonymHeavyName(cleaned)) {
    if (new RegExp(`^${escapeRegExp(conciseName.en)}\\b`, "i").test(cleaned)) return conciseName.en;
    if (cleaned.includes(conciseName.ko)) return conciseName.ko;
    return conciseName.ko;
  }

  return trimSynonymList(cleaned);
}

function looksLikeSynonymHeavyName(value: string) {
  return /[;；]/.test(value) || /\b(?:synonym|alias|이명|관용명)\b/i.test(value);
}

function trimSynonymList(value: string) {
  if (!looksLikeSynonymHeavyName(value)) return value;
  const beforeList = value.split(/[;；]/)[0]?.trim() ?? value;
  const koreanPrimary = beforeList.match(/^([가-힣][가-힣\s]*?)(?:\s+[A-Za-z가-힣].*)?$/)?.[1]?.trim();
  if (koreanPrimary && koreanPrimary.length <= 12) return koreanPrimary;
  const englishPrimary = beforeList.match(/^([A-Z][A-Za-z0-9()+,.-]*)\s+[A-Za-z]/)?.[1]?.trim();
  return englishPrimary || beforeList || value;
}

function parseNoCasComponentLine(line: string, rowIndex: number): Section3Row | undefined {
  if (isHeaderLine(line)) return undefined;
  if (isLikelyNonCompositionLine(line)) return undefined;
  const concentrationMatch = line.match(trailingConcentrationPattern);
  if (!concentrationMatch?.[0]) return undefined;
  const contentText = concentrationMatch[0].replace(/\s+/g, "");
  const chemicalNameCandidate = line.slice(0, concentrationMatch.index).trim();
  if (!isPossibleNoCasChemicalName(chemicalNameCandidate)) return undefined;
  const { min, max, single } = parseConcentration(contentText);

  return {
    rowIndex,
    rawRowText: line,
    casNoCandidate: "",
    chemicalNameCandidate,
    contentMinCandidate: min,
    contentMaxCandidate: max,
    contentSingleCandidate: single,
    contentText,
    confidence: 0.62,
    evidenceLocation: `SECTION 3 / row ${rowIndex + 1}`,
    reviewStatus: "needs_review"
  };
}

function isPossibleChemicalNameLine(line: string) {
  const cleaned = cleanChemicalNameLine(line);
  if (!cleaned) return false;
  if (isLikelyNonCompositionLine(cleaned)) return false;
  if (/^(?:--\s*)?\d+\s+of\s+\d+(?:\s*--)?$/i.test(cleaned)) return false;
  if (/^(?:저장|폐기|이명|관용명|이명\(관용명\)|CAS번호|함유량|\(%\))$/i.test(cleaned)) return false;
  if (/이명\(관용명\)|CAS번호|함유량/.test(cleaned)) return false;
  if (/^(?:\d+\/\d+|가\.|나\.|다\.|라\.|마\.)$/.test(cleaned)) return false;
  if (/^(?:가|나|다|라|마)\.\s/.test(cleaned)) return false;
  if (/(?:하시오|시오\.?|받으시오|씻어내시오|세탁하시오|착용할 것)[\s.]*$/i.test(cleaned)) return false;
  if (/^(?:\d+\.\s*)?(?:화학물질명|관용명|CAS번호|함유량|구성성분|개정일|품명)/i.test(cleaned)) return false;
  if (isConcentrationOnly(cleaned)) return false;
  return /[A-Za-z가-힣]/.test(cleaned);
}

function isLikelyNonCompositionLine(line: string) {
  return /(TWA|STEL|NOAEC|NOAEL|LD50|LC50|BCF|log\s*Kow|OECD|GLP|mg\/m3|mg\/kg|발암성|독성|피부|눈에|흡입|복귀돌연변이|염색체|시험|관찰|최종개정일자|개정일자)/i.test(line);
}

function isPossibleNoCasChemicalName(value: string) {
  const cleaned = cleanChemicalNameLine(value);
  if (!isPossibleChemicalNameLine(cleaned)) return false;
  if (/^(?:기타|영업비밀|자료없음|해당없음)$/i.test(cleaned)) return false;
  return true;
}

function isHeaderLine(line: string) {
  return /^(?:\d+\.\s*)?(?:화학물질명|물질명|관용명|CAS\s*번호|CAS번호|함유량|구성성분)/i.test(line.trim());
}

function isSection3HeaderLine(line: string) {
  return /3\.\s*구성성분|구성성분의\s*명칭\s*및\s*함유량|composition/i.test(line);
}

function cleanChemicalNameLine(line: string) {
  return line
    .replace(/화학물질명|물질명|관용명\s*및\s*이명|이명\s*\(관용명\)|CAS\s*번호\s*또는\s*식별번호|CAS\s*No\.?|CAS\s*번호|CAS번호|함유량%?\s*(?:\(w\/w\))?|\(%\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isConcentrationOnly(value: string) {
  const cleaned = value.replace(/%/g, "").replace(/\s+/g, "");
  return /^(?:<)?\d+(?:\.\d+)?(?:(?:~|-|to)\d+(?:\.\d+)?)?$/i.test(cleaned);
}

function extractKnownChemicalRowsFromOcrText(text: string, hasSection3Header: boolean): Section3Row[] {
  if (!hasSection3Header) return [];
  const names = new Map<string, string>();
  for (const match of text.matchAll(/\[([^\]\n]{2,80})\]/g)) {
    const name = cleanBracketedChemicalName(match[1]);
    const casNo = resolveCasNoFromChemicalName(name);
    if (casNo && !names.has(casNo)) {
      names.set(casNo, name);
    }
  }

  return Array.from(names.entries()).map(([casNoCandidate, chemicalNameCandidate], index) => ({
    rowIndex: index,
    rawRowText: `[${chemicalNameCandidate}]`,
    casNoCandidate,
    chemicalNameCandidate,
    contentMinCandidate: "",
    contentMaxCandidate: "",
    contentSingleCandidate: "",
    contentText: "",
    confidence: 0.48,
    evidenceLocation: `OCR fallback / known chemical ${index + 1}`,
    reviewStatus: "needs_review"
  }));
}

function cleanBracketedChemicalName(value: string) {
  return value
    .replace(/^\s*[-–—]\s*/, "")
    .replace(/\s*[:：].*$/, "")
    .trim();
}
