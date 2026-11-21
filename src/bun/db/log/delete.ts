import db from "../setup.ts"

export default function deleteLogs() {
    db.run("DELETE FROM log;");
}

const pruneLogsStmt = db.prepare(`
  DELETE FROM log
  WHERE id NOT IN (SELECT id FROM log ORDER BY id DESC LIMIT $keep);
`);

/** Keeps the newest `keep` rows so errors from previous runs stay inspectable. */
export function pruneLogs(keep: number = 2000) {
    try {
        pruneLogsStmt.run({ $keep: keep });
    } catch {
        // retention is best-effort, never block startup
    }
}
