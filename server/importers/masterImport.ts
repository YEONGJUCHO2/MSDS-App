import type Database from "better-sqlite3";
import { parse } from "csv-parse/sync";
import { nanoid } from "nanoid";

export function importProductMasterCsv(db: Database.Database, csvText: string) {
  const records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true }) as Array<Record<string, string>>;
  const insert = db.prepare(`
    INSERT INTO products (product_id, product_name, supplier, manufacturer, site_names, registration_status, created_at)
    VALUES (@productId, @productName, @supplier, @manufacturer, @siteNames, @registrationStatus, @createdAt)
  `);

  const transaction = db.transaction(() => {
    for (const record of records) {
      insert.run({
        productId: nanoid(),
        productName: record.product_name ?? "",
        supplier: record.supplier ?? "",
        manufacturer: record.manufacturer ?? "",
        siteNames: record.site_names ?? "",
        registrationStatus: "not_registered",
        createdAt: new Date().toISOString()
      });
    }
  });

  transaction();
  return { imported: records.length };
}
