import db from "../setup.ts"

const upsertLog = db.prepare(`
  INSERT INTO log (
  date, type, message
  )
  VALUES (
    $date, $type, $message
  );
`);

const writeLog = db.transaction((log: { type: "error" | "info", message: string }) => {
    upsertLog.run({
        $date: `${new Date().toLocaleDateString("sv-SE")} ${new Date().toLocaleTimeString("sv-SE")}`,
        $type: log.type,
        $message: log.message
    });
});

const writeLogs = db.transaction((logs: { type: "error" | "info", message: string }[]) => {
    for (const log of logs) {
        writeLog(log);
    }
});

export default writeLogs