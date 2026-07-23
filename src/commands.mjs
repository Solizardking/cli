/**
 * Cheshire Terminal CLI commands — pure async functions for tests + entrypoint.
 */
import { readFile } from "node:fs/promises";
import {
  CLI_BRAND,
  CLI_NAME,
  DEFAULT_SITE_URL,
  resolveSiteUrl,
  resolveApiKey,
  loadCredentials,
  saveCredentials,
  registrationJsonPath,
  loadRegistrationJson,
} from "./config.mjs";
import { createClient, CheshireHttpError } from "./client.mjs";

export function usageText() {
  return `${CLI_BRAND} CLI (${CLI_NAME})

Usage:
  cheshire-cli <command> [options]
  clawd-cli.sh <command> [options]     # compatibility wrapper

Environment:
  CHESHIRE_SITE_URL     Site origin (default: ${DEFAULT_SITE_URL})
  CHESHIRE_API_KEY      Developer API key (ct_sk_…) for authenticated calls
  CHESHIRE_CREDENTIALS_PATH  Optional credentials JSON path

Discovery:
  help                  Show this help
  status                Site + developer status + registry health
  skills [query]        List skills (optional search query)
  skills:search <q>     Search skills
  agents                Agent catalog summary
  registry              Agent registry proxy status
  connect               Print connection / credential wiring tips

User registration / auth:
  register:user --wallet <base58>          Fetch SIWS challenge (sign-in payload)
  login --wallet <base58> --signature <s> --message <msg>
                                           Verify signed challenge; store session hints
  whoami                                   Show credential / principal status
  set-key --api-key <ct_sk_…>              Persist API key locally

Agent registration:
  register:agent --dry-run [--file reg.json] [--name slug]
                                           Build agent-registry payload (Cheshire host)
  register:agent --confirm [--file reg.json] [--name slug]
                                           POST /api/agent-registry/register
  register:prepare --file reg.json         Alias for dry-run prepare
  forge:prepare --file reg.json            Delegate prepare hints (cheshire-terminal-agents)

Options common to many commands:
  --site <url>          Override CHESHIRE_SITE_URL
  --json                Machine-readable JSON only (default for most commands)
  --api-key <key>       One-shot API key (not printed back)

Examples:
  cheshire-cli status
  cheshire-cli skills
  CHESHIRE_SITE_URL=https://cheshireterminal.ai cheshire-cli register:user --wallet <pubkey>
  cheshire-cli register:agent --dry-run --name my-agent
`;
}

function parseFlags(argv) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (token.startsWith("--")) {
      const name = token.slice(2);
      if (name === "json" || name === "dry-run" || name === "confirm" || name === "help") {
        flags[name] = true;
        continue;
      }
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[name] = true;
        continue;
      }
      flags[name] = next;
      i += 1;
      continue;
    }
    positionals.push(token);
  }
  return { flags, positionals };
}

export function buildAgentRegistryPayload(registration, options = {}) {
  const reg = registration && typeof registration === "object" ? registration : {};
  const nameRaw = options.name || reg.name || "cheshire-agent";
  const name = String(nameRaw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63) || "cheshire-agent";

  const site = resolveSiteUrl(options.siteUrl);
  const services = Array.isArray(reg.services) ? reg.services : [];
  const description =
    options.description ||
    reg.description ||
    `Cheshire Terminal agent registered via ${CLI_NAME}`;

  return {
    name,
    title: options.title || reg.name || name,
    description: String(description).slice(0, 4000),
    tag: options.tag || "latest",
    modelProvider: options.modelProvider || "clawdrouter",
    modelName: options.modelName || "auto",
    namespace: options.namespace || "default",
    repositoryUrl:
      options.repositoryUrl ||
      (typeof reg.repository === "string" ? reg.repository : undefined) ||
      "https://github.com/Solizardking/Cheshire-Terminal-Agents",
    image:
      options.image ||
      (typeof reg.image === "string" ? reg.image : undefined) ||
      `${site}/og-image.png`,
    labels: {
      app: "cheshire-terminal",
      catalog: "cheshire-terminal-agents",
      source: "cheshire-cli",
    },
    // Echo registration services for local dry-run inspection (not all upstream fields)
    _cheshire: {
      siteUrl: site,
      registerPath: "/api/agent-registry/register",
      services: services.map((s) => ({
        name: s.name,
        endpoint: s.endpoint,
      })),
      registrationType: reg.type || null,
    },
  };
}

