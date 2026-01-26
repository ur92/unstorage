import { afterAll, beforeAll, describe, expect, it } from "vitest";
import driver from "../../src/drivers/mongodb";
import { testDriver } from "./utils";
import { MongoMemoryServer } from "mongodb-memory-server";
import { promisify } from "util";

const sleep = promisify(setTimeout);

let mongoServer: MongoMemoryServer | null = null;
let connectionString: string | null = null;
let skipTests = false;

// Try to create the mongo server, skip tests if it fails (missing system libraries)
try {
  mongoServer = await MongoMemoryServer.create();
  connectionString = mongoServer.getUri();
} catch (error: any) {
  console.warn(
    `[mongodb.test.ts] Skipping tests: ${
      error.message || "MongoMemoryServer failed to start"
    }`
  );
  skipTests = true;
}

const describeOrSkip = skipTests ? describe.skip : describe;

describeOrSkip("drivers: mongodb", () => {
  afterAll(async () => {
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  testDriver({
    driver: driver({
      connectionString: connectionString!,
      databaseName: "test",
      collectionName: "test",
    }),
    additionalTests: (ctx) => {
      it("should throw error if no connection string is provided", async () => {
        expect(() =>
          driver({
            databaseName: "test",
            collectionName: "test",
          } as any).getItem("")
        ).rejects.toThrowError(
          "[unstorage] MongoDB driver requires a connection string to be provided."
        );
      });
      it("should have different dates when an entry was updated", async () => {
        await ctx.storage.setItem("s1:a", "test_data");
        await sleep(100);
        await ctx.storage.setItem("s1:a", "updated_test_data");
        const result = await ctx.storage.getMeta("s1:a");
        expect(result.mtime).not.toBe(result.birthtime);
      });
    },
  });
});
