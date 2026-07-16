// GENESIS PHASE 2 -- Increment 0 Security Floor. Pure unit tests for lib/auth-guard.ts.
// No I/O, no node:sqlite -- lib/auth-guard.ts imports only node:crypto and next/server's
// NextResponse, matching this project's existing pure-module test pattern (tests/request-guard.test.ts).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { requireAdminAuth, ADMIN_KEY_HEADER, ADMIN_KEY_ENV } from "@/lib/auth-guard";

const SECRET = "test-only-not-a-real-secret-9f3a";

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/test", { headers });
}

describe("lib/auth-guard requireAdminAuth", () => {
  const originalEnv = process.env[ADMIN_KEY_ENV];

  beforeEach(() => {
    process.env[ADMIN_KEY_ENV] = SECRET;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env[ADMIN_KEY_ENV];
    else process.env[ADMIN_KEY_ENV] = originalEnv;
  });

  it("rejects a missing header with a generic 401", async () => {
    const result = requireAdminAuth(request());
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(body.error).toBeTruthy();
    }
  });

  it("rejects an incorrect key with a generic 401", async () => {
    const result = requireAdminAuth(request({ [ADMIN_KEY_HEADER]: "wrong-key" }));
    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.response.status).toBe(401);
  });

  it("accepts the correct key", () => {
    const result = requireAdminAuth(request({ [ADMIN_KEY_HEADER]: SECRET }));
    expect(result.authorized).toBe(true);
  });

  it("fails closed with a generic 503 when SENTINEL_ADMIN_KEY is not configured", () => {
    delete process.env[ADMIN_KEY_ENV];
    const result = requireAdminAuth(request({ [ADMIN_KEY_HEADER]: SECRET }));
    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.response.status).toBe(503);
  });

  it("rejects an empty client key", () => {
    const result = requireAdminAuth(request({ [ADMIN_KEY_HEADER]: "" }));
    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.response.status).toBe(401);
  });

  it("does not throw when the provided key is a different length than the configured secret (shorter and longer)", () => {
    expect(() => requireAdminAuth(request({ [ADMIN_KEY_HEADER]: "x" }))).not.toThrow();
    expect(() => requireAdminAuth(request({ [ADMIN_KEY_HEADER]: SECRET + "-extra-long-tail" }))).not.toThrow();
    expect(requireAdminAuth(request({ [ADMIN_KEY_HEADER]: "x" })).authorized).toBe(false);
    expect(requireAdminAuth(request({ [ADMIN_KEY_HEADER]: SECRET + "-extra-long-tail" })).authorized).toBe(false);
  });

  it("is deterministic across repeated identical checks", () => {
    const okResults = Array.from({ length: 5 }, () => requireAdminAuth(request({ [ADMIN_KEY_HEADER]: SECRET })).authorized);
    expect(okResults).toEqual([true, true, true, true, true]);

    const failResults = Array.from({ length: 5 }, () => requireAdminAuth(request({ [ADMIN_KEY_HEADER]: "nope" })).authorized);
    expect(failResults).toEqual([false, false, false, false, false]);
  });

  it("never includes the configured or provided secret in a rejection response body", async () => {
    const badKeyResult = requireAdminAuth(request({ [ADMIN_KEY_HEADER]: "definitely-wrong" }));
    if (!badKeyResult.authorized) {
      const text = await badKeyResult.response.text();
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain("definitely-wrong");
    }

    delete process.env[ADMIN_KEY_ENV];
    const missingConfigResult = requireAdminAuth(request({ [ADMIN_KEY_HEADER]: SECRET }));
    if (!missingConfigResult.authorized) {
      const text = await missingConfigResult.response.text();
      expect(text).not.toContain(SECRET);
    }
  });
});
