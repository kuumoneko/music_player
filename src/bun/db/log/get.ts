import db from "../setup.ts"

const getAllLogsStmt = db.prepare(`
  SELECT date, type, message 
  FROM log 
  ORDER BY date ASC, id ASC;
`);

export default function getAllLogs() {
  try {
    return getAllLogsStmt.all() as { date: string; type: string; message: string }[];
  } catch {
    return [];
  }
}