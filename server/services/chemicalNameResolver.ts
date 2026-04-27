export function resolveCasNoFromChemicalName(chemicalName: string) {
  const normalized = chemicalName.toLowerCase().replace(/\s+/g, "");
  if (!normalized) return "";
  if (normalized.includes("산화알루미늄") || normalized.includes("알루미늄산화물") || normalized.includes("aluminiumoxide") || normalized.includes("aluminumoxide") || normalized.includes("alumina")) {
    return "1344-28-1";
  }
  if ((normalized.includes("산화규소") && normalized.includes("규조토")) || normalized.includes("diatomaceousearth") || normalized.includes("kieselguhr")) {
    return "61790-53-2";
  }
  if (normalized.includes("산화철") || normalized.includes("ironoxide") || normalized.includes("burntsienna")) {
    return "1332-37-2";
  }
  if (normalized.includes("테트라플루오로에테인") || normalized.includes("tetrafluoroethane") || normalized.includes("hfc-134a") || normalized.includes("r-134a")) {
    return "811-97-2";
  }
  return "";
}
