/**
 * Ink entry helpers for cheshire-cli process launchers.
 */
import React from "react";
import { render } from "ink";
import { App } from "./App.mjs";
import { runInkSmoke } from "./smoke.mjs";
import { resolveSiteUrl } from "../config.mjs";

/** Commands / flags that open the Ink interactive shell. */
export const INK_SHELL_COMMANDS = new Set([
  "tui",
  "repl",
  "shell",
  "--tui",
  "--repl",
  "--ink",
]);

/**
 * @param {string[]} argv process.argv.slice(2)
 * @returns {boolean}
 */
export function wantsInkShell(argv) {
  if (argv.includes("--ink-smoke")) return false; // handled separately
  if (argv.some((a) => INK_SHELL_COMMANDS.has(a))) return true;
  // Bare launch on a TTY → interactive Ink hub
  if (argv.length === 0 && process.stdin.isTTY && process.stdout.isTTY) return true;
  return false;
}

/**
 * @param {string[]} argv
 */
export function wantsInkSmoke(argv) {
  return argv.includes("--ink-smoke");
}

/**
 * @param {{ siteUrl?: string }} [opts]
 */
export async function launchInkShell(opts = {}) {
  const siteUrl = resolveSiteUrl(opts.siteUrl);
  const { waitUntilExit } = render(
    React.createElement(App, {
      siteUrl,
      smoke: false,
      interactive: true,
    }),
  );
  await waitUntilExit();
}

export { runInkSmoke };
