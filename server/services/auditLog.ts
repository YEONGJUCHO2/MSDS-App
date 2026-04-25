import type Database from "better-sqlite3";
import { nanoid } from "nanoid";

export function writeAuditLog(
  db: Database.Database,
  input: { actor: string; action: string; entityType: string; entityId: string; before?: unknown; after?: unknown }
) {
  db.prepare(`
    INSERT INTO audit_logs (audit_id, actor, action, entity_type, entity_id, before_json, after_json, created_at)
    VALUES (@auditId, @actor, @action, @entityType, @entityId, @beforeJson, @afterJson, @createdAt)
  `).run({
    auditId: nanoid(),
    actor: input.actor,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeJson: JSON.stringify(input.before ?? null),
    afterJson: JSON.stringify(input.after ?? null),
    createdAt: new Date().toISOString()
  });
}
