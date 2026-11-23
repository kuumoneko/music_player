import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// db/setup.ts resolves the data directory from process.argv the moment it is
// imported, so the test preload has to inject a throwaway directory first.
// Without this, importing any db-backed module would create/modify the real
// development database under the repository's data/ folder.
const existing = process.env["KUUMO_TEST_DATA_DIR"];
const dataDir = existing ?? join(tmpdir(), `kuumoapp-tests-${process.pid}`);

if (!existing) {
    try {
        rmSync(dataDir, { recursive: true, force: true });
    } catch {
        // A stale directory from a previous run must never fail the suite.
    }
    mkdirSync(dataDir, { recursive: true });
    process.env["KUUMO_TEST_DATA_DIR"] = dataDir;
}

process.argv.push("--data-dir", dataDir);
