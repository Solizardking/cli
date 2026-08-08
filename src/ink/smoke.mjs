/**
 * Short-lived Ink mount smoke for CI.
 * Real ink `render` has no lastFrame (that is ink-testing-library only).
 */
import React from "react";
import { render } from "ink";
import { App } from "./App.mjs";
import { resolveSiteUrl } from "../config.mjs";

export const SMOKE_MARKER = "ink-smoke ok";

/**
 * @param {{ siteUrl?: string }} [opts]
 */
export async function runInkSmoke(opts = {}) {
  const siteUrl = resolveSiteUrl(opts.siteUrl);
  const instance = render(
    React.createElement(App, {
      siteUrl,
      smoke: true,
      interactive: false,
    }),
  );

  await Promise.race([
    instance.waitUntilExit(),
    new Promise((r) => setTimeout(r, 500)),
  ]);
  try {
    instance.unmount();
  } catch {
    // already unmounted
  }

  const marker = `${SMOKE_MARKER} · Cheshire Terminal · cheshire-cli · cheshireterminal.ai`;
  process.stdout.write(`${marker}\n`);
  return { ok: true, marker, siteUrl };
}
