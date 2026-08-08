#!/usr/bin/env node
/**
 * Cheshire Terminal CLI entrypoint.
 * Defaults to https://cheshireterminal.ai — override with CHESHIRE_SITE_URL.
 *
 * Interactive Ink shell: bare TTY launch, `tui` / `repl` / `--tui`.
 * Command mode (scripts/CI): `status`, `help`, `skills`, …
 */
import { runCommand } from "./src/commands.mjs";
import {
  wantsInkShell,
  wantsInkSmoke,
  launchInkShell,
  runInkSmoke,
} from "./src/ink/entry.mjs";

const argv = process.argv.slice(2);

if (wantsInkSmoke(argv)) {
  const r = await runInkSmoke();
  process.exit(r.ok ? 0 : 1);
}

if (wantsInkShell(argv)) {
  // Strip shell meta-args; remaining tokens unused for now (site via env/flags later)
  await launchInkShell();
  process.exit(0);
}

const { exitCode, result, text } = await runCommand(argv);

if (text) {
  console.log(text);
} else {
  console.log(JSON.stringify(result, null, 2));
}

process.exit(exitCode ?? 0);
