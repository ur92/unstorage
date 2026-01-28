import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { webcrypto } from "node:crypto";
// Polyfill crypto for Azure SDK compatibility (needed for @typespec/ts-http-runtime)
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    writable: true,
    configurable: true,
  });
}

import driver from "../../src/drivers/azure-storage-table";
import { testDriver } from "./utils";
import { TableClient } from "@azure/data-tables";
import { ChildProcess, exec } from "child_process";

describe("drivers: azure-storage-table", () => {
  let azuriteProcess: ChildProcess;

  beforeAll(async () => {
    azuriteProcess = exec("npx azurite-table --silent");
    const client = TableClient.fromConnectionString(
      "UseDevelopmentStorage=true",
      "unstorage"
    );
    await client.createTable();
  });

  afterAll(() => {
    azuriteProcess.kill(9);
  });

  testDriver({
    driver: driver({
      connectionString: "UseDevelopmentStorage=true",
      accountName: "local",
    }),
  });
});
