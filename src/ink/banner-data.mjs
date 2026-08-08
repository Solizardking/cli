/**
 * Pure brand strings for the Ink shell and frame tests.
 */
import {
  CLI_BRAND,
  CLI_NAME,
  CLI_PACKAGE_NAME,
  CLI_HUB_URL,
  CLI_GATEWAY_URL,
  DEFAULT_SITE_URL,
} from "../config.mjs";

export const BANNER_TITLE = CLI_BRAND;
export const BANNER_SUBTITLE = "Open CLI · skills · agents · eliza · arena · forge";

/** Primary identity strings expected in Ink frames / smoke output. */
export const BANNER_PRIMARY_MARKERS = [
  "Cheshire Terminal",
  "cheshireterminal.ai",
  "cheshire-cli",
];

/**
 * @param {{ siteUrl?: string }} [opts]
 */
export function getBannerModel(opts = {}) {
  const siteUrl = (opts.siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, "");
  return {
    brand: CLI_BRAND,
    name: CLI_NAME,
    packageName: CLI_PACKAGE_NAME,
    siteUrl,
    hub: CLI_HUB_URL.includes("cheshireterminal.ai")
      ? `${siteUrl}/cli`
      : CLI_HUB_URL,
    gateway: CLI_GATEWAY_URL.includes("cheshireterminal.ai")
      ? `${siteUrl}/gateway`
      : CLI_GATEWAY_URL,
    agents: `${siteUrl}/agents`,
    forge: `${siteUrl}/agents/forge`,
    eliza: `${siteUrl}/eliza-agents`,
    arena: `${siteUrl}/arena`,
    subtitle: BANNER_SUBTITLE,
    modeLine: "tui · status · skills · agents · help · exit",
  };
}