export async function cmdStatus(options = {}) {
  const client = createClient({ siteUrl: options.siteUrl, apiKey: options.apiKey });
  const siteUrl = client.siteUrl;

  const result = {
    brand: CLI_BRAND,
    siteUrl,
    checkedAt: new Date().toISOString(),
    developer: null,
    skills: null,
    registry: null,
    metaplex: null,
    errors: [],
  };

  try {
    const { data } = await client.get("/api/developer/status");
    result.developer = {
      status: data?.status ?? null,
      name: data?.name ?? null,
      origin: data?.origin ?? siteUrl,
      principal: data?.principal ?? null,
      routes: data?.routes
        ? {
            skills: data.routes.skills,
            agents: data.routes.agents,
            keys: data.routes.keys,
            docs: data.routes.docs,
          }
        : null,
    };
  } catch (err) {
    result.errors.push({ surface: "developer", message: err.message, status: err.status });
  }

  try {
    const { data } = await client.get("/api/skills");
    result.skills = {
      count: data?.count ?? (Array.isArray(data?.skills) ? data.skills.length : null),
      generatedAt: data?.generatedAt ?? null,
      realtime: data?.realtime ?? null,
    };
  } catch (err) {
    result.errors.push({ surface: "skills", message: err.message, status: err.status });
  }

  try {
    const { data } = await client.get("/api/agent-registry/status");
    result.registry = {
      ok: data?.ok ?? null,
      upstream: data?.upstream ?? null,
      registerPath: data?.registerPath ?? null,
      health: data?.health ?? null,
    };
  } catch (err) {
    result.errors.push({ surface: "registry", message: err.message, status: err.status });
  }

  try {
    const { data } = await client.get("/api/metaplex-agents/health");
    result.metaplex = {
      success: data?.success ?? null,
      mintPolicy: data?.mintPolicy?.gate ?? null,
      network: data?.network ?? data?.rpcNetwork ?? null,
    };
  } catch (err) {
    result.errors.push({ surface: "metaplex", message: err.message, status: err.status });
  }

  const healthy =
    result.developer?.status === "ok" ||
    (typeof result.skills?.count === "number" && result.skills.count > 0) ||
    result.registry?.ok === true;

  return { ok: healthy, ...result };
}

export async function cmdSkills(options = {}) {
  const client = createClient({ siteUrl: options.siteUrl, apiKey: options.apiKey });
  const query = options.query?.trim();
  if (query) {
    const { data } = await client.get(
      `/api/skills/search?q=${encodeURIComponent(query)}`,
    );
    return {
      siteUrl: client.siteUrl,
      query,
      ...normalizeSkillsPayload(data),
    };
  }
  const { data } = await client.get("/api/skills");
  return {
    siteUrl: client.siteUrl,
    ...normalizeSkillsPayload(data),
  };
}

function normalizeSkillsPayload(data) {
  if (!data || typeof data !== "object") {
    return { count: 0, skills: data };
  }
  const count =
    typeof data.count === "number"
      ? data.count
      : Array.isArray(data.skills)
        ? data.skills.length
        : Array.isArray(data.items)
          ? data.items.length
          : null;
  return {
    count,
    generatedAt: data.generatedAt ?? null,
    sources: data.sources ?? null,
    skills: data.skills ?? data.items ?? data.results ?? data,
  };
}

export async function cmdAgents(options = {}) {
  const client = createClient({ siteUrl: options.siteUrl, apiKey: options.apiKey });
  const out = {
    siteUrl: client.siteUrl,
    browserAgents: null,
    registryHealth: null,
  };
  try {
    const { data } = await client.get("/api/clawd/browser-agents");
    out.browserAgents = {
      importedAt: data?.importedAt ?? null,
      integration: data?.integration?.manifest
        ? {
            sourceRoot: data.integration.manifest.sourceRoot,
            targetRoot: data.integration.manifest.targetRoot,
            importedAt: data.integration.manifest.importedAt,
          }
        : null,
      roots: Array.isArray(data?.integration?.roots)
        ? data.integration.roots.length
        : Array.isArray(data?.roots)
          ? data.roots.length
          : null,
      keys: data && typeof data === "object" ? Object.keys(data).slice(0, 20) : [],
    };
  } catch (err) {
    out.browserAgents = { error: err.message, status: err.status };
  }
  try {
    const { data } = await client.get("/api/agent-registry/status");
    out.registryHealth = data;
  } catch (err) {
    out.registryHealth = { error: err.message, status: err.status };
  }
  return out;
}

