import { useEffect, useState } from "react";
import type { DocumentSummary, ProductSummary } from "../../shared/types";
import { api } from "../api/client";

export function ProductsPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [documentSearch, setDocumentSearch] = useState("");
  const [siteNames, setSiteNames] = useState("");
  const [selectedSiteName, setSelectedSiteName] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    void Promise.all([api.products(), api.documents()]).then(([productResult, documentResult]) => {
      setProducts(productResult.products);
      setDocuments(documentResult.documents);
    });
  }, []);

  function toggleDocument(documentId: string) {
    setSelectedDocumentIds((current) => {
      if (current.includes(documentId)) return current.filter((id) => id !== documentId);
      return [...current, documentId];
    });
  }

  async function linkProduct() {
    if (selectedDocumentIds.length === 0 || !siteNames.trim() || saving) return;
    setSaving(true);
    setFeedback("");
    try {
      const result = await api.linkProductToDocument({
        documentIds: selectedDocumentIds,
        productName: "",
        supplier: "",
        manufacturer: "",
        siteNames
      });
      setProducts(result.products);
      setFeedback("MSDS와 사용현장을 연결했습니다.");
      setSiteNames("");
      setSelectedDocumentIds([]);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "연결에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product: ProductSummary) {
    if (!window.confirm(`${product.productName || "제품"} 현장관리 연결을 삭제할까요?`)) return;
    setFeedback("");
    try {
      const result = await api.deleteProduct(product.productId);
      setProducts(result.products);
      setFeedback("현장관리 연결을 삭제했습니다.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  }

  const siteGroups = groupProductsBySite(products);
  const activeSiteGroup = siteGroups.find((group) => group.siteName === selectedSiteName) ?? siteGroups[0];
  const selectedSiteProducts = activeSiteGroup?.items ?? [];
  const visibleProducts = selectedSiteProducts.filter((product) => {
    const query = toSearchValue(search);
    const status = productManagementStatus(product).key;
    const searchable = [
      product.productName,
      product.documentFileName,
      product.siteNames,
      product.supplier,
      product.manufacturer
    ].join(" ");
    const searchTarget = toSearchValue(searchable);
    return (!query || searchTarget.includes(query)) && (statusFilter === "all" || statusFilter === status);
  });
  const selectedDocuments = selectedDocumentIds
    .map((documentId) => documents.find((document) => document.documentId === documentId))
    .filter((document): document is DocumentSummary => Boolean(document));
  const filteredDocuments = documents.filter((document) => toSearchValue(document.fileName).includes(toSearchValue(documentSearch)));
  const documentResultLabel = documentSearch.trim()
    ? `검색 결과 ${filteredDocuments.length}건`
    : `전체 ${documents.length}건`;

  return (
    <main className="watchlist-page">
      <section className="panel">
        <div className="panel-title">
          <h2>현장관리</h2>
          <span>{products.length}개 제품 · 업로드 MSDS {documents.length}건</span>
        </div>
        <div className="product-link-form">
          <div className="document-picker-panel">
            <label>
              MSDS 검색
              <input placeholder="파일명으로 검색" value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} />
            </label>
            <div className="document-picker-meta">
              <span>{documents.length === 0 ? "업로드된 MSDS 없음" : documentResultLabel}</span>
              <strong>선택 {selectedDocuments.length}건</strong>
            </div>
            <div className="document-check-list" aria-label="등록된 MSDS">
              {filteredDocuments.map((document) => {
                const selected = selectedDocumentIds.includes(document.documentId);
                return (
                  <label className="document-check-row" key={document.documentId}>
                    <input checked={selected} onChange={() => toggleDocument(document.documentId)} type="checkbox" />
                    <span>{document.fileName}</span>
                  </label>
                );
              })}
              {filteredDocuments.length === 0 ? <div className="empty compact">검색된 MSDS가 없습니다.</div> : null}
            </div>
          </div>
          <div className="product-link-details">
            <label>
              사용현장
              <input placeholder="예: 1공장, 분석실" value={siteNames} onChange={(event) => setSiteNames(event.target.value)} />
            </label>
            <div className="edit-actions">
              <button disabled={selectedDocumentIds.length === 0 || !siteNames.trim() || saving} onClick={() => void linkProduct()} type="button">
                {saving ? "연결중" : "선택 MSDS를 현장에 묶기"}
              </button>
            </div>
          </div>
        </div>
        {feedback ? <p className="lookup-feedback compact">{feedback}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>현장 관리 조회</h2>
          <span>{siteGroups.length}개 현장</span>
        </div>
        <div className="site-lookup-controls">
          <span className="site-lookup-label">현장 선택</span>
          <div className="site-slot-list" aria-label="현장 슬롯">
            {siteGroups.map((group) => {
              const summary = summarizeSiteGroup(group.items);
              const active = activeSiteGroup?.siteName === group.siteName;
              return (
                <button
                  aria-label={`${group.siteName} 현장 조회`}
                  className={[
                    "site-slot",
                    active ? "active" : "",
                    summary.needsReview > 0 ? "needs-review" : ""
                  ].filter(Boolean).join(" ")}
                  key={group.siteName}
                  onClick={() => setSelectedSiteName(group.siteName)}
                  type="button"
                >
                  <strong>{group.siteName}</strong>
                  <span>MSDS {summary.total}건</span>
                  <span>개정 {summary.revisionNeeded} · 검수 {summary.needsReview}</span>
                </button>
              );
            })}
          </div>
        </div>
        {siteGroups.length === 0 ? (
          <div className="empty">현장관리 연결을 등록하면 현장별 MSDS 관리 현황이 표시됩니다.</div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>MSDS별 연결 현황</h2>
          <span>{activeSiteGroup ? `${activeSiteGroup.siteName} 기준` : "현장 선택 필요"}</span>
        </div>
        <div className="product-filters">
          <label>
            검색
            <input placeholder="제품명, MSDS, 공급사 검색" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label>
            상태
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">전체</option>
              <option value="normal">정상</option>
              <option value="needs_review">검수 필요</option>
              <option value="revision_needed">개정 필요</option>
              <option value="unlinked">MSDS 미연결</option>
            </select>
          </label>
        </div>
        <div className="watchlist-table">
          {visibleProducts.length === 0 ? (
            <div className="empty">선택한 현장에 표시할 MSDS 연결 현황이 없습니다.</div>
          ) : null}
          {visibleProducts.map((product) => {
            const status = productManagementStatus(product);
            return (
            <article className="watchlist-row product-row" key={product.productId}>
              <div>
                <strong>{product.productName || "제품명 확인 필요"}</strong>
                <span>파일: {product.documentFileName || "MSDS 미연결"}</span>
                <span>{product.supplier || "공급사 없음"} · {product.manufacturer || "제조사 없음"}</span>
              </div>
              <span>{product.siteNames || "현장 미연결"}</span>
              <span className={`status-pill ${status.key}`}>{status.label}</span>
              <button
                aria-label={`${product.productName || "제품"} 제품 삭제`}
                className="table-action danger"
                onClick={() => void deleteProduct(product)}
                type="button"
              >
                삭제
              </button>
            </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function toSearchValue(value: string) {
  return value.trim().normalize("NFC").toLowerCase();
}

function groupProductsBySite(products: ProductSummary[]) {
  const groups = new Map<string, ProductSummary[]>();
  for (const product of products) {
    const siteNames = product.siteNames.split(",").map((siteName) => siteName.trim()).filter(Boolean);
    for (const siteName of siteNames.length > 0 ? siteNames : ["현장 미연결"]) {
      groups.set(siteName, [...(groups.get(siteName) ?? []), product]);
    }
  }
  return Array.from(groups.entries()).map(([siteName, items]) => ({ siteName, items }));
}

function summarizeSiteGroup(products: ProductSummary[]) {
  return products.reduce(
    (summary, product) => {
      const status = productManagementStatus(product).key;
      return {
        total: summary.total + 1,
        revisionNeeded: summary.revisionNeeded + (status === "revision_needed" ? 1 : 0),
        needsReview: summary.needsReview + (status === "needs_review" ? 1 : 0)
      };
    },
    { total: 0, revisionNeeded: 0, needsReview: 0 }
  );
}

function productManagementStatus(product: ProductSummary) {
  if (!product.documentId) return { key: "unlinked", label: "MSDS 미연결" };
  if (product.registrationStatus.includes("revision") || product.registrationStatus.includes("개정")) {
    return { key: "revision_needed", label: "개정 필요" };
  }
  if ((product.queueCount ?? 0) > 0) return { key: "needs_review", label: "검수 필요" };
  return { key: "normal", label: "정상" };
}
