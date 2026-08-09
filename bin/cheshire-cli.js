#!/usr/bin/env node
/**
 * npm bin entry for cheshire-terminal-cli
 * (plain .js path for maximum npm/Windows compatibility)
 *
 * Interactive Ink shell: bare TTY launch, `tui` / `repl` / `--tui`.
 * Command mode: status, help, wallet:*, skills, agents, …
 * Ink is lazy-loaded so thin installs still run help/status/wallet.
 */
import { runCommand } from "../src/commands.mjs";

const argv = process.argv.slice(2);

function wantsInkMeta(a) {
  if (a.includes("--ink-smoke")) return "smoke";
  if (
    a.length === 0 ||
    a[0] === "tui" ||
    a[0] === "repl" ||
    a[0] === "shell" ||
    a.includes("--tui") ||
    a.includes("--repl") ||
    a.includes("--ink")
  ) {
    if (a.length === 0 && !process.stdin.isTTY) return null;
    if (a.length === 0 || a[0] === "tui" || a[0] === "repl" || a[0] === "shell") {
      return "shell";
    }
    if (a.includes("--tui") || a.includes("--repl") || a.includes("--ink")) {
      return "shell";
    }
  }
  return null;
}

const inkMode = wantsInkMeta(argv);
if (inkMode) {
  try {
    const ink = await import("../src/ink/entry.mjs");
    if (inkMode === "smoke" || ink.wantsInkSmoke?.(argv)) {
      const r = await ink.runInkSmoke();
      process.exit(r.ok ? 0 : 1);
    }
    if (ink.wantsInkShell?.(argv) || inkMode === "shell") {
      await ink.launchInkShell();
      process.exit(0);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      "Ink TUI unavailable (install full package: npm i -g cheshire-terminal-cli).\n" +
        `Detail: ${msg}\n` +
        "Use command mode: cheshire-cli help | status | wallet:status",
    );
    process.exit(1);
  }
}

const { exitCode, result, text } = await runCommand(argv);

if (text) {
  console.log(text);
} else {
  console.log(JSON.stringify(result, null, 2));
}

process.exit(exitCode ?? 0);
