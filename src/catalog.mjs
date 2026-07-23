/**
 * Catalog sync between Cheshire CLI and site surfaces.
 *
 * Source of truth (do not dual-wire filesystem trees):
 * ┌────────────────────────────┬──────────────────────────────────────────────┐
 * │ Surface                    │ Source                                       │
 * ├────────────────────────────┼──────────────────────────────────────────────┤
 * │ /agents hub UI             │ monorepo agents/ → GET /api/clawd/browser-agents │
 * │ /skills                    │ monorepo skills + robinhood-agents/skills → GET /api/skills │
 * │ /agent-registry · /registry│ registry.cheshireterminal.ai via /api/agent-registry │
 * │ Dual-rail forge / npm pack │ monorepo robinhood-agents = cheshire-terminal-agents │
 * │ Upstream publish repo      │ github.com/solizardking/agents (npm source)  │
 * └────────────────────────────┴──────────────────────────────────────────────┘
 *
 * Runtime CLI always uses the live site (CHESHIRE_SITE_URL). Optional peer
 * package `cheshire-terminal-agents` unlocks local forge prepare — not required
 * for hub list/register/sync.
 */

export const SITE_SURFACES = {
  cli: "/cli",
  gateway: "/gateway",
  skills: "/skills",
  skillsStore: "/skills-store",
  agents: "/agents",
  agentsForge: "/agents/forge",
  agentsMint: "/agents/mint",
  agentsChat: "/agents/chat",
  agentRegistry: "/agent-registry",
  registry: "/registry",
  agentsRegistry: "/agents/registry",
};

export const API_SURFACES = {
  skills: "/api/skills",
  skillsSearch: "/api/skills/search",
  browserAgents: "/api/clawd/browser-agents",
  browserAgentsDefi: "/api/clawd/browser-agents/pack/defi-agents",
  registryStatus: "/api/agent-registry/status",
  registryAgents: "/api/agent-registry/v0/agents",
  registrySkills: "/api/agent-registry/v0/skills",
  registryRegister: "/api/agent-registry/register",
  developerStatus: "/api/developer/status",
  gatewayStatus: "/api/gateway/status",
  metaplexHealth: "/api/metaplex-agents/health",
};

/** DNS-label slug for ar.dev Agent metadata.name */
export function toRegistryName(raw) {
  const name = String(raw || "cheshire-agent")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
  return name || "cheshire-agent";
}

/**
 * Normalize browser-agents API payload into a flat agent list.
 * @param {unknown} data
 */
export function normalizeBrowserAgents(data) {
  if (!data || typeof data !== "object") {
    return { count: 0, agents: [], importedAt: null, sourceRoot: null };
  }
  const d = /** @type {Record<string, unknown>} */ (data);
  let agents = [];
  if (Array.isArray(d.agents)) agents = d.agents;
  else if (Array.isArray(d.items)) agents = d.items;
  else if (d.agents && typeof d.agents === "object") {
    agents = Object.values(d.agents);
  }

  const list = agents
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const a = /** @type {Record<string, unknown>} */ (raw);
      const id = String(a.id || a.identifier || a.slug || "").trim();
      if (!id) return null;
      const title = String(a.title || a.name || (a.meta && /** @type {any} */ (a.meta).title) || id);
      const description = String(
        a.description ||
          a.summary ||
          (a.meta && /** @type {any} */ (a.meta).description) ||
          "",
      );
      const category = String(a.category || (a.meta && /** @type {any} */ (a.meta).category) || "general");
      const tags = Array.isArray(a.tags)
        ? a.tags.map(String)
        : Array.isArray(/** @type {any} */ (a.meta)?.tags)
          ? /** @type {any} */ (a.meta).tags.map(String)
          : [];
      return {
        id,
        title,
        description: description.slice(0, 4000),
        category,
        tags,
        featured: Boolean(a.featured),
        oneShot: Boolean(a.oneShot),
        registryName: toRegistryName(id),
        hubPath: `/agents/chat?agent=${encodeURIComponent(id)}`,
        forgePath: `/agents/forge?template=${encodeURIComponent(id)}`,
        mintPath: `/agents/mint?template=${encodeURIComponent(id)}`,
        source: a.source || null,
      };
    })
    .filter(Boolean);

  return {
    count: typeof d.count === "number" ? d.count : list.length,
    agents: list,
    importedAt: d.importedAt ?? null,
    sourceRoot: (() => {
      if (typeof d.sourceRoot === "string") return d.sourceRoot;
      if (d.integration && typeof d.integration === "object") {
        const m = /** @type {any} */ (d.integration).manifest;
        if (m && typeof m.sourceRoot === "string") return m.sourceRoot;
      }
      return null;
    })(),
  };
}

