import { useEffect, useState } from "react";
import type { DocumentSummary, ProductSummary } from "../../shared/types";
import { api } from "../api/client";

export function ProductsPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [productName, setProductName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [siteNames, setSiteNames] = useState("");
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

  function toggleDocument(documentId: string) {
    setSelectedDocumentIds((current) => {
      const next = current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId];
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
  const siteGroups = groupProductsBySite(visibleProducts);

  return (
    <main className="watchlist-page">
      <section className="panel">
        <div className="panel-title">
          <h2>제품/현장 관리</h2>
          <span>{products.length}개 제품 · 업로드 MSDS {documents.length}건</span>
        </div>
        <div className="product-link-form">
          <fieldset className="document-picker">
            <legend>MSDS 선택</legend>
            {documents.length === 0 ? <span>업로드된 MSDS 없음</span> : null}
            {documents.map((document) => (
              <label key={document.documentId}>
                <input
                  checked={selectedDocumentIds.includes(document.documentId)}
                  onChange={() => toggleDocument(document.documentId)}
                  type="checkbox"
                />
                {document.fileName}
              </label>
            ))}
          </fieldset>
          <label>
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
          <div className="edit-actions">
            <button disabled={selectedDocumentIds.length === 0 || !siteNames.trim() || saving} onClick={() => void linkProduct()} type="button">
              {saving ? "연결중" : "선택 MSDS를 현장에 묶기"}
            </button>
          </div>
        </div>
        {feedback ? <p className="lookup-feedback compact">{feedback}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>현장별 사용 MSDS</h2>
          <span>{siteGroups.length}개 현장</span>
        </div>
        {siteGroups.length === 0 ? (
          <div className="empty">업로드된 MSDS를 사용현장과 묶으면 현장별 사용 현황이 표시됩니다.</div>
        ) : null}
        <div className="site-dashboard">
          {siteGroups.map((group) => (
            <article className="site-card" key={group.siteName}>
              <div className="site-card-title">
                <strong>{group.siteName}</strong>
                <span>{group.items.length}개 MSDS 사용중</span>
              </div>
              <div className="watchlist-table">
                {group.items.map((product) => {
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
          ))}
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

function productManagementStatus(product: ProductSummary) {
  if (!product.documentId) return { key: "unlinked", label: "MSDS 미연결" };
  if (product.registrationStatus.includes("revision") || product.registrationStatus.includes("개정")) {
    return { key: "revision_needed", label: "개정 필요" };
  }
  if ((product.queueCount ?? 0) > 0) return { key: "needs_review", label: "검수 필요" };
  return { key: "normal", label: "정상" };
}
