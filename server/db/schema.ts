import type Database from "better-sqlite3";

export function migrate(db: Database.Database) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS documents (
      document_id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      status TEXT NOT NULL,
      review_state TEXT NOT NULL DEFAULT 'approved',
      review_reason TEXT NOT NULL DEFAULT '',
      review_required_at TEXT NOT NULL DEFAULT '',
      review_completed_at TEXT NOT NULL DEFAULT '',
      last_regulatory_checked_at TEXT NOT NULL DEFAULT '',
      replacement_uploaded_at TEXT NOT NULL DEFAULT '',
      uploaded_at TEXT NOT NULL,
      text_content TEXT NOT NULL DEFAULT '',
      page_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      product_id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL DEFAULT '',
      document_file_name TEXT NOT NULL DEFAULT '',
      product_name TEXT NOT NULL,
      supplier TEXT NOT NULL DEFAULT '',
      manufacturer TEXT NOT NULL DEFAULT '',
      site_names TEXT NOT NULL DEFAULT '',
      registration_status TEXT NOT NULL DEFAULT 'not_registered',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS components (
      row_id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      row_index INTEGER NOT NULL,
      raw_row_text TEXT NOT NULL,
      cas_no_candidate TEXT NOT NULL,
      chemical_name_candidate TEXT NOT NULL,
      content_min_candidate TEXT NOT NULL,
      content_max_candidate TEXT NOT NULL,
      content_single_candidate TEXT NOT NULL,
      content_text TEXT NOT NULL,
      confidence REAL NOT NULL,
      evidence_location TEXT NOT NULL,
      review_status TEXT NOT NULL,
      ai_review_status TEXT NOT NULL DEFAULT 'not_reviewed',
      ai_review_note TEXT NOT NULL DEFAULT '',
      regulatory_match_status TEXT NOT NULL DEFAULT 'not_checked',
      FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS regulatory_matches (
      match_id TEXT PRIMARY KEY,
      row_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      cas_no TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      evidence_text TEXT NOT NULL,
      checked_at TEXT NOT NULL,
      FOREIGN KEY (row_id) REFERENCES components(row_id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chemical_api_cache (
      cache_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      cas_no TEXT NOT NULL,
      request_url TEXT NOT NULL,
      response_text TEXT NOT NULL,
      status TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      UNIQUE(provider, cas_no)
    );

    CREATE TABLE IF NOT EXISTS review_queue (
      queue_id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      entity_id TEXT NOT NULL DEFAULT '',
      field_type TEXT NOT NULL,
      label TEXT NOT NULL,
      candidate_value TEXT NOT NULL,
      evidence TEXT NOT NULL,
      review_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS document_basic_info (
      document_id TEXT NOT NULL,
      info_key TEXT NOT NULL,
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      source TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (document_id, info_key),
      FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS regulatory_seeds (
      seed_id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      cas_no TEXT NOT NULL,
      chemical_name_ko TEXT NOT NULL,
      chemical_name_en TEXT NOT NULL,
      synonyms TEXT NOT NULL,
      threshold_text TEXT NOT NULL,
      period_value TEXT NOT NULL,
      period_unit TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_revision_date TEXT NOT NULL,
      note TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_regulatory_seeds_cas_no ON regulatory_seeds(cas_no);
    CREATE INDEX IF NOT EXISTS idx_components_document_id ON components(document_id);
    CREATE INDEX IF NOT EXISTS idx_review_queue_status ON review_queue(review_status);
    CREATE INDEX IF NOT EXISTS idx_regulatory_matches_row_id ON regulatory_matches(row_id);
    CREATE INDEX IF NOT EXISTS idx_chemical_api_cache_provider_cas ON chemical_api_cache(provider, cas_no);

    CREATE TABLE IF NOT EXISTS audit_logs (
      audit_id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      before_json TEXT NOT NULL,
      after_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      watch_id TEXT PRIMARY KEY,
      cas_no TEXT NOT NULL UNIQUE,
      chemical_name TEXT NOT NULL,
      last_source_name TEXT NOT NULL,
      last_checked_at TEXT NOT NULL,
      status TEXT NOT NULL
    );
  `);

  ensureProductsPrimaryKeySchema(db);
  ensureColumn(db, "components", "ai_review_status", "TEXT NOT NULL DEFAULT 'not_reviewed'");
  ensureColumn(db, "components", "ai_review_note", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "components", "regulatory_match_status", "TEXT NOT NULL DEFAULT 'not_checked'");
  ensureColumn(db, "review_queue", "entity_id", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "products", "document_id", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "products", "document_file_name", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "documents", "review_state", "TEXT NOT NULL DEFAULT 'approved'");
  ensureColumn(db, "documents", "review_reason", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "documents", "review_required_at", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "documents", "review_completed_at", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "documents", "last_regulatory_checked_at", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "documents", "replacement_uploaded_at", "TEXT NOT NULL DEFAULT ''");
}

function ensureColumn(db: Database.Database, tableName: string, columnName: string, definition: string) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (!rows.some((row) => row.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function ensureProductsPrimaryKeySchema(db: Database.Database) {
  const columns = db.prepare("PRAGMA table_info(products)").all() as Array<{ name: string }>;
  if (columns.some((row) => row.name === "product_id")) return;

  const legacyTableName = `products_legacy_${Date.now()}`;
  db.exec(`
    ALTER TABLE products RENAME TO ${legacyTableName};

    CREATE TABLE products (
      product_id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL DEFAULT '',
      document_file_name TEXT NOT NULL DEFAULT '',
      product_name TEXT NOT NULL,
      supplier TEXT NOT NULL DEFAULT '',
      manufacturer TEXT NOT NULL DEFAULT '',
      site_names TEXT NOT NULL DEFAULT '',
      registration_status TEXT NOT NULL DEFAULT 'not_registered',
      created_at TEXT NOT NULL
    );
  `);

  const hasColumn = (columnName: string) => columns.some((row) => row.name === columnName);
  const valueExpression = (columnName: string, fallback: string) => (hasColumn(columnName) ? columnName : fallback);
  const productIdExpression = hasColumn("id")
    ? "COALESCE(NULLIF(id, ''), lower(hex(randomblob(16))))"
    : "lower(hex(randomblob(16)))";

  db.exec(`
    INSERT INTO products (
      product_id, document_id, document_file_name, product_name, supplier,
      manufacturer, site_names, registration_status, created_at
    )
    SELECT
      ${productIdExpression},
      ${valueExpression("document_id", "''")},
      ${valueExpression("document_file_name", "''")},
      ${valueExpression("product_name", "'미등록 제품'")},
      ${valueExpression("supplier", "''")},
      ${valueExpression("manufacturer", "''")},
      ${valueExpression("site_names", "''")},
      ${valueExpression("registration_status", "'not_registered'")},
      ${valueExpression("created_at", "datetime('now')")}
    FROM ${legacyTableName};
  `);
}
