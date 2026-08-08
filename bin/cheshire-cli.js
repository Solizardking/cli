#!/usr/bin/env node
/**
 * npm bin entry for cheshire-terminal-cli
 * (plain .js path for maximum npm/Windows compatibility)
 *
 * Interactive Ink shell: bare TTY launch, `tui` / `repl` / `--tui`.
 * Command mode: status, help, skills, agents, …
 */
import { runCommand } from "../src/commands.mjs";
import {
  wantsInkShell,
  wantsInkSmoke,
  launchInkShell,
  runInkSmoke,
} from "../src/ink/entry.mjs";

const argv = process.argv.slice(2);

if (wantsInkSmoke(argv)) {
  const r = await runInkSmoke();
  process.exit(r.ok ? 0 : 1);
}

if (wantsInkShell(argv)) {
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
