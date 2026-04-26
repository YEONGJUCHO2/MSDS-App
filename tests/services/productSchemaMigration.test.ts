import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate } from "../../server/db/schema";

describe("product schema migration", () => {
  it("upgrades legacy product rows that do not have product_id", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        product_name TEXT NOT NULL,
        supplier TEXT NOT NULL DEFAULT '',
        manufacturer TEXT NOT NULL DEFAULT '',
        site_names TEXT NOT NULL DEFAULT '',
        registration_status TEXT NOT NULL DEFAULT 'not_registered',
        created_at TEXT NOT NULL
      );

      INSERT INTO products (
        id, product_name, supplier, manufacturer, site_names, registration_status, created_at
      ) VALUES (
        'legacy-product-1', '용접봉', '공급사', '제조사', '2STS', 'linked_to_site', '2026-04-26T00:00:00.000Z'
      );
    `);

    migrate(db);

    expect(db.prepare("PRAGMA table_info(products)").all()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "product_id" }),
        expect.objectContaining({ name: "document_id" }),
        expect.objectContaining({ name: "document_file_name" })
      ])
    );
    expect(db.prepare(`
      SELECT
        product_id AS productId,
        product_name AS productName,
        supplier,
        manufacturer,
        site_names AS siteNames,
        registration_status AS registrationStatus
      FROM products
    `).all()).toEqual([
      {
        productId: "legacy-product-1",
        productName: "용접봉",
        supplier: "공급사",
        manufacturer: "제조사",
        siteNames: "2STS",
        registrationStatus: "linked_to_site"
      }
    ]);
  });
});
