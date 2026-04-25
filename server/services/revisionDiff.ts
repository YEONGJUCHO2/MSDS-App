export interface RevisionComponent {
  casNo: string;
  chemicalName: string;
  concentrationText: string;
}

export type RevisionDiffItem =
  | { type: "concentration_changed"; casNo: string; before: string; after: string }
  | { type: "removed"; casNo: string; before: string; after: string }
  | { type: "added"; casNo: string; before: string; after: string };

export function diffComponentRevisions(before: RevisionComponent[], after: RevisionComponent[]): RevisionDiffItem[] {
  const beforeByCas = new Map(before.map((component) => [component.casNo, component]));
  const afterByCas = new Map(after.map((component) => [component.casNo, component]));
  const diffs: RevisionDiffItem[] = [];

  for (const [casNo, beforeComponent] of beforeByCas) {
    const afterComponent = afterByCas.get(casNo);
    if (!afterComponent) {
      diffs.push({ type: "removed", casNo, before: beforeComponent.concentrationText, after: "" });
      continue;
    }
    if (beforeComponent.concentrationText !== afterComponent.concentrationText) {
      diffs.push({
        type: "concentration_changed",
        casNo,
        before: beforeComponent.concentrationText,
        after: afterComponent.concentrationText
      });
    }
  }

  for (const [casNo, afterComponent] of afterByCas) {
    if (!beforeByCas.has(casNo)) {
      diffs.push({ type: "added", casNo, before: "", after: afterComponent.concentrationText });
    }
  }

  return diffs;
}
