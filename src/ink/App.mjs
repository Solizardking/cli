/**
 * Interactive Cheshire Terminal CLI shell (Ink).
 * Command logic stays in commands.mjs; this owns presentation + prompt.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import { Banner } from "./Banner.mjs";
import { resolveSiteUrl } from "../config.mjs";
import { runCommand } from "../commands.mjs";

/**
 * @typedef {{ id: number, text: string, color?: string, dim?: boolean, bold?: boolean }} LogLine
 */

let lineId = 0;
function nextId() {
  lineId += 1;
  return lineId;
}

/**
 * @param {{
 *   siteUrl?: string,
 *   smoke?: boolean,
 *   interactive?: boolean,
 *   initialLines?: LogLine[],
 * }} props
 */
export function App({
  siteUrl: siteUrlProp,
  smoke = false,
  interactive = true,
  initialLines,
} = {}) {
  const siteUrl = resolveSiteUrl(siteUrlProp);
  const { exit } = useApp();
  const [lines, setLines] = useState(
    () =>
      initialLines || [
        {
          id: nextId(),
          text: 'Type a command (status, skills, connect, help) or "exit". Prefix with ! for raw argv.',
          dim: true,
        },
      ],
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const append = useCallback((text, style = {}) => {
    const parts = String(text).split("\n");
    setLines((prev) => {
      const next = [...prev];
      for (const p of parts) {
        next.push({ id: nextId(), text: p, ...style });
      }
      return next;
    });
  }, []);

  useInput(
    (ch, key) => {
      if (key.ctrl && ch === "c") exit();
    },
    { isActive: interactive && !smoke },
  );

  useEffect(() => {
    if (!smoke) return;
    const t = setTimeout(() => exit(), 50);
    return () => clearTimeout(t);
  }, [smoke, exit]);

  const submit = useCallback(
    async (raw) => {
      const trimmed = raw.trim();
      if (!trimmed || busy) return;
      setInput("");
      append(`› ${trimmed}`, { color: "white" });

      if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
        append("Goodbye.", { dim: true });
        exit();
        return;
      }

      // Shell-style: "status" or "!status --json" → argv for runCommand
      const argv = trimmed.startsWith("!")
        ? trimmed.slice(1).trim().split(/\s+/).filter(Boolean)
        : trimmed.split(/\s+/).filter(Boolean);

      if (argv[0] === "tui" || argv[0] === "repl") {
        append("Already in Ink TUI.", { dim: true });
        return;
      }

      setBusy(true);
      try {
        // Inject site if not already flagged
        const hasSite = argv.includes("--site");
        const fullArgv = hasSite ? argv : [...argv, "--site", siteUrl];
        const { exitCode, result, text } = await runCommand(fullArgv);
        if (text) {
          append(text, { color: exitCode === 0 ? "white" : "yellow" });
        } else {
          append(JSON.stringify(result, null, 2), {
            color: exitCode === 0 ? "white" : "yellow",
            dim: true,
          });
        }
        if (exitCode !== 0) {
          append(`exit ${exitCode}`, { color: "yellow", dim: true });
        }
      } catch (err) {
        append(`Error: ${err instanceof Error ? err.message : String(err)}`, {
          color: "yellow",
        });
      } finally {
        setBusy(false);
      }
    },
    [append, busy, exit, siteUrl],
  );

  return React.createElement(
    Box,
    { flexDirection: "column", paddingX: 1 },
    React.createElement(Banner, { siteUrl }),
    React.createElement(
      Box,
      { flexDirection: "column", marginY: 1 },
      ...lines.map((line) =>
        React.createElement(
          Text,
          {
            key: line.id,
            color: line.color,
            dimColor: line.dim,
            bold: line.bold,
          },
          line.text,
        ),
      ),
    ),
    interactive && !smoke
      ? React.createElement(
          Box,
          null,
          React.createElement(Text, { color: "green", bold: true }, "› "),
          busy
            ? React.createElement(Text, { dimColor: true }, "(busy…)")
            : React.createElement(TextInput, {
                value: input,
                onChange: setInput,
                onSubmit: (v) => {
                  void submit(v);
                },
                placeholder: "status | skills | help | exit",
              }),
        )
      : null,
    smoke
      ? React.createElement(
          Text,
          { dimColor: true },
          "ink-smoke ok · Cheshire Terminal · cheshire-cli · cheshireterminal.ai",
        )
      : null,
  );
}

export default App;
