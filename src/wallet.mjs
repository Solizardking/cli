/**
 * Agentic wallet bridge for Cheshire Terminal CLI.
 *
 * Loads @x402solana/cheshire-agentic-wallet from:
 *   1) monorepo packages/cheshire-agentic-wallet/dist
 *   2) package optional dependency / node_modules
 *
 * Local vault: ~/.cheshire/agentic-wallet/vault.json
 * Communicates with cheshireterminal.ai/cli and solanaclawd.com/cli for discovery.
 */
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolveDualHubs, resolveSiteUrl, CLI_ROOT } from "./config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const AGENTIC_VAULT_DIR = join(homedir(), ".cheshire", "agentic-wallet");
export const AGENTIC_VAULT_PATH = join(AGENTIC_VAULT_DIR, "vault.json");

let _core = null;
let _coreError = null;

/**
 * Resolve agentic wallet core module (built dist preferred).
 */
export async function loadAgenticWalletCore() {
  if (_core) return _core;
  if (_coreError) throw _coreError;

  const candidates = [
    // monorepo: cheshire-terminal/packages/cheshire-agentic-wallet
    join(CLI_ROOT, "..", "packages", "cheshire-agentic-wallet", "dist", "index.js"),
    join(CLI_ROOT, "node_modules", "@x402solana", "cheshire-agentic-wallet", "dist", "index.js"),
    join(CLI_ROOT, "node_modules", "@x402solana", "cheshire-agentic-wallet", "index.js"),
  ];

  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      _core = await import(pathToFileURL(p).href);
      return _core;
    } catch (err) {
      _coreError = err;
    }
  }

  // Package name import (when published / linked)
  try {
    _core = await import("@x402solana/cheshire-agentic-wallet");
    return _core;
  } catch (err) {
    _coreError = new Error(
      "Agentic wallet core not found. Build monorepo package: " +
        "pnpm --filter @x402solana/cheshire-agentic-wallet build  " +
        `(or npm i @x402solana/cheshire-agentic-wallet). Last error: ${
          err instanceof Error ? err.message : String(err)
        }`,
    );
    throw _coreError;
  }
}

export function readAgenticVault() {
  if (!existsSync(AGENTIC_VAULT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(AGENTIC_VAULT_PATH, "utf8"));
  } catch {
    return null;
  }
}

export function writeAgenticVault(vault) {
  mkdirSync(AGENTIC_VAULT_DIR, { recursive: true });
  writeFileSync(AGENTIC_VAULT_PATH, `${JSON.stringify(vault, null, 2)}\n`, {
    mode: 0o600,
  });
}

/**
 * Probe both CLI hubs (/api/cli) for wallet product discovery.
 */