export async function cmdRegistry(options = {}) {
  const client = createClient({ siteUrl: options.siteUrl, apiKey: options.apiKey });
  const { data } = await client.get("/api/agent-registry/status");
  return { siteUrl: client.siteUrl, ...data };
}

/**
 * Fetch SIWS challenge for wallet registration / login.
 * Does not require private keys — returns signable payload + next steps.
 */
export async function cmdRegisterUser(options = {}) {
  const wallet = options.wallet?.trim();
  if (!wallet) {
    throw new Error("register:user requires --wallet <base58-solana-pubkey>");
  }
  const client = createClient({ siteUrl: options.siteUrl });
  const { data } = await client.get(
    `/api/auth/challenge?wallet=${encodeURIComponent(wallet)}`,
  );

  const result = {
    brand: CLI_BRAND,
    siteUrl: client.siteUrl,
    mode: "siws-challenge",
    wallet,
    challenge: {
      message: data.message,
      nonce: data.nonce,
      expiresAt: data.expiresAt,
    },
    nextSteps: [
      "Sign challenge.message with the wallet (ed25519 detached signature, base58).",
      `Run: ${CLI_NAME} login --wallet ${wallet} --signature <sig> --message <exact-challenge-message>`,
      "Or set CHESHIRE_API_KEY (ct_sk_…) from the developer portal after holder login.",
      `${client.siteUrl}/api/developer/status documents key headers and routes.`,
    ],
    verifyPath: "/api/auth/verify",
    developerStatusPath: "/api/developer/status",
  };

  await saveCredentials({
    lastWallet: wallet,
    lastChallengeNonce: data.nonce,
    lastChallengeExpiresAt: data.expiresAt,
    siteUrl: client.siteUrl,
  });

  return result;
}

/**
 * Verify signed SIWS challenge (wallet login).
 */
export async function cmdLogin(options = {}) {
  const wallet = options.wallet?.trim();
  const signature = options.signature?.trim();
  const message = options.message;
  if (!wallet || !signature || !message) {
    throw new Error("login requires --wallet, --signature, and --message");
  }
  const client = createClient({ siteUrl: options.siteUrl });
  // No Origin header — server treats missing origin as trusted for CLI clients.
  const { data, status } = await client.post("/api/auth/verify", {
    walletAddress: wallet,
    signature,
    message,
  });

  await saveCredentials({
    lastWallet: wallet,
    lastLoginAt: new Date().toISOString(),
    siteUrl: client.siteUrl,
    sessionHint: data?.userId || data?.ok ? "verified" : "unknown",
  });

  return {
    brand: CLI_BRAND,
    siteUrl: client.siteUrl,
    httpStatus: status,
    ok: data?.ok !== false && status < 400,
    result: data,
    note:
      "Wallet session may be cookie-based. For headless CLI auth prefer CHESHIRE_API_KEY (holder-gated keys at /api/developer/keys).",
  };
}

export async function cmdWhoami(options = {}) {
  const client = createClient({ siteUrl: options.siteUrl, apiKey: options.apiKey });
  const creds = await loadCredentials();
  const apiKey = await resolveApiKey(options.apiKey);
  let developer = null;
  try {
    const { data } = await client.get("/api/developer/status");
    developer = {
      status: data?.status,
      origin: data?.origin,
      principal: data?.principal,
      apiKeyConfigured: data?.auth?.apiKey?.configured ?? null,
    };
  } catch (err) {
    developer = { error: err.message, status: err.status };
  }
  return {
    brand: CLI_BRAND,
    siteUrl: client.siteUrl,
    hasApiKey: Boolean(apiKey),
    apiKeySource: options.apiKey
      ? "flag"
      : process.env.CHESHIRE_API_KEY
        ? "env"
        : creds.apiKey
          ? "credentials-file"
          : null,
    credentials: {
      path: process.env.CHESHIRE_CREDENTIALS_PATH || "(default ~/.config/cheshire-terminal/credentials.json)",
      lastWallet: creds.lastWallet ?? null,
      lastLoginAt: creds.lastLoginAt ?? null,
      siteUrl: creds.siteUrl ?? null,
    },
    developer,
  };
}

