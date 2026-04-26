import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("site management layout styles", () => {
  const css = readFileSync("src/styles.css", "utf8");

  it("uses the site lookup area as a horizontal slot selector", () => {
    expect(css).toMatch(/\.site-lookup-controls\s*\{[^}]*overflow-x:\s*auto;/s);
    expect(css).toMatch(/\.site-slot-list\s*\{[^}]*display:\s*flex;/s);
    expect(css).toMatch(/\.site-slot\s*\{[^}]*flex:\s*0\s+0\s+clamp\(160px,\s*22vw,\s*220px\);/s);
  });
});
