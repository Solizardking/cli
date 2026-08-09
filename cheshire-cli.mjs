#!/usr/bin/env node
/**
 * Cheshire Terminal CLI entrypoint.
 * Defaults to https://cheshireterminal.ai — override with CHESHIRE_SITE_URL.
 * Companion mesh: https://solanaclawd.com (SOLANA_CLAWD_SITE_URL).
 *
 * Interactive Ink shell: bare TTY launch, `tui` / `repl` / `--tui`.
 * Command mode (scripts/CI): `status`, `help`, `wallet:*`, `skills`, …
 *
 * Ink is lazy-loaded so curl file-install works without react/ink installed
 * (npm install of cheshire-terminal-cli still ships Ink for TUI).
 */
import { runCommand } from "./src/commands.mjs";

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
    // Bare launch only opens Ink on a TTY; otherwise fall through to help.
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
    const ink = await import("./src/ink/entry.mjs");
    if (inkMode === "smoke") {
      const r = await ink.runInkSmoke();
      process.exit(r.ok ? 0 : 1);
    }
    if (ink.wantsInkSmoke?.(argv)) {
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
