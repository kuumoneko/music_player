import db from "../setup.ts"

export default function deleteLogs() {
    db.run("DELETE FROM log;");
}