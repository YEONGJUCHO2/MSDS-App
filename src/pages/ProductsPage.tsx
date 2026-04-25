import { useEffect, useState } from "react";
import type { ProductSummary } from "../../shared/types";
import { api } from "../api/client";

export function ProductsPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);

  useEffect(() => {
    void api.products().then((result) => setProducts(result.products));
  }, []);

  return (
    <main className="watchlist-page">
      <section className="panel">
        <div className="panel-title">
          <h2>제품/현장 관리</h2>
          <span>{products.length}개 제품 · CSV 마스터 import API 준비됨</span>
        </div>
        <div className="explain-flow">
          <article>
            <strong>1. 기존 관리대장 import</strong>
            <span>제품명, 공급사, 제조사, 현장명을 CSV로 가져와 기본 제품/현장 마스터를 만듭니다.</span>
          </article>
          <article>
            <strong>2. MSDS 연결 예정</strong>
            <span>다음 단계에서 업로드한 MSDS의 제품명/성분/CAS를 확인 완료하면 제품 데이터와 연결합니다.</span>
          </article>
          <article>
            <strong>3. 현장 매핑</strong>
            <span>제품이 쓰이는 현장, 보관 위치, 게시본 위치를 연결해 변경 시 영향 현장을 찾습니다.</span>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>제품 목록</h2>
          <span>관리 마스터</span>
        </div>
        <div className="watchlist-table">
          {products.length === 0 ? (
            <div className="empty">아직 제품 마스터가 없습니다. 기존 관리대장 CSV import 또는 MSDS 확인 완료 후 제품/현장 데이터가 채워집니다.</div>
          ) : null}
          {products.map((product) => (
            <article className="watchlist-row product-row" key={product.productId}>
              <div>
                <strong>{product.productName || "제품명 확인 필요"}</strong>
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
