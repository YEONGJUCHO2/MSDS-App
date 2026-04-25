import { render, screen } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import { describe, expect, it } from "vitest";
import App from "../../src/App";

vi.mock("../../src/api/client", () => ({
  api: {
    documents: vi.fn(),
    queues: vi.fn()
  }
}));

import { api } from "../../src/api/client";

describe("App layout", () => {
  beforeEach(() => {
    vi.mocked(api.documents).mockResolvedValue({ documents: [] });
    vi.mocked(api.queues).mockResolvedValue({ items: [] });
  });

  it("uses fixed-width navigation and content rails so pages do not resize by tab content", async () => {
    render(<App />);

    expect(await screen.findByTestId("app-shell")).toHaveClass("app-shell");
    expect(screen.getByTestId("app-nav")).toHaveClass("app-nav");
    expect(screen.getByTestId("app-content")).toHaveClass("content");
  });
});
