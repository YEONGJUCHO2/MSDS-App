import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("site management layout styles", () => {
  const css = readFileSync("src/styles.css", "utf8");

  it("keeps the selected site detail card from stretching to the full site list height", () => {
    expect(css).toMatch(/\.site-management-layout\s*\{[^}]*align-items:\s*start;/s);
  });
});
