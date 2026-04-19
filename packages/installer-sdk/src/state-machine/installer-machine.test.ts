import test from "node:test";
import assert from "node:assert/strict";

import type { InstallerContext } from "./installer-machine.js";
import { reduceInstallerState } from "./installer-machine.js";

void test("installer machine reaches ready through NEXT events", () => {
  let context: InstallerContext = { state: "idle" };
  context = reduceInstallerState(context, { type: "START" });
  context = reduceInstallerState(context, { type: "NEXT" });
  context = reduceInstallerState(context, { type: "NEXT" });
  context = reduceInstallerState(context, { type: "NEXT" });
  context = reduceInstallerState(context, { type: "NEXT" });
  context = reduceInstallerState(context, { type: "NEXT" });
  assert.equal(context.state, "ready");
});
