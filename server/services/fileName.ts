export function normalizeUploadedFileName(fileName: string) {
  const repaired = Buffer.from(fileName, "latin1").toString("utf8");
  if (scoreReadableName(repaired) > scoreReadableName(fileName)) {
    return repaired;
  }
  return fileName;
}

function scoreReadableName(value: string) {
  const replacementPenalty = (value.match(/\uFFFD/g) ?? []).length * 10;
  const hangulScore = (value.match(/[가-힣]/g) ?? []).length * 3;
  const asciiScore = (value.match(/[a-zA-Z0-9_. -]/g) ?? []).length;
  const mojibakePenalty = (value.match(/[ÃÂãíêëìá¼½¾¿]/g) ?? []).length * 2;
  return hangulScore + asciiScore - replacementPenalty - mojibakePenalty;
}