/**
 * Build agent-registry register body from a catalog agent (browser or package).
 */
export function catalogAgentToRegisterBody(agent, options = {}) {
  const id = agent.id || agent.identifier || agent.name || options.name;
  const name = toRegistryName(options.name || id);
  const title = String(options.title || agent.title || agent.name || name).slice(0, 200);
  const description = String(
    options.description || agent.description || agent.summary || `Cheshire Terminal agent ${title}`,
  ).slice(0, 4000);

  const labels = {
    app: "cheshire-terminal",
    catalog: "cheshire-terminal-cli",
    source: "cli-sync",
  };
  if (agent.category) labels.category = String(agent.category).slice(0, 63);
  if (Array.isArray(agent.tags)) {
    for (const tag of agent.tags.slice(0, 12)) {
      const t = String(tag)
        .toLowerCase()
        .replace(/[^a-z0-9._/-]+/g, "-")
        .slice(0, 63);
      if (t) labels[`tag.${t}`] = "true";
    }
  }

  return {
    name,
    title,
    description,
    tag: options.tag || "latest",
    modelProvider: options.modelProvider || "clawdrouter",
    modelName: options.modelName || "auto",
    namespace: options.namespace || "default",
    repositoryUrl:
      options.repositoryUrl ||
      "https://github.com/Solizardking/agents",
    image:
      options.image ||
      (typeof agent.avatar === "string" ? agent.avatar : undefined) ||
      "https://cheshireterminal.ai/og-image.png",
    labels,
  };
}

/**
 * Build frontend hub links for a site origin.
 */
export function hubLinks(siteUrl) {
  const base = String(siteUrl || "https://cheshireterminal.ai").replace(/\/+$/, "");
  return {
    cli: `${base}${SITE_SURFACES.cli}`,
    gateway: `${base}${SITE_SURFACES.gateway}`,
    skills: `${base}${SITE_SURFACES.skills}`,
    skillsStore: `${base}${SITE_SURFACES.skillsStore}`,
    agents: `${base}${SITE_SURFACES.agents}`,
    forge: `${base}${SITE_SURFACES.agentsForge}`,
    registry: `${base}${SITE_SURFACES.agentRegistry}`,
    registryAliases: [
      `${base}${SITE_SURFACES.registry}`,
      `${base}${SITE_SURFACES.agentsRegistry}`,
    ],
    api: {
      skills: `${base}${API_SURFACES.skills}`,
      browserAgents: `${base}${API_SURFACES.browserAgents}`,
      registryStatus: `${base}${API_SURFACES.registryStatus}`,
      registryAgents: `${base}${API_SURFACES.registryAgents}`,
      register: `${base}${API_SURFACES.registryRegister}`,
    },
  };
}

/**
 * Try optional cheshire-terminal-agents package for local catalog (not required).
 */
export async function tryLoadLocalPackageCatalog() {
  try {
    const mod = await import("cheshire-terminal-agents");
    const ids =
      typeof mod.listCatalogIdentifiers === "function"
        ? mod.listCatalogIdentifiers()
        : [];
    return {
      available: true,
      package: "cheshire-terminal-agents",
      count: ids.length,
      identifiers: ids,
      loadAgent:
        typeof mod.loadAgentWithLocale === "function"
          ? (id) => mod.loadAgentWithLocale(id, "en")
          : null,
    };
  } catch {
    return {
      available: false,
      package: "cheshire-terminal-agents",
      count: 0,
      identifiers: [],
      loadAgent: null,
      hint: "npm i cheshire-terminal-agents  # optional dual-rail forge catalog",
    };
  }
}
