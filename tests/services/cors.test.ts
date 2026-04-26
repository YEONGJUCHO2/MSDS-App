import { describe, expect, it } from "vitest";
import { isOriginAllowed, parseAllowedOrigins } from "../../server/middleware/cors";

describe("cors middleware helpers", () => {
  it("parses comma-separated allowed origins", () => {
    expect(parseAllowedOrigins("https://app.vercel.app, http://localhost:5173 ")).toEqual([
      "https://app.vercel.app",
      "http://localhost:5173"
    ]);
  });

  it("allows configured Vercel frontend origins to call the Mac mini API", () => {
    expect(isOriginAllowed("https://msds-app.vercel.app", ["https://msds-app.vercel.app"])).toBe(true);
    expect(isOriginAllowed("https://other.example.com", ["https://msds-app.vercel.app"])).toBe(false);
  });

  it("supports a wildcard only when the operator explicitly configures it", () => {
    expect(isOriginAllowed("https://preview.vercel.app", ["*"])).toBe(true);
  });
});
