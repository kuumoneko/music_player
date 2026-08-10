import db from "../setup.ts"

const upsertLog = db.prepare(`
  INSERT INTO log (date, type, source, message)
  VALUES ($date, $type, $source, $message);
`);

const writeLog = (log: { type: "error" | "info", source?: string, message: string }) => {
    upsertLog.run({
        $date: `${new Date().toLocaleDateString("sv-SE")} ${new Date().toLocaleTimeString("sv-SE")}`,
        $type: log.type,
        $source: log.source ?? null,
        $message: log.message
    });
};

const writeLogs = db.transaction((logs: { type: "error" | "info", source?: string, message: string }[]) => {
    for (const log of logs) {
        writeLog(log);
    }
});

export default writeLogs