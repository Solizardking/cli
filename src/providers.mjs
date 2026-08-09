/**
 * First-class Solana trading/data provider env keys for the CLI.
 * Keep in sync with mcp-server/src/providers.ts.
 *
 * Status surfaces report set/unset only — never secret values.
 */

/** @typedef {{ name: string, role: string, secret: boolean }} ProviderEnvSpec */

/** @type {readonly ProviderEnvSpec[]} */
export const PROVIDER_ENV_SPECS = Object.freeze([
  {
    name: "DFLOW_API_KEY",
    role: "DFlow Trading API (spot swaps, prediction markets, WebSockets)",
    secret: true,
  },
  {
    name: "HELIUS_API_KEY",
    role: "Helius RPC / DAS / Sender / streaming",
    secret: true,
  },
  {
    name: "SOLANA_TRACKER_API_KEY",
    role: "Solana Tracker data / secure RPC access key",
    secret: true,
  },
  {
    name: "JUPITER_API_KEY",
    role: "Jupiter Swap V2 / Price / Trigger (x-api-key)",
    secret: true,
  },
  {
    name: "PHANTOM_APP_ID",
    role: "Phantom Portal App ID (Connect SDK / embedded wallets)",
    secret: false,
  },
  {
    name: "OKX_API_KEY",
    role: "OKX DEX aggregation / OnchainOS intelligence",
    secret: true,
  },
]);

export const PROVIDER_ENV_NAMES = Object.freeze(
  PROVIDER_ENV_SPECS.map((s) => s.name),
);

/**
 * @param {string} name
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isProviderEnvConfigured(name, env = process.env) {
  const raw = env[name];
  return typeof raw === "string" && raw.trim().length > 0;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ name: string, role: string, set: boolean, secret: boolean }[]}
 */
export function getProviderEnvStatus(env = process.env) {
  return PROVIDER_ENV_SPECS.map((spec) => ({
    name: spec.name,
    role: spec.role,
    set: isProviderEnvConfigured(spec.name, env),
    secret: spec.secret,
  }));
}

/**
 * CLI-facing providers block (status/connect/providers commands).
 * Never embeds env values.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function buildProvidersStatusReport(env = process.env) {
  const providers = getProviderEnvStatus(env);
  return {
    envNames: [...PROVIDER_ENV_NAMES],
    providers,
    setCount: providers.filter((p) => p.set).length,
    note: "Reports set/unset only; secret values are never printed.",
  };
}

/** Usage help lines for the six provider env names. */
export function providerEnvUsageLines() {
  return PROVIDER_ENV_SPECS.map(
    (s) => `  ${s.name.padEnd(24)} ${s.role}${s.secret ? " (secret)" : ""}`,
  ).join("\n");
}