export async function cmdSetKey(options = {}) {
  const apiKey = options.apiKey?.trim() || options.key?.trim();
  if (!apiKey) throw new Error("set-key requires --api-key <ct_sk_…>");
  if (!apiKey.startsWith("ct_sk_") && !options.force) {
    throw new Error("Expected Cheshire developer key prefix ct_sk_… (pass --force to store anyway)");
  }
  const saved = await saveCredentials({
    apiKey,
    siteUrl: resolveSiteUrl(options.siteUrl),
  });
  return {
    ok: true,
    brand: CLI_BRAND,
    siteUrl: saved.siteUrl,
    keyPrefix: `${apiKey.slice(0, 10)}…`,
    stored: true,
    note: "Key written to credentials file (mode 0600). Prefer env CHESHIRE_API_KEY in CI.",
  };
}

export async function cmdRegisterAgent(options = {}) {
  const siteUrl = resolveSiteUrl(options.siteUrl);
  const file = options.file || registrationJsonPath();
  let registration;
  try {
    registration = await loadRegistrationJson(file);
  } catch (err) {
    // Fallback minimal registration if fixture missing
    registration = {
      name: options.name || "cheshire-terminal-agent",
      description: "Cheshire Terminal agent",
      image: `${siteUrl}/og-image.png`,
      services: [
        { name: "web", endpoint: siteUrl },
        { name: "api", endpoint: `${siteUrl}/api` },
        { name: "mcp", endpoint: `${siteUrl}/mcp` },
      ],
    };
  }

  const payload = buildAgentRegistryPayload(registration, {
    ...options,
    siteUrl,
  });

  // Strip internal field for live POST
  const { _cheshire, ...publicBody } = payload;

  if (!options.confirm) {
    return {
      ok: true,
      mode: "dry-run",
      brand: CLI_BRAND,
      siteUrl,
      targetUrl: `${siteUrl}/api/agent-registry/register`,
      method: "POST",
      file,
      payload: publicBody,
      cheshire: _cheshire,
      note: "Pass --confirm to POST to the Cheshire agent registry (rate-limited public register).",
    };
  }

  const client = createClient({ siteUrl, apiKey: options.apiKey });
  try {
    const { data, status } = await client.post("/api/agent-registry/register", publicBody);
    return {
      ok: status >= 200 && status < 300,
      mode: "live",
      brand: CLI_BRAND,
      siteUrl,
      httpStatus: status,
      request: publicBody,
      response: data,
    };
  } catch (err) {
    if (err instanceof CheshireHttpError) {
      return {
        ok: false,
        mode: "live",
        brand: CLI_BRAND,
        siteUrl,
        httpStatus: err.status,
        request: publicBody,
        error: err.message,
        body: err.body,
      };
    }
    throw err;
  }
}

export async function cmdConnect(options = {}) {
  const siteUrl = resolveSiteUrl(options.siteUrl);
  return {
    brand: CLI_BRAND,
    siteUrl,
    endpoints: {
      web: siteUrl,
      api: `${siteUrl}/api`,
      developerStatus: `${siteUrl}/api/developer/status`,
      skills: `${siteUrl}/api/skills`,
      agentsHub: `${siteUrl}/agents`,
      agentForge: `${siteUrl}/agents/forge`,
      agentRegistry: `${siteUrl}/agent-registry`,
      registryNative: "https://registry.cheshireterminal.ai/",
      mcp: `${siteUrl}/mcp`,
      x402: `${siteUrl}/x402`,
      authChallenge: `${siteUrl}/api/auth/challenge?wallet=<base58>`,
      authVerify: `${siteUrl}/api/auth/verify`,
      metaplexHealth: `${siteUrl}/api/metaplex-agents/health`,
    },
    credentials: {
      envApiKey: "CHESHIRE_API_KEY",
      envSite: "CHESHIRE_SITE_URL",
      headers: ["Authorization: Bearer ct_sk_…", "x-api-key: ct_sk_…"],
    },
    forgePackage: {
      npm: "cheshire-terminal-agents",
      bin: "cheshire-terminal-agents",
      docs: "https://www.npmjs.com/package/cheshire-terminal-agents",
    },
    next: [
      `${CLI_NAME} status`,
      `${CLI_NAME} register:user --wallet <pubkey>`,
      `${CLI_NAME} set-key --api-key ct_sk_…`,
      `${CLI_NAME} register:agent --dry-run`,
    ],
  };
}

