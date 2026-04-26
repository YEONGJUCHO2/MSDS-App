import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("site management layout styles", () => {
  const css = readFileSync("src/styles.css", "utf8");

  it("keeps the selected site detail card from stretching to the full site list height", () => {
    expect(css).toMatch(/\.site-management-layout\s*\{[^}]*align-items:\s*start;/s);
  });

  it("shows site choices as a horizontal slot bar above the selected site detail", () => {
    expect(css).toMatch(/\.site-management-layout\s*\{[^}]*grid-template-columns:\s*1fr;/s);
    expect(css).toMatch(/\.site-slot-list\s*\{[^}]*display:\s*flex;/s);
    expect(css).toMatch(/\.site-slot-list\s*\{[^}]*overflow-x:\s*auto;/s);
    expect(css).toMatch(/\.site-slot\s*\{[^}]*flex:\s*0\s+0\s+clamp\(160px,\s*22vw,\s*220px\);/s);
  });
});
