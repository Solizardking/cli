/**
 * Developer API keys CLI path — drives real runCommand + shipped helpers.
 * Run: node --test ./src/keys.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { API_SURFACES } from "./catalog.mjs";
import {
  cmdKeysCreate,
  cmdKeysList,
  cmdKeysRevoke,
  runCommand,
  usageText,
} from "./commands.mjs";
import {
  cmdKeysCreate as exportedCreate,
  cmdKeysList as exportedList,
  cmdKeysRevoke as exportedRevoke,
} from "./index.mjs";

describe("developer keys surface", () => {
  it("catalog maps developerKeys to /api/developer/keys", () => {
    assert.equal(API_SURFACES.developerKeys, "/api/developer/keys");
  });

  it("usage documents keys:create / keys:list / keys:revoke", () => {
    const u = usageText();
    assert.match(u, /keys:create/);
    assert.match(u, /keys:list/);
    assert.match(u, /keys:revoke/);
    assert.match(u, /set-key/);
  });

  it("exports cmdKeys* from package index", () => {
    assert.equal(typeof exportedCreate, "function");
    assert.equal(typeof exportedList, "function");
    assert.equal(typeof exportedRevoke, "function");
    assert.equal(exportedCreate, cmdKeysCreate);
    assert.equal(exportedList, cmdKeysList);
    assert.equal(exportedRevoke, cmdKeysRevoke);
  });
});

describe("keys commands via runCommand (real dispatch)", () => {
  it("keys:create without --name returns structured missing-arg error", async () => {
    const { exitCode, result } = await runCommand(["keys:create"]);
    assert.equal(exitCode, 1);
    assert.match(String(result.error), /keys:create requires --name/);
  });

  it("keys:revoke without --id returns structured missing-arg error", async () => {
    const { exitCode, result } = await runCommand(["keys:revoke"]);
    assert.equal(exitCode, 1);
    assert.match(String(result.error), /keys:revoke requires --id/);
  });

  it("keys:list against unreachable host returns non-crash network/auth error", async () => {
    const { exitCode, result } = await runCommand([
      "keys:list",
      "--site",
      "http://127.0.0.1:9",
    ]);
    assert.equal(exitCode, 1);
    assert.equal(result.ok, false);
    assert.ok(
      /Network error|timed out|Unauthorized|401|fetch failed/i.test(String(result.error)),
      `unexpected error: ${result.error}`,
    );
  });

  it("keys:create with name against unreachable host returns structured failure", async () => {
    const { exitCode, result } = await runCommand([
      "keys:create",
      "--name",
      "keys-test-smoke",
      "--site",
      "http://127.0.0.1:9",
    ]);
    assert.equal(exitCode, 1);
    assert.equal(result.ok, false);
    assert.ok(result.error);
    // Must not be a raw stack dump
    assert.equal(result.error.includes("at runCommand"), false);
  });

  it("cmdKeysCreate direct call requires name", async () => {
    await assert.rejects(
      () => cmdKeysCreate({ siteUrl: "http://127.0.0.1:9" }),
      /keys:create requires --name/,
    );
  });
});
