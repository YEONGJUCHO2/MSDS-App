import type { Section3Row } from "../../shared/types";

const casPattern = /\b\d{2,7}-\d{2}-\d\b/g;
const concentrationPattern = /(?:<\s*)?\d+(?:\.\d+)?\s*(?:~|-|to)\s*\d+(?:\.\d+)?\s*%?|(?:<\s*)?\d+(?:\.\d+)?\s*%?/i;

export function extractSection3Rows(text: string): Section3Row[] {
  const section = extractSection3Text(text);
  const lines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: Section3Row[] = [];
  let pendingNameLines: string[] = [];

  for (const line of lines) {
    const casMatches = Array.from(line.matchAll(casPattern));
    if (casMatches.length === 0) {
      if (isPossibleChemicalNameLine(line)) {
        pendingNameLines.push(cleanChemicalNameLine(line));
      }
      continue;
    }

    for (const casMatch of casMatches) {
      const casNoCandidate = casMatch[0];
      const lineAfterCas = line.slice((casMatch.index ?? line.indexOf(casNoCandidate)) + casNoCandidate.length);
      const lineWithoutCas = line.replace(casNoCandidate, " ");
      const concentrationMatch = lineAfterCas.match(concentrationPattern) ?? lineWithoutCas.match(concentrationPattern);
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

  return rows;
}

function extractSection3Text(text: string) {
  const startPatterns = [/3\.\s*구성성분/i, /구성성분의\s*명칭\s*및\s*함유량/i, /composition/i];
  const endPatterns = [/\n\s*4\.\s*/i, /\n\s*응급조치/i, /\n\s*first aid/i];

  const startIndex = startPatterns
    .map((pattern) => text.search(pattern))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  const scoped = startIndex >= 0 ? text.slice(startIndex) : text;
  const endIndex = endPatterns
    .map((pattern) => scoped.search(pattern))
    .filter((index) => index > 0)
    .sort((a, b) => a - b)[0];

  return endIndex ? scoped.slice(0, endIndex) : scoped;
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

  if (withoutHeaders && !isConcentrationOnly(withoutHeaders)) {
    return withoutHeaders.replace(/\s{2,}/g, " ").trim();
  }

  const pendingName = pendingNameLines.join(" ").replace(/\s{2,}/g, " ").trim();
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

function isPossibleChemicalNameLine(line: string) {
  const cleaned = cleanChemicalNameLine(line);
  if (!cleaned) return false;
  if (/^(?:--\s*)?\d+\s+of\s+\d+(?:\s*--)?$/i.test(cleaned)) return false;
  if (/^(?:\d+\/\d+|가\.|나\.|다\.|라\.|마\.)$/.test(cleaned)) return false;
  if (/^(?:\d+\.\s*)?(?:화학물질명|관용명|CAS번호|함유량|구성성분|개정일|품명)/i.test(cleaned)) return false;
  if (isConcentrationOnly(cleaned)) return false;
  return /[A-Za-z가-힣]/.test(cleaned);
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
