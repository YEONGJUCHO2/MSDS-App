import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductsPage } from "../../src/pages/ProductsPage";

vi.mock("../../src/api/client", () => ({
  api: {
    documents: vi.fn(),
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
        }
      ]
    });
    vi.mocked(api.products).mockResolvedValue({ products: [] });
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
    fireEvent.click(screen.getByRole("button", { name: "MSDS와 현장 묶기" }));

    await waitFor(() => expect(api.linkProductToDocument).toHaveBeenCalledWith({
      documentId: "doc-1",
      productName: "sealant-msds",
      supplier: "",
      manufacturer: "",
      siteNames: "1공장"
    }));
    expect(await screen.findByText("MSDS와 사용현장을 연결했습니다.")).toBeInTheDocument();
    expect(screen.getByText("1공장")).toBeInTheDocument();
  });
});
