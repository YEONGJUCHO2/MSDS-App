import type { Section3Row } from "../../shared/types";
import { resolveCasNoFromChemicalName } from "./chemicalNameResolver";

const casPattern = /\b\d{2,7}-\d{2}-\d\b/g;
const concentrationPattern = /(?:<\s*)?\d+(?:\.\d+)?\s*(?:~|-|to)\s*\d+(?:\.\d+)?\s*%?|(?:<\s*)?\d+(?:\.\d+)?\s*%?/i;
const trailingConcentrationPattern = /(?:<\s*)?\d+(?:\.\d+)?\s*(?:~|-|to)\s*\d+(?:\.\d+)?\s*%?$|(?:<\s*)?\d+(?:\.\d+)?\s*%?$/i;

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
      const chemicalNameCandidate = extractChemicalName(line, casNoCandidate, contentText, pendingNameLines);

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
  const prefixLineCount = 12;
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

function parseNoCasComponentLine(line: string, rowIndex: number): Section3Row | undefined {
  if (isHeaderLine(line)) return undefined;
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
  if (/^(?:--\s*)?\d+\s+of\s+\d+(?:\s*--)?$/i.test(cleaned)) return false;
  if (/^(?:\d+\/\d+|가\.|나\.|다\.|라\.|마\.)$/.test(cleaned)) return false;
  if (/^(?:가|나|다|라|마)\.\s/.test(cleaned)) return false;
  if (/(?:하시오|시오\.?|받으시오|씻어내시오|세탁하시오|착용할 것)[\s.]*$/i.test(cleaned)) return false;
  if (/^(?:\d+\.\s*)?(?:화학물질명|관용명|CAS번호|함유량|구성성분|개정일|품명)/i.test(cleaned)) return false;
  if (isConcentrationOnly(cleaned)) return false;
  return /[A-Za-z가-힣]/.test(cleaned);
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
    .replace(/화학물질명|관용명 및 이명|CAS번호|함유량%?\s*(?:\(w\/w\))?/gi, "")
    .trim();
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