export async function cmdForgePrepare(options = {}) {
  const siteUrl = resolveSiteUrl(options.siteUrl);
  const file = options.file || registrationJsonPath();
  let registration;
  try {
    registration = JSON.parse(await readFile(file, "utf8"));
  } catch {
    registration = null;
  }
  return {
    brand: CLI_BRAND,
    siteUrl,
    mode: "prepare-hints",
    file,
    registrationName: registration?.name ?? null,
    services: registration?.services ?? null,
    commands: {
      localEvm: `npx cheshire-terminal-agents prepare-local-robinhood --file ${file} --chain 46630`,
      hostedEvm: `npx cheshire-terminal-agents prepare-robinhood --file ${file} --site ${siteUrl}`,
      omni: `npx cheshire-terminal-agents omni-mint-plan --file ${file} --chain 46630 --solana-network solana-devnet`,
      catalog: "npx cheshire-terminal-agents agents-list",
      capabilities: `npx cheshire-terminal-agents capabilities --site ${siteUrl}`,
    },
    env: {
      CHESHIRE_SITE_URL: siteUrl,
      CHESHIRE_API_KEY: process.env.CHESHIRE_API_KEY ? "(set)" : "(unset)",
    },
    note: "Heavy forge work lives in cheshire-terminal-agents; this CLI prepares site registry + user auth.",
  };
}

/**
 * Dispatch a CLI command. Returns { exitCode, result }.
 */
export async function runCommand(argv) {
  const [command = "help", ...rest] = argv;
  const { flags, positionals } = parseFlags(rest);
  const siteUrl = flags.site;
  const apiKey = flags["api-key"] || flags.apiKey;

  const opts = {
    siteUrl,
    apiKey,
    wallet: flags.wallet,
    signature: flags.signature,
    message: flags.message,
    file: flags.file,
    name: flags.name || positionals[0],
    query: flags.query || positionals[0],
    title: flags.title,
    description: flags.description,
    tag: flags.tag,
    dryRun: flags["dry-run"] || !flags.confirm,
    confirm: Boolean(flags.confirm),
    force: Boolean(flags.force),
    key: flags.key,
  };

  try {
    let result;
    switch (command) {
      case "help":
      case "-h":
      case "--help":
        return { exitCode: 0, result: { help: true, text: usageText() }, text: usageText() };
      case "status":
        result = await cmdStatus(opts);
        break;
      case "skills":
      case "skills:list":
        result = await cmdSkills(opts);
        break;
      case "skills:search":
        result = await cmdSkills({ ...opts, query: positionals[0] || flags.query });
        break;
      case "agents":
        result = await cmdAgents(opts);
        break;
      case "registry":
      case "agent-registry":
        result = await cmdRegistry(opts);
        break;
      case "connect":
        result = await cmdConnect(opts);
        break;
      case "register:user":
      case "register-user":
      case "auth:challenge":
        result = await cmdRegisterUser(opts);
        break;
      case "login":
      case "auth:verify":
      case "register:user:verify":
        result = await cmdLogin(opts);
        break;
      case "whoami":
        result = await cmdWhoami(opts);
        break;
      case "set-key":
      case "login:key":
        result = await cmdSetKey(opts);
        break;
      case "register":
      case "register:agent":
      case "register-agent":
      case "register:prepare":
        result = await cmdRegisterAgent({
          ...opts,
          confirm: command === "register:prepare" ? false : opts.confirm,
        });
        break;
      case "forge:prepare":
      case "forge-prepare":
        result = await cmdForgePrepare(opts);
        break;
      default:
        return {
          exitCode: 1,
          result: { error: `Unknown command: ${command}` },
          text: `Unknown command: ${command}\n\n${usageText()}`,
        };
    }
    return { exitCode: result?.ok === false ? 1 : 0, result };
  } catch (err) {
    return {
      exitCode: 1,
      result: {
        error: err instanceof Error ? err.message : String(err),
        status: err?.status,
        body: err?.body,
      },
    };
  }
}
