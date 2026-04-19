import test from "node:test";
import assert from "node:assert/strict";

import { ufrenBrand } from "@ufren/shared";

import { HermesRuntimeManager } from "./runtime-manager.js";

void test("tailLogs clamps max lines", async () => {
  let receivedCommand = "";
  const fakeExecutor = {
    ensureWslAvailable: () => Promise.resolve(),
    listDistributions: () => Promise.resolve(["Ubuntu"]),
    runBash: (command: string) => {
      receivedCommand = command;
      return Promise.resolve("ok");
    }
  };
  const manager = new HermesRuntimeManager(
    {
      distribution: "Ubuntu",
      healthEndpoint: "http://127.0.0.1:8642/health",
      runtimeHome: "/home/user/.local/share/ufren-hermes/runtime/scripts"
    },
    fakeExecutor as never
  );

  await manager.tailLogs(9999);
  assert.match(receivedCommand, / 2000$/);
});

void test("health returns running when endpoint probe succeeds", async () => {
  const fakeExecutor = {
    ensureWslAvailable: () => Promise.resolve(),
    listDistributions: () => Promise.resolve(["Ubuntu"]),
    runBash: () => Promise.resolve("running")
  };
  const manager = new HermesRuntimeManager(
    {
      distribution: "Ubuntu",
      healthEndpoint: "http://127.0.0.1:8642/health",
      runtimeHome: "/home/user/.local/share/ufren-hermes/runtime/scripts"
    },
    fakeExecutor as never
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response('{"status":"ok"}', { status: 200 }));

  try {
    const health = await manager.health();
    assert.equal(health.status, "running");
    assert.equal(health.detail, `${ufrenBrand.productName} runtime healthy`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("health returns degraded when process is running but endpoint probe fails", async () => {
  const fakeExecutor = {
    ensureWslAvailable: () => Promise.resolve(),
    listDistributions: () => Promise.resolve(["Ubuntu"]),
    runBash: () => Promise.resolve("running")
  };
  const manager = new HermesRuntimeManager(
    {
      distribution: "Ubuntu",
      healthEndpoint: "http://127.0.0.1:8642/health",
      runtimeHome: "/home/user/.local/share/ufren-hermes/runtime/scripts"
    },
    fakeExecutor as never
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error("connect ECONNREFUSED"));

  try {
    const health = await manager.health();
    assert.equal(health.status, "degraded");
    assert.equal(
      health.detail,
      `${ufrenBrand.productName} runtime process is running, but the API health endpoint is unavailable`
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("health returns status-specific detail for stopped runtime", async () => {
  const fakeExecutor = {
    ensureWslAvailable: () => Promise.resolve(),
    listDistributions: () => Promise.resolve(["Ubuntu"]),
    runBash: () => Promise.resolve("stopped")
  };
  const manager = new HermesRuntimeManager(
    {
      distribution: "Ubuntu",
      healthEndpoint: "http://127.0.0.1:8642/health",
      runtimeHome: "/home/user/.local/share/ufren-hermes/runtime/scripts"
    },
    fakeExecutor as never
  );

  const health = await manager.health();
  assert.equal(health.status, "stopped");
  assert.equal(health.detail, `${ufrenBrand.productName} runtime is installed but not started`);
});
