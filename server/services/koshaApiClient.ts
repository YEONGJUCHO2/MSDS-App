export interface OfficialChemicalMatch {
  casNo: string;
  category: string;
  sourceName: string;
  sourceUrl: string;
  evidenceText: string;
}

export async function lookupOfficialChemicalData(casNo: string): Promise<OfficialChemicalMatch[]> {
  const endpoint = process.env.KOSHA_MSDS_API_URL;
  const serviceKey = process.env.KOSHA_API_SERVICE_KEY;
  if (!endpoint || !serviceKey) return [];

  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("casNo", casNo);
  url.searchParams.set("searchWrd", casNo);
  url.searchParams.set("numOfRows", "10");
  url.searchParams.set("pageNo", "1");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`KOSHA API lookup failed: ${response.status}`);
  }
  const text = await response.text();
  if (!text.trim()) return [];

  return [
    {
      casNo,
      category: "officialMsdsLookup",
      sourceName: "KOSHA MSDS Open API",
      sourceUrl: endpoint,
      evidenceText: text.slice(0, 1000)
    }
  ];
}

export function isOfficialApiConfigured() {
  return Boolean(process.env.KOSHA_MSDS_API_URL && process.env.KOSHA_API_SERVICE_KEY);
}
