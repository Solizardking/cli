/**
 * Frame tests for the Cheshire CLI Ink shell — drives real components.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render } from "ink-testing-library";
import { Banner } from "./Banner.mjs";
import { App } from "./App.mjs";
import {
  BANNER_PRIMARY_MARKERS,
  getBannerModel,
  BANNER_TITLE,
} from "./banner-data.mjs";
import { wantsInkShell, wantsInkSmoke, INK_SHELL_COMMANDS } from "./entry.mjs";

describe("ink banner frames", () => {
  it("Banner frame includes Cheshire brand and hub hosts", () => {
    const { lastFrame } = render(
      React.createElement(Banner, { siteUrl: "https://cheshireterminal.ai" }),
    );
    const frame = lastFrame() || "";
    assert.match(frame, /Cheshire Terminal/);
    assert.match(frame, /cheshireterminal\.ai/);
    assert.match(frame, /cheshire-cli/);
    assert.doesNotMatch(frame, /solanaclawd\.com/);
    for (const marker of BANNER_PRIMARY_MARKERS) {
      assert.ok(
        frame.toLowerCase().includes(marker.toLowerCase()),
        `expected "${marker}" in frame:\n${frame}`,
      );
    }
  });

  it("Banner compact still shows identity", () => {
    const { lastFrame } = render(
      React.createElement(Banner, {
        siteUrl: "https://cheshireterminal.ai",
        compact: true,
      }),
    );
    const frame = lastFrame() || "";
    assert.match(frame, /Cheshire Terminal/);
    assert.match(frame, /cheshireterminal\.ai/);
  });

  it("App smoke shell frame shows ink-smoke marker + brand", () => {
    const { lastFrame } = render(
      React.createElement(App, {
        siteUrl: "https://cheshireterminal.ai",
        smoke: true,
        interactive: false,
      }),
    );
    const frame = lastFrame() || "";
    assert.match(frame, /Cheshire Terminal|cheshire-cli/);
    assert.match(frame, /cheshireterminal\.ai/);
    assert.match(frame, /ink-smoke/);
  });

  it("getBannerModel is stable product identity", () => {
    const m = getBannerModel({ siteUrl: "https://cheshireterminal.ai" });
    assert.equal(m.brand, BANNER_TITLE);
    assert.equal(m.siteUrl, "https://cheshireterminal.ai");
    assert.match(m.hub, /\/cli$/);
    assert.match(m.forge, /\/agents\/forge$/);
  });
});

describe("ink entry routing", () => {
  it("wantsInkSmoke detects flag", () => {
    assert.equal(wantsInkSmoke(["--ink-smoke"]), true);
    assert.equal(wantsInkSmoke(["status"]), false);
  });

  it("wantsInkShell detects tui/repl commands", () => {
    assert.equal(wantsInkShell(["tui"]), true);
    assert.equal(wantsInkShell(["repl"]), true);
    assert.equal(wantsInkShell(["--tui"]), true);
    assert.equal(wantsInkShell(["status"]), false);
    assert.equal(wantsInkShell(["help"]), false);
    assert.ok(INK_SHELL_COMMANDS.has("tui"));
  });
});
