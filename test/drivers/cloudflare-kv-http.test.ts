import { afterAll, beforeAll, describe, vi } from "vitest";
import { testDriver } from "./utils";

// Shared store that will be used by the mock
const store: Record<string, string> = {};

// Mock ofetch module - define everything inline
vi.mock("ofetch", () => {
  const handleFetch = async (url: string, options?: any) => {
    // Access the store from the outer scope via closure
    const testStore = (globalThis as any).__cfTestStore || {};

    const path = url;

    // GET /values/:key - get item (returns Response-like object with .text())
    if (options?.method === undefined || options?.method === "GET") {
      const valueMatch = path.match(/^\/values\/(.+)$/);
      if (valueMatch) {
        const key = valueMatch[1];
        if (!(key in testStore)) {
          const error: any = new Error("Not found");
          error.status = 404;
          error.statusCode = 404;
          error.response = { status: 404 };
          throw error;
        }
        // Return Response-like object with text() method
        return {
          text: () => Promise.resolve(testStore[key]),
          arrayBuffer: () =>
            Promise.resolve(new TextEncoder().encode(testStore[key]).buffer),
        };
      }

      // GET /metadata/:key - check if exists
      const metaMatch = path.match(/^\/metadata\/(.+)$/);
      if (metaMatch) {
        const key = metaMatch[1];
        return { success: key in testStore };
      }

      // GET /keys - list keys
      if (path.startsWith("/keys")) {
        const params = options?.params || {};
        const prefix = params.prefix || "";
        let keys = Object.keys(testStore);
        if (prefix) {
          keys = keys.filter((key) => key.startsWith(prefix));
        }
        return {
          result: keys.map((key) => ({ name: key })),
          success: true,
          errors: [],
          messages: [],
          result_info: { count: keys.length, cursor: "" },
        };
      }
    }

    // PUT /values/:key - set item
    if (options?.method === "PUT") {
      const valueMatch = path.match(/^\/values\/(.+)$/);
      if (valueMatch) {
        const key = valueMatch[1];
        testStore[key] =
          typeof options.body === "string"
            ? options.body
            : JSON.stringify(options.body);
        return null;
      }
    }

    // DELETE /values/:key - remove item
    if (options?.method === "DELETE") {
      const valueMatch = path.match(/^\/values\/(.+)$/);
      if (valueMatch) {
        const key = valueMatch[1];
        delete testStore[key];
        return null;
      }

      // DELETE /bulk - clear all
      if (path === "/bulk") {
        Object.keys(testStore).forEach((key) => delete testStore[key]);
        return null;
      }
    }

    throw new Error(`Unhandled request: ${options?.method || "GET"} ${path}`);
  };

  const mockFetch = Object.assign(handleFetch, {
    create: () => mockFetch,
  });

  return { $fetch: mockFetch };
});

// Import driver after mock is set up
import driver, { KVHTTPOptions } from "../../src/drivers/cloudflare-kv-http";

const mockOptions: KVHTTPOptions = {
  apiToken: "api-token",
  accountId: "account-id",
  namespaceId: "namespace-id",
};

describe("drivers: cloudflare-kv-http", () => {
  beforeAll(() => {
    // Set up the global store reference
    (globalThis as any).__cfTestStore = store;
  });

  afterAll(() => {
    vi.clearAllMocks();
    // Clear store after all tests
    Object.keys(store).forEach((key) => delete store[key]);
  });

  testDriver({
    driver: driver(mockOptions),
  });
});