export async function probeWalletCliHubs(opts = {}) {
  const hubs = resolveDualHubs(opts);
  const results = [];
  for (const hub of hubs) {
    const entry = {
      id: hub.id,
      brand: hub.brand,
      siteUrl: hub.siteUrl,
      cliHub: hub.cliHub,
      apiCli: hub.apiCli,
      ok: false,
      wallet: null,
      error: null,
    };
    try {
      const res = await fetch(hub.apiCli, {
        headers: {
          Accept: "application/json",
          "User-Agent": "cheshire-terminal-cli/wallet",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      entry.ok = Boolean(data?.ok ?? true);
      entry.wallet = data?.wallet ?? data?.agenticWallet ?? null;
      entry.productUrl = data?.productUrl ?? hub.cliHub;
      entry.install = data?.install ?? null;
    } catch (err) {
      entry.error = err instanceof Error ? err.message : String(err);
    }
    results.push(entry);
  }
  return results;
}

export async function cmdWalletStatus(options = {}) {
  const vault = readAgenticVault();
  let coreMeta = null;
  try {
    const core = await loadAgenticWalletCore();
    coreMeta = {
      package: core.PACKAGE_NAME ?? "@x402solana/cheshire-agentic-wallet",
      version: core.PACKAGE_VERSION ?? null,
      loaded: true,
    };
  } catch (err) {
    coreMeta = {
      loaded: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const hubs = await probeWalletCliHubs(options);
  return {
    ok: true,
    brand: "Cheshire Terminal Agentic Wallet",
    siteUrl: resolveSiteUrl(options.siteUrl),
    vaultPath: AGENTIC_VAULT_PATH,
    hasVault: Boolean(vault),
    address: vault?.address ?? null,
    walletId: vault?.walletId ?? null,
    core: coreMeta,
    hubs,
    pages: {
      cheshireCli: "https://cheshireterminal.ai/cli",
      solanaclawdCli: "https://solanaclawd.com/cli",
      wallets: "https://cheshireterminal.ai/wallets",
    },
    next: vault
      ? [
          "cheshire-cli wallet:balance",
          "cheshire-cli wallet:policy --type transfer_sol --to <addr> --lamports 1000000",
        ]
      : [
          "cheshire-cli wallet:create --pass <passphrase>",
          "or: CHESHIRE_WALLET_PASS=… cheshire-cli wallet:create",
        ],
  };
}

export async function cmdWalletCreate(options = {}) {
  const pass =
    (typeof options.pass === "string" && options.pass) ||
    process.env.CHESHIRE_WALLET_PASS?.trim() ||
    "";
  if (!pass || pass.length < 8) {
    return {
      ok: false,
      error: "wallet:create requires --pass <passphrase> (min 8) or CHESHIRE_WALLET_PASS",
    };
  }
  if (readAgenticVault() && !options.force) {
    return {
      ok: false,
      error: "Vault already exists. Pass --force to overwrite.",
      vaultPath: AGENTIC_VAULT_PATH,
      address: readAgenticVault()?.address,
    };
  }
  const core = await loadAgenticWalletCore();
  const { vault, wallet } = await core.createVault(pass, {
    label: options.label || "cheshire-cli",
  });
  writeAgenticVault(vault);
  return {
    ok: true,
    address: wallet.address,
    walletId: wallet.walletId,
    vaultPath: AGENTIC_VAULT_PATH,
    hubs: resolveDualHubs(options).map((h) => h.cliHub),
    note: "Non-custodial — key encrypted under your passphrase on this device.",
  };
}

export async function cmdWalletAddress() {
  const vault = readAgenticVault();
  if (!vault) {
    return {
      ok: false,
      error: "No vault. Run: cheshire-cli wallet:create --pass <pass>",
    };
  }
  return { ok: true, address: vault.address, walletId: vault.walletId };
}

export async function cmdWalletBalance(options = {}) {
  const vault = readAgenticVault();
  if (!vault) {
    return {
      ok: false,
      error: "No vault. Run: cheshire-cli wallet:create --pass <pass>",
    };
  }
  const core = await loadAgenticWalletCore();
  const cluster = options.cluster || "mainnet-beta";
  const rpc = core.createCheshireRpc({
    url: typeof options.rpc === "string" ? options.rpc : undefined,
    cluster,
  });
  const lamports = await core.getBalanceLamports(rpc, vault.address);
  return {
    ok: true,
    address: vault.address,
    lamports: String(lamports),
    sol: Number(lamports) / 1e9,
    cluster,
    endpoints: [...(rpc.endpoints || [])],
  };
}

export async function cmdWalletPolicy(options = {}) {
  const core = await loadAgenticWalletCore();
  const type = options.type || "transfer_sol";
  const intent = {
    type,
    to: options.to,
    lamports: options.lamports != null ? Number(options.lamports) : 0,
    origin: options.origin,
    message: options.message,
    transactionBase64: options.tx || options.transactionBase64,
    estimatedLamports:
      options.estimatedLamports != null
        ? Number(options.estimatedLamports)
        : undefined,
  };
  const decision = core.evaluateAgenticIntent(intent, options.policy || {});
  return {
    ok: decision.allow,
    decision,
    intent,
    hubs: resolveDualHubs(options).map((h) => h.cliHub),
  };
}

export async function cmdWalletSlot(options = {}) {
  const core = await loadAgenticWalletCore();
  const cluster = options.cluster || "mainnet-beta";
  const rpc = core.createCheshireRpc({
    url: typeof options.rpc === "string" ? options.rpc : undefined,
    cluster,
  });
  const slot = await core.getSlot(rpc);
  return {
    ok: true,
    slot: String(slot),
    cluster,
    endpoints: [...(rpc.endpoints || [])],
  };
}
