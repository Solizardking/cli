/**
 * In-repo tests for Cheshire Terminal CLI — drives shipped modules.
 * Run: node --test cli/cheshire-cli.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import {
  resolveSiteUrl,
  DEFAULT_SITE_URL,
  registrationJsonPath,
  loadRegistrationJson,
} from "./src/config.mjs";
import {
  buildAgentRegistryPayload,
  runCommand,
  usageText,
  cmdStatus,
  cmdRegisterUser,
  cmdRegisterAgent,
  cmdConnect,
} from "./src/commands.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, "cheshire-cli.mjs");
const SITE = process.env.CHESHIRE_SITE_URL || DEFAULT_SITE_URL;

// Keep credential side-effects out of the user's home during tests.
if (!process.env.CHESHIRE_CREDENTIALS_PATH) {
  process.env.CHESHIRE_CREDENTIALS_PATH = join(
    process.env.TMPDIR || "/tmp",
    `cheshire-cli-test-creds-${process.pid}.json`,
  );
}

describe("config", () => {
  it("defaults site URL to cheshireterminal.ai", () => {
    const prev = process.env.CHESHIRE_SITE_URL;
    delete process.env.CHESHIRE_SITE_URL;
    delete process.env.CHESHIRE_API_URL;
    try {
      assert.equal(resolveSiteUrl(), "https://cheshireterminal.ai");
      assert.equal(DEFAULT_SITE_URL, "https://cheshireterminal.ai");
      assert.equal(resolveSiteUrl("https://example.test/"), "https://example.test");
    } finally {
      if (prev !== undefined) process.env.CHESHIRE_SITE_URL = prev;
    }
  });

  it("registration JSON points services at cheshireterminal.ai", async () => {
    const reg = await loadRegistrationJson(registrationJsonPath("cheshire-registration.json"));
    assert.equal(reg.name, "cheshire-terminal");
    assert.ok(Array.isArray(reg.services));
    for (const svc of reg.services) {
      assert.match(
        String(svc.endpoint),
        /cheshireterminal\.ai/,
        `service ${svc.name} should host on cheshireterminal.ai`,
      );
      assert.doesNotMatch(String(svc.endpoint), /solanaclawd\.com/);
    }
  });

  it("legacy registration files are rebranded", async () => {
    for (const name of [
      "clawd-registration.json",
      "solana-clawd-registration.json",
      "clawd-openclaw-config.json",
    ]) {
      const raw = await readFile(join(__dirname, name), "utf8");
      assert.match(raw, /cheshireterminal\.ai/);
      assert.doesNotMatch(raw, /solanaclawd\.com/);
    }
  });
});

describe("buildAgentRegistryPayload", () => {
  it("builds DNS-label name and Cheshire register path", () => {
    const payload = buildAgentRegistryPayload(
      {
        name: "My Cool Agent!",
        description: "test",
        services: [{ name: "api", endpoint: "https://cheshireterminal.ai/api" }],
      },
      { siteUrl: "https://cheshireterminal.ai" },
    );
    assert.equal(payload.name, "my-cool-agent");
    assert.equal(payload._cheshire.siteUrl, "https://cheshireterminal.ai");
    assert.equal(payload._cheshire.registerPath, "/api/agent-registry/register");
    assert.equal(payload.labels.app, "cheshire-terminal");
  });
});

describe("usage / help", () => {
  it("usage text is Cheshire branded without solanaclawd primary host", () => {
    const text = usageText();
    assert.match(text, /Cheshire Terminal/);
    assert.match(text, /cheshireterminal\.ai/);
    assert.doesNotMatch(text, /solanaclawd\.com/);
  });

  it("runCommand help returns usage", async () => {
    const { exitCode, text, result } = await runCommand(["help"]);
    assert.equal(exitCode, 0);
    assert.ok(text?.includes("Cheshire Terminal") || result?.help);
  });
});

describe("CLI process entry", () => {
  it("cheshire-cli.mjs help exits 0 with brand", () => {
    const proc = spawnSync(process.execPath, [CLI, "help"], {
      encoding: "utf8",
      env: { ...process.env, CHESHIRE_SITE_URL: SITE },
    });
    assert.equal(proc.status, 0, proc.stderr);
    assert.match(proc.stdout, /Cheshire Terminal/);
    assert.match(proc.stdout, /cheshireterminal\.ai/);
    assert.doesNotMatch(proc.stdout, /solanaclawd\.com/);
  });
});

describe("live site commands (network)", () => {
  it("status returns developer/skills/registry fields", async () => {
    const result = await cmdStatus({ siteUrl: SITE });
    assert.equal(result.brand, "Cheshire Terminal");
    assert.equal(result.siteUrl.replace(/\/$/, ""), SITE.replace(/\/$/, ""));
    assert.ok(
      result.developer?.status === "ok" ||
        (typeof result.skills?.count === "number" && result.skills.count > 0) ||
        result.registry?.ok === true,
      `expected healthy public surface, got ${JSON.stringify(result.errors)}`,
    );
    if (result.developer?.status) {
      assert.equal(result.developer.status, "ok");
    }
    if (typeof result.skills?.count === "number") {
      assert.ok(result.skills.count > 0);
    }
  });

  it("register:user challenge returns signable payload", async () => {
    // Valid ed25519 pubkey shape (from live probe earlier / generated-like)
    const wallet = "HLzhCjtss8z7Ava8fq3nqfpaVSJTEd69HCA9fP1dbSYU";
    const result = await cmdRegisterUser({ siteUrl: SITE, wallet });
    assert.equal(result.mode, "siws-challenge");
    assert.ok(result.challenge?.message);
    assert.ok(result.challenge?.nonce);
    assert.match(result.challenge.message, /Wallet:/);
    assert.match(result.siteUrl, /cheshireterminal\.ai/);
    assert.doesNotMatch(JSON.stringify(result), /solanaclawd\.com/);
  });

  it("register:agent dry-run targets Cheshire register path", async () => {
    const result = await cmdRegisterAgent({
      siteUrl: SITE,
      file: registrationJsonPath("cheshire-registration.json"),
      name: `cli-test-${Date.now().toString(36)}`,
      confirm: false,
    });
    assert.equal(result.mode, "dry-run");
    assert.equal(result.ok, true);
    assert.match(result.targetUrl, /cheshireterminal\.ai\/api\/agent-registry\/register/);
    assert.ok(result.payload?.name);
    assert.doesNotMatch(JSON.stringify(result), /solanaclawd\.com/);
  });

  it("connect surfaces Cheshire endpoints", async () => {
    const result = await cmdConnect({ siteUrl: SITE });
    assert.match(result.endpoints.api, /cheshireterminal\.ai\/api/);
    assert.equal(result.credentials.envApiKey, "CHESHIRE_API_KEY");
    assert.equal(result.forgePackage.npm, "cheshire-terminal-agents");
  });

  it("runCommand status via dispatcher", async () => {
    const { exitCode, result } = await runCommand(["status", "--site", SITE]);
    assert.equal(exitCode, 0);
    assert.ok(result.siteUrl.includes("cheshireterminal.ai"));
  });
});
