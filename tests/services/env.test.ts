import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFile } from "../../server/env";

describe("server env loader", () => {
  const keys = ["MSDS_AI_PROVIDER", "MSDS_CODEX_ENABLED", "EXISTING_VALUE"];

  afterEach(() => {
    for (const key of keys) {
      delete process.env[key];
    }
  });

  it("loads local .env values without overwriting shell-provided values", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "msds-env-"));
    const envPath = path.join(dir, ".env");
    await writeFile(envPath, [
      "MSDS_AI_PROVIDER=codex",
      "MSDS_CODEX_ENABLED=true",
      "EXISTING_VALUE=file"
    ].join("\n"));
    process.env.EXISTING_VALUE = "shell";

    loadEnvFile(envPath);

    expect(process.env.MSDS_AI_PROVIDER).toBe("codex");
    expect(process.env.MSDS_CODEX_ENABLED).toBe("true");
    expect(process.env.EXISTING_VALUE).toBe("shell");
  });
});
