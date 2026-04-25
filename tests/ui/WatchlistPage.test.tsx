import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WatchlistPage } from "../../src/pages/WatchlistPage";

vi.mock("../../src/api/client", () => ({
  api: {
    officialLookupStatus: vi.fn(),
    recheckWatchlist: vi.fn(),
    watchlist: vi.fn()
  }
}));

import { api } from "../../src/api/client";

describe("WatchlistPage", () => {
  beforeEach(() => {
    vi.mocked(api.officialLookupStatus).mockResolvedValue({
      providers: [
        { provider: "keco", label: "환경공단 화학물질 조회", configured: true, cacheCount: 1 },
        { provider: "kosha", label: "KOSHA MSDS 조회", configured: true, cacheCount: 0 }
      ]
    });
    vi.mocked(api.watchlist).mockResolvedValue({
      items: [
        {
          watchId: "watch-1",
          casNo: "67-64-1",
          chemicalName: "Acetone",
          lastSourceName: "한국환경공단 화학물질 정보 조회 서비스",
          lastCheckedAt: "2026-04-25T00:00:00.000Z",
          status: "official_api_matched"
        }
      ]
    });
    vi.mocked(api.recheckWatchlist).mockResolvedValue({
      results: [
        {
          watchId: "watch-1",
          casNo: "67-64-1",
          chemicalName: "Acetone",
          seedMatches: 0,
          apiMatches: 1,
          status: "official_api_matched",
          sourceName: "한국환경공단 화학물질 정보 조회 서비스",
          checkedAt: "2026-04-25T01:00:00.000Z",
          changed: false
        }
      ],
      items: [
        {
          watchId: "watch-1",
          casNo: "67-64-1",
          chemicalName: "Acetone",
          lastSourceName: "한국환경공단 화학물질 정보 조회 서비스",
          lastCheckedAt: "2026-04-25T01:00:00.000Z",
          status: "official_api_matched"
        }
      ]
    });
  });

  it("shows latest lookup timing and supports selected recheck", async () => {
    render(<WatchlistPage />);

    expect(await screen.findByText("67-64-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전체 재조회" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "선택 재조회" })).toBeDisabled();
    expect(screen.getAllByText(/최근 재조회/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText("선택"));
    fireEvent.click(screen.getByRole("button", { name: "선택 재조회" }));

    await waitFor(() => expect(api.recheckWatchlist).toHaveBeenCalledWith(["watch-1"]));
    expect(await screen.findByText("1건 재조회 완료 · 변경 후보 0건")).toBeInTheDocument();
  });
});
