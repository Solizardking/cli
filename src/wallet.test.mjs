/**
 * Agentic wallet + dual-hub CLI tests.
 * Run: node --test ./src/wallet.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SITE_URL,
  DEFAULT_SOLANA_CLAWD_URL,
  resolveDualHubs,
  resolveSolanaClawdUrl,
  DUAL_HOSTS,
} from "./config.mjs";
import { runCommand, usageText } from "./commands.mjs";
import {
  AGENTIC_VAULT_PATH,
  loadAgenticWalletCore,
  cmdWalletPolicy,
} from "./wallet.mjs";

describe("dual hubs", () => {
  it("defaults primary cheshire + companion solanaclawd", () => {
    assert.equal(DEFAULT_SITE_URL, "https://cheshireterminal.ai");
    assert.equal(DEFAULT_SOLANA_CLAWD_URL, "https://solanaclawd.com");
    assert.equal(resolveSolanaClawdUrl(), "https://solanaclawd.com");
    const hubs = resolveDualHubs();
    const urls = hubs.map((h) => h.siteUrl);
    assert.ok(urls.includes("https://cheshireterminal.ai"));
    assert.ok(urls.includes("https://solanaclawd.com"));
    assert.ok(hubs.every((h) => h.cliHub.endsWith("/cli")));
    assert.ok(hubs.every((h) => h.apiCli.endsWith("/api/cli")));
    assert.equal(DUAL_HOSTS.cheshire.cliHub, "https://cheshireterminal.ai/cli");
    assert.equal(DUAL_HOSTS.solanaclawd.cliHub, "https://solanaclawd.com/cli");
  });
});

describe("wallet commands", () => {
  it("usage documents agentic wallet + dual hubs", () => {
    const u = usageText();
    assert.match(u, /wallet:status/);
    assert.match(u, /wallet:create/);
    assert.match(u, /solanaclawd\.com\/cli|SOLANA_CLAWD/);
    assert.match(u, /agentic wallet/i);
  });

  it("runCommand wallet:status returns vault + hubs shape", async () => {
    const { exitCode, result } = await runCommand(["wallet:status"]);
    assert.equal(exitCode, 0);
    assert.equal(result.ok, true);
    assert.ok(result.vaultPath.includes("agentic-wallet"));
    assert.equal(result.vaultPath, AGENTIC_VAULT_PATH);
    assert.ok(Array.isArray(result.hubs));
    assert.ok(result.pages?.cheshireCli?.includes("cheshireterminal.ai/cli"));
    assert.ok(result.pages?.solanaclawdCli?.includes("solanaclawd.com/cli"));
  });

  it("runCommand wallet:hubs lists dual CLI mesh", async () => {
    const { exitCode, result } = await runCommand(["wallet:hubs"]);
    assert.equal(exitCode, 0);
    assert.equal(result.ok, true);
    assert.ok(Array.isArray(result.hubs));
    assert.ok(result.hubs.length >= 2);
  });

  it("loads agentic core and evaluates policy", async () => {
    const core = await loadAgenticWalletCore();
    assert.ok(core.createVault);
    assert.ok(core.evaluateAgenticIntent);
    const { exitCode, result } = await runCommand([
      "wallet:policy",
      "--type",
      "transfer_sol",
      "--to",
      "11111111111111111111111111111112",
      "--lamports",
      "1000000",
    ]);
    assert.equal(exitCode, 0);
    assert.equal(result.ok, true);
    assert.equal(result.decision.allow, true);

    const blocked = await cmdWalletPolicy({
      type: "transfer_sol",
      to: "11111111111111111111111111111112",
      lamports: 10_000_000_000,
    });
    assert.equal(blocked.ok, false);
  });
});
