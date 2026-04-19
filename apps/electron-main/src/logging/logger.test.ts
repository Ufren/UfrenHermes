import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  createLogger,
  initializeLogger,
  readAppLogs,
  resetLoggerForTests
} from "./logger.js";

void test("persists structured log lines and reads recent app logs", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ufren-logger-"));
  try {
    await resetLoggerForTests();
    initializeLogger({
      logDir: dir,
      fileName: "backend.log",
      consoleMinLevel: "error",
      fileMinLevel: "debug"
    });

    const logger = createLogger("test-component", { sessionId: "abc" });
    logger.info("hello logger", { step: "start" });
    logger.error("boom", { step: "explode" }, new Error("kaboom"));

    const snapshot = await readAppLogs(20);
    const fileContent = await readFile(join(dir, "backend.log"), "utf8");

    assert.equal(snapshot.filePath, join(dir, "backend.log"));
    assert.match(snapshot.content, /hello logger/);
    assert.match(snapshot.content, /kaboom/);
    assert.match(fileContent, /"component":"test-component"/);
    assert.match(fileContent, /"sessionId":"abc"/);
    assert.match(fileContent, /"message":"boom"/);
    assert.match(fileContent, /"name":"Error"/);
  } finally {
    await resetLoggerForTests();
    rmSync(dir, { recursive: true, force: true });
  }
});

