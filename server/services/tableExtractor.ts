import type { Section3Row } from "../../shared/types";

const casPattern = /\b\d{2,7}-\d{2}-\d\b/g;
const concentrationPattern = /(?:<\s*)?\d+(?:\.\d+)?\s*(?:~|to)\s*\d+(?:\.\d+)?\s*%?|(?:<\s*)?\d+(?:\.\d+)?\s*%?/i;

export function extractSection3Rows(text: string): Section3Row[] {
  const section = extractSection3Text(text);
  const lines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: Section3Row[] = [];

  for (const line of lines) {
    const casMatches = Array.from(line.matchAll(casPattern));
    if (casMatches.length === 0) continue;

    for (const casMatch of casMatches) {
      const casNoCandidate = casMatch[0];
      const lineWithoutCas = line.replace(casNoCandidate, " ");
      const concentrationMatch = lineWithoutCas.match(concentrationPattern);
      const contentText = concentrationMatch?.[0]?.replace(/\s+/g, "") ?? "";
      const { min, max, single } = parseConcentration(contentText);
      const chemicalNameCandidate = extractChemicalName(line, casNoCandidate, contentText);

      rows.push({
        rowIndex: rows.length,
        rawRowText: line,
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

function extractChemicalName(line: string, casNo: string, contentText: string) {
  const beforeCas = line.split(casNo)[0] ?? "";
  const withoutHeaders = beforeCas
    .replace(/3\.\s*구성성분의?\s*명칭\s*및\s*함유량/gi, "")
    .replace(/구성성분|명칭|함유량|CAS\s*No\.?/gi, "")
    .trim();

  const fallback = line
    .replace(casNo, "")
    .replace(contentText, "")
    .replace(/%/g, "")
    .trim();

  return (withoutHeaders || fallback).replace(/\s{2,}/g, " ").trim();
}
