import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductsPage } from "../../src/pages/ProductsPage";

vi.mock("../../src/api/client", () => ({
  api: {
    documents: vi.fn(),
    deleteProduct: vi.fn(),
    linkProductToDocument: vi.fn(),
    products: vi.fn()
  }
}));

import { api } from "../../src/api/client";

describe("ProductsPage", () => {
  beforeEach(() => {
    vi.mocked(api.documents).mockResolvedValue({
      documents: [
        {
          documentId: "doc-1",
          fileName: "sealant-msds.pdf",
          status: "needs_review",
          uploadedAt: "2026-04-25T00:00:00.000Z",
          componentCount: 3,
          queueCount: 0
        },
        {
          documentId: "doc-2",
          fileName: "cleaner-msds.pdf",
          status: "needs_review",
          uploadedAt: "2026-04-25T01:00:00.000Z",
          componentCount: 5,
          queueCount: 2
        }
      ]
    });
    vi.mocked(api.products).mockResolvedValue({ products: [] });
    vi.mocked(api.deleteProduct).mockResolvedValue({ products: [] });
    vi.mocked(api.linkProductToDocument).mockResolvedValue({
      product: {
        productId: "product-1",
        documentId: "doc-1",
        documentFileName: "sealant-msds.pdf",
        productName: "sealant-msds",
        supplier: "",
        manufacturer: "",
        siteNames: "1공장",
        registrationStatus: "linked_to_site"
      },
      products: [
        {
          productId: "product-1",
          documentId: "doc-1",
          documentFileName: "sealant-msds.pdf",
          productName: "sealant-msds",
          supplier: "",
          manufacturer: "",
          siteNames: "1공장",
          registrationStatus: "linked_to_site"
        }
      ]
    });
  });

  it("links an uploaded MSDS document to site names", async () => {
    render(<ProductsPage />);

    expect(await screen.findByDisplayValue("sealant-msds")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("사용현장"), { target: { value: "1공장" } });
    fireEvent.click(screen.getByRole("button", { name: "선택 MSDS를 현장에 묶기" }));

    await waitFor(() => expect(api.linkProductToDocument).toHaveBeenCalledWith({
      documentIds: ["doc-1"],
      productName: "sealant-msds",
      supplier: "",
      manufacturer: "",
      siteNames: "1공장"
    }));
    expect(await screen.findByText("MSDS와 사용현장을 연결했습니다.")).toBeInTheDocument();
    expect(screen.getAllByText("1공장").length).toBeGreaterThan(0);
  });

  it("links multiple MSDS documents to one site and shows the site dashboard", async () => {
    vi.mocked(api.linkProductToDocument).mockResolvedValue({
      product: {
        productId: "product-1",
        documentId: "doc-1",
        documentFileName: "sealant-msds.pdf",
        productName: "sealant-msds",
        supplier: "",
        manufacturer: "",
        siteNames: "1공장",
        registrationStatus: "linked_to_site",
        documentStatus: "needs_review",
        componentCount: 3,
        queueCount: 0
      },
      products: [
        {
          productId: "product-1",
          documentId: "doc-1",
          documentFileName: "sealant-msds.pdf",
          productName: "sealant-msds",
          supplier: "",
          manufacturer: "",
          siteNames: "1공장",
          registrationStatus: "linked_to_site",
          documentStatus: "needs_review",
          componentCount: 3,
          queueCount: 0
        },
        {
          productId: "product-2",
          documentId: "doc-2",
          documentFileName: "cleaner-msds.pdf",
          productName: "cleaner-msds",
          supplier: "",
          manufacturer: "",
          siteNames: "1공장",
          registrationStatus: "linked_to_site",
          documentStatus: "needs_review",
          componentCount: 5,
          queueCount: 2
        }
      ]
    });
    render(<ProductsPage />);

    expect(await screen.findByText("현장 관리 조회")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "cleaner-msds.pdf 추가" }));
    fireEvent.change(screen.getByLabelText("사용현장"), { target: { value: "1공장" } });
    fireEvent.click(screen.getByRole("button", { name: "선택 MSDS를 현장에 묶기" }));

    await waitFor(() => expect(api.linkProductToDocument).toHaveBeenCalledWith({
      documentIds: ["doc-1", "doc-2"],
      productName: "",
      supplier: "",
      manufacturer: "",
      siteNames: "1공장"
    }));
    expect((await screen.findAllByText("1공장")).length).toBeGreaterThan(0);
    const siteSection = screen.getByRole("heading", { name: "현장 관리 조회" }).closest("section");
    expect(siteSection).not.toBeNull();
    expect(within(siteSection as HTMLElement).getByText("sealant-msds.pdf")).toBeInTheDocument();
    expect(within(siteSection as HTMLElement).getByText("cleaner-msds.pdf")).toBeInTheDocument();
    expect(within(siteSection as HTMLElement).getByText("검수 필요")).toBeInTheDocument();
  });

  it("filters product links by search text and management status", async () => {
    vi.mocked(api.products).mockResolvedValue({
      products: [
        {
          productId: "product-1",
          documentId: "doc-1",
          documentFileName: "sealant-msds.pdf",
          productName: "sealant-msds",
          supplier: "공급사",
          manufacturer: "제조사",
          siteNames: "1공장",
          registrationStatus: "linked_to_site",
          documentStatus: "needs_review",
          componentCount: 3,
          queueCount: 0
        },
        {
          productId: "product-2",
          documentId: "doc-2",
          documentFileName: "cleaner-msds.pdf",
          productName: "cleaner-msds",
          supplier: "공급사",
          manufacturer: "제조사",
          siteNames: "2공장",
          registrationStatus: "linked_to_site",
          documentStatus: "needs_review",
          componentCount: 5,
          queueCount: 2
        }
      ]
    });
    render(<ProductsPage />);

    expect((await screen.findAllByText("1공장")).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "cleaner" } });

    const productSection = screen.getByRole("heading", { name: "MSDS별 연결 현황" }).closest("section");
    expect(productSection).not.toBeNull();
    expect(within(productSection as HTMLElement).queryByText("sealant-msds.pdf")).not.toBeInTheDocument();
    expect(within(productSection as HTMLElement).getByText(/cleaner-msds\.pdf/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("상태"), { target: { value: "needs_review" } });
    expect(within(productSection as HTMLElement).getByText(/cleaner-msds\.pdf/)).toBeInTheDocument();
  });

  it("limits the MSDS picker and finds documents through search", async () => {
    vi.mocked(api.documents).mockResolvedValue({
      documents: Array.from({ length: 25 }, (_, index) => ({
        documentId: `doc-${index + 1}`,
        fileName: `bulk-${String(index + 1).padStart(2, "0")}.pdf`,
        status: "needs_review",
        uploadedAt: "2026-04-25T00:00:00.000Z",
        componentCount: index,
        queueCount: 0
      }))
    });
    render(<ProductsPage />);

    expect(await screen.findByText("전체 25건 중 8건 표시")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bulk-08.pdf 추가" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "bulk-25.pdf 추가" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("MSDS 검색"), { target: { value: "bulk-25" } });

    expect(screen.getByText("검색 결과 1건")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bulk-25.pdf 추가" })).toBeInTheDocument();
  });

  it("shows a site management lookup with counts and attention items", async () => {
    vi.mocked(api.products).mockResolvedValue({
      products: [
        {
          productId: "product-1",
          documentId: "doc-1",
          documentFileName: "sealant-msds.pdf",
          productName: "sealant-msds",
          supplier: "공급사",
          manufacturer: "제조사",
          siteNames: "1공장",
          registrationStatus: "revision_needed",
          documentStatus: "needs_review",
          componentCount: 3,
          queueCount: 0
        },
        {
          productId: "product-2",
          documentId: "doc-2",
          documentFileName: "cleaner-msds.pdf",
          productName: "cleaner-msds",
          supplier: "공급사",
          manufacturer: "제조사",
          siteNames: "1공장",
          registrationStatus: "linked_to_site",
          documentStatus: "needs_review",
          componentCount: 5,
          queueCount: 2
        },
        {
          productId: "product-3",
          documentId: "doc-3",
          documentFileName: "paint-msds.pdf",
          productName: "paint-msds",
          supplier: "공급사",
          manufacturer: "제조사",
          siteNames: "2공장",
          registrationStatus: "linked_to_site",
          documentStatus: "needs_review",
          componentCount: 1,
          queueCount: 0
        }
      ]
    });
    render(<ProductsPage />);

    const siteSection = (await screen.findByRole("heading", { name: "현장 관리 조회" })).closest("section");
    expect(siteSection).not.toBeNull();
    fireEvent.change(screen.getByLabelText("현장 검색"), { target: { value: "1공장" } });

    expect(within(siteSection as HTMLElement).getByRole("button", { name: "1공장 현장 조회" })).toBeInTheDocument();
    expect(within(siteSection as HTMLElement).queryByRole("button", { name: "2공장 현장 조회" })).not.toBeInTheDocument();
    expect(within(siteSection as HTMLElement).getByText("MSDS 등록 2건")).toBeInTheDocument();
    expect(within(siteSection as HTMLElement).getByText("개정 필요 1건")).toBeInTheDocument();
    expect(within(siteSection as HTMLElement).getByText("검수 필요 1건")).toBeInTheDocument();
    expect(within(siteSection as HTMLElement).getByText("sealant-msds.pdf")).toBeInTheDocument();
    expect(within(siteSection as HTMLElement).getByText("cleaner-msds.pdf")).toBeInTheDocument();
  });

  it("matches Korean search text even when uploaded file names are decomposed Unicode", async () => {
    const decomposedProductName = "용접봉CSW-0001".normalize("NFD");
    vi.mocked(api.products).mockResolvedValue({
      products: [
        {
          productId: "product-1",
          documentId: "doc-1",
          documentFileName: `${decomposedProductName}.pdf`,
          productName: decomposedProductName,
          supplier: "",
          manufacturer: "",
          siteNames: "2STS",
          registrationStatus: "linked_to_site",
          documentStatus: "needs_review",
          componentCount: 7,
          queueCount: 0
        }
      ]
    });
    render(<ProductsPage />);

    expect((await screen.findAllByText(decomposedProductName)).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "용접봉" } });

    expect(screen.getAllByText(decomposedProductName).length).toBeGreaterThan(0);
  });

  it("deletes a linked product/site record from the management list", async () => {
    vi.mocked(api.products).mockResolvedValue({
      products: [
        {
          productId: "product-1",
          documentId: "doc-1",
          documentFileName: "sealant-msds.pdf",
          productName: "sealant-msds",
          supplier: "공급사",
          manufacturer: "제조사",
          siteNames: "1공장",
          registrationStatus: "linked_to_site"
        }
      ]
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ProductsPage />);

    expect((await screen.findAllByText("1공장")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "sealant-msds 제품 삭제" }));

    await waitFor(() => expect(api.deleteProduct).toHaveBeenCalledWith("product-1"));
    expect(await screen.findByText("제품/현장 연결을 삭제했습니다.")).toBeInTheDocument();
  });
});
