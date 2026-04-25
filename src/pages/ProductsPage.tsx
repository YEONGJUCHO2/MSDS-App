import { useEffect, useState } from "react";
import type { DocumentSummary, ProductSummary } from "../../shared/types";
import { api } from "../api/client";

export function ProductsPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [productName, setProductName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [siteNames, setSiteNames] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    void Promise.all([api.products(), api.documents()]).then(([productResult, documentResult]) => {
      setProducts(productResult.products);
      setDocuments(documentResult.documents);
      if (!selectedDocumentId && documentResult.documents[0]) {
        const document = documentResult.documents[0];
        setSelectedDocumentId(document.documentId);
        setProductName(stripPdf(document.fileName));
      }
    });
  }, []);

  function chooseDocument(documentId: string) {
    setSelectedDocumentId(documentId);
    const document = documents.find((item) => item.documentId === documentId);
    if (document) setProductName(stripPdf(document.fileName));
  }

  async function linkProduct() {
    if (!selectedDocumentId || !siteNames.trim() || saving) return;
    setSaving(true);
    setFeedback("");
    try {
      const result = await api.linkProductToDocument({
        documentId: selectedDocumentId,
        productName,
        supplier,
        manufacturer,
        siteNames
      });
      setProducts(result.products);
      setFeedback("MSDS와 사용현장을 연결했습니다.");
      setSiteNames("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "연결에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="watchlist-page">
      <section className="panel">
        <div className="panel-title">
          <h2>제품/현장 관리</h2>
          <span>{products.length}개 제품 · 업로드 MSDS {documents.length}건</span>
        </div>
        <div className="product-link-form">
          <label>
            MSDS
            <select value={selectedDocumentId} onChange={(event) => chooseDocument(event.target.value)}>
              {documents.length === 0 ? <option value="">업로드된 MSDS 없음</option> : null}
              {documents.map((document) => (
                <option key={document.documentId} value={document.documentId}>{document.fileName}</option>
              ))}
            </select>
          </label>
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
            <button disabled={!selectedDocumentId || !siteNames.trim() || saving} onClick={() => void linkProduct()} type="button">
              {saving ? "연결중" : "MSDS와 현장 묶기"}
            </button>
          </div>
        </div>
        {feedback ? <p className="lookup-feedback compact">{feedback}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>제품 목록</h2>
          <span>관리 마스터</span>
        </div>
        <div className="watchlist-table">
          {products.length === 0 ? (
            <div className="empty">업로드된 MSDS를 사용현장과 묶으면 제품 목록이 채워집니다.</div>
          ) : null}
          {products.map((product) => (
            <article className="watchlist-row product-row" key={product.productId}>
              <div>
                <strong>{product.productName || "제품명 확인 필요"}</strong>
                <span>{product.documentFileName || "MSDS 미연결"}</span>
                <span>{product.supplier || "공급사 없음"} · {product.manufacturer || "제조사 없음"}</span>
              </div>
              <span>{product.siteNames || "현장 미연결"}</span>
              <span>{product.registrationStatus}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function stripPdf(fileName: string) {
  return fileName.replace(/\.pdf$/i, "");
}
