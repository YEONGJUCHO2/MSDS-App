import { useEffect, useState } from "react";
import type { DocumentSummary, ProductSummary } from "../../shared/types";
import { api } from "../api/client";

const DOCUMENT_PICKER_LIMIT = 8;

export function ProductsPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [documentSearch, setDocumentSearch] = useState("");
  const [productName, setProductName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [siteNames, setSiteNames] = useState("");
  const [siteSearch, setSiteSearch] = useState("");
  const [selectedSiteName, setSelectedSiteName] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    void Promise.all([api.products(), api.documents()]).then(([productResult, documentResult]) => {
      setProducts(productResult.products);
      setDocuments(documentResult.documents);
      if (selectedDocumentIds.length === 0 && documentResult.documents[0]) {
        const document = documentResult.documents[0];
        setSelectedDocumentIds([document.documentId]);
        setProductName(stripPdf(document.fileName));
      }
    });
  }, []);

  function addDocument(documentId: string) {
    setSelectedDocumentIds((current) => {
      if (current.includes(documentId)) return current;
      const next = [...current, documentId];
      if (next.length === 1) {
        const document = documents.find((item) => item.documentId === next[0]);
        setProductName(document ? stripPdf(document.fileName) : "");
      } else {
        setProductName("");
      }
      return next;
    });
  }

  function removeDocument(documentId: string) {
    setSelectedDocumentIds((current) => {
      const next = current.filter((id) => id !== documentId);
      if (next.length === 1) {
        const document = documents.find((item) => item.documentId === next[0]);
        setProductName(document ? stripPdf(document.fileName) : "");
      } else {
        setProductName("");
      }
      return next;
    });
  }

  async function linkProduct() {
    if (selectedDocumentIds.length === 0 || !siteNames.trim() || saving) return;
    setSaving(true);
    setFeedback("");
    try {
      const result = await api.linkProductToDocument({
        documentIds: selectedDocumentIds,
        productName,
        supplier,
        manufacturer,
        siteNames
      });
      setProducts(result.products);
      setFeedback("MSDS와 사용현장을 연결했습니다.");
      setSiteNames("");
      setSelectedDocumentIds(documents[0] ? [documents[0].documentId] : []);
      setProductName(documents[0] ? stripPdf(documents[0].fileName) : "");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "연결에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product: ProductSummary) {
    if (!window.confirm(`${product.productName || "제품"} 제품/현장 연결을 삭제할까요?`)) return;
    setFeedback("");
    try {
      const result = await api.deleteProduct(product.productId);
      setProducts(result.products);
      setFeedback("제품/현장 연결을 삭제했습니다.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  }

  const visibleProducts = products.filter((product) => {
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
  const visibleDocumentResults = filteredDocuments.slice(0, DOCUMENT_PICKER_LIMIT);
  const documentResultLabel = documentSearch.trim()
    ? filteredDocuments.length > DOCUMENT_PICKER_LIMIT
      ? `검색 결과 ${filteredDocuments.length}건 중 ${visibleDocumentResults.length}건 표시`
      : `검색 결과 ${filteredDocuments.length}건`
    : `전체 ${documents.length}건 중 ${visibleDocumentResults.length}건 표시`;
  const siteGroups = groupProductsBySite(products);
  const filteredSiteGroups = siteGroups.filter((group) => toSearchValue(group.siteName).includes(toSearchValue(siteSearch)));
  const activeSiteGroup = filteredSiteGroups.find((group) => group.siteName === selectedSiteName) ?? filteredSiteGroups[0];
  const activeSiteSummary = activeSiteGroup ? summarizeSiteGroup(activeSiteGroup.items) : undefined;

  return (
    <main className="watchlist-page">
      <section className="panel">
        <div className="panel-title">
          <h2>제품/현장 관리</h2>
          <span>{products.length}개 제품 · 업로드 MSDS {documents.length}건</span>
        </div>
        <div className="product-link-form">
          <div className="document-picker-panel">
            <label>
              MSDS 검색
              <input placeholder="파일명으로 검색" value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} />
            </label>
            <div className="document-picker-meta">{documents.length === 0 ? "업로드된 MSDS 없음" : documentResultLabel}</div>
            <div className="document-result-list">
              {visibleDocumentResults.map((document) => {
                const selected = selectedDocumentIds.includes(document.documentId);
                return (
                  <div className="document-result-row" key={document.documentId}>
                    <span>{document.fileName}</span>
                    <button
                      aria-label={`${document.fileName} ${selected ? "선택됨" : "추가"}`}
                      disabled={selected}
                      onClick={() => addDocument(document.documentId)}
                      type="button"
                    >
                      {selected ? "선택됨" : "추가"}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="selected-document-slots" aria-label="선택된 MSDS">
              <strong>선택된 MSDS {selectedDocuments.length}건</strong>
              {selectedDocuments.length === 0 ? <span>현장에 묶을 MSDS를 검색해서 추가하세요.</span> : null}
              {selectedDocuments.map((document) => (
                <span className="selected-document-chip" key={document.documentId}>
                  {document.fileName}
                  <button aria-label={`${document.fileName} 선택 해제`} onClick={() => removeDocument(document.documentId)} type="button">
                    해제
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="product-link-details">
            <label className="wide-field">
              제품명
              <input value={productName} onChange={(event) => setProductName(event.target.value)} />
            </label>
            <label>
              사용현장
              <input placeholder="예: 1공장, 분석실" value={siteNames} onChange={(event) => setSiteNames(event.target.value)} />
            </label>
            <label>
              공급사
              <input value={supplier} onChange={(event) => setSupplier(event.target.value)} />
            </label>
            <label>
              제조사
              <input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} />
            </label>
            <div className="edit-actions wide-field">
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
          <label>
            현장 검색
            <input placeholder="현장명으로 조회" value={siteSearch} onChange={(event) => setSiteSearch(event.target.value)} />
          </label>
        </div>
        {filteredSiteGroups.length === 0 ? (
          <div className="empty">제품/현장 연결을 등록하면 현장별 MSDS 관리 현황이 표시됩니다.</div>
        ) : null}
        <div className="site-management-layout">
          <div className="site-slot-list" aria-label="현장 슬롯">
            {filteredSiteGroups.map((group) => {
              const summary = summarizeSiteGroup(group.items);
              const active = activeSiteGroup?.siteName === group.siteName;
              return (
                <button
                  aria-label={`${group.siteName} 현장 조회`}
                  className={active ? "site-slot active" : "site-slot"}
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
          {activeSiteGroup && activeSiteSummary ? (
            <article className="site-management-card">
              <div className="site-card-title">
                <strong>{activeSiteGroup.siteName}</strong>
                <span>{activeSiteSummary.total}개 MSDS 사용중</span>
              </div>
              <div className="site-summary-grid">
                <strong>MSDS 등록 {activeSiteSummary.total}건</strong>
                <strong>개정 필요 {activeSiteSummary.revisionNeeded}건</strong>
                <strong>검수 필요 {activeSiteSummary.needsReview}건</strong>
              </div>
              <div className="watchlist-table">
                {activeSiteGroup.items.map((product) => {
                  const status = productManagementStatus(product);
                  return (
                    <div className="site-msds-row" key={`site-${product.productId}`}>
                      <div>
                        <strong>{product.productName || "제품명 확인 필요"}</strong>
                        <span>{product.documentFileName || "MSDS 미연결"}</span>
                      </div>
                      <span className={`status-pill ${status.key}`}>{status.label}</span>
                    </div>
                  );
                })}
              </div>
            </article>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>MSDS별 연결 현황</h2>
          <span>검색/필터</span>
        </div>
        <div className="product-filters">
          <label>
            검색
            <input placeholder="현장, 제품명, MSDS, 공급사 검색" value={search} onChange={(event) => setSearch(event.target.value)} />
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
            <div className="empty">업로드된 MSDS를 사용현장과 묶으면 제품 목록이 채워집니다.</div>
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

function stripPdf(fileName: string) {
  return fileName.replace(/\.pdf$/i, "");
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
