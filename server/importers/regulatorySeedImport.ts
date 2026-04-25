import type Database from "better-sqlite3";
import { parse } from "csv-parse/sync";
import { nanoid } from "nanoid";

export function importRegulatorySeedCsv(db: Database.Database, csvText: string) {
  const records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true }) as Array<Record<string, string>>;
  const insert = db.prepare(`
    INSERT INTO regulatory_seeds (
      seed_id, category, cas_no, chemical_name_ko, chemical_name_en, synonyms,
      threshold_text, period_value, period_unit, source_name, source_url,
      source_revision_date, note
    ) VALUES (
      @seedId, @category, @casNo, @chemicalNameKo, @chemicalNameEn, @synonyms,
      @thresholdText, @periodValue, @periodUnit, @sourceName, @sourceUrl,
      @sourceRevisionDate, @note
    )
  `);

  const transaction = db.transaction(() => {
    for (const record of records) {
      insert.run({
        seedId: nanoid(),
        category: record.category ?? "",
        casNo: record.cas_no ?? "",
        chemicalNameKo: record.chemical_name_ko ?? "",
        chemicalNameEn: record.chemical_name_en ?? "",
        synonyms: record.synonyms ?? "",
        thresholdText: record.threshold_text ?? "",
        periodValue: record.period_value ?? "",
        periodUnit: record.period_unit ?? "",
        sourceName: record.source_name ?? "",
        sourceUrl: record.source_url ?? "",
        sourceRevisionDate: record.source_revision_date ?? "",
        note: record.note ?? ""
      });
    }
  });

  transaction();
  return { imported: records.length };
}
