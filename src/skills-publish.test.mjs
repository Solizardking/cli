/**
 * Drive real CLI helpers for skills store publish path (no network).
 * Run: node --test cli/src/skills-publish.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadLocalSkillDraft, usageText } from "./commands.mjs";
import { API_SURFACES } from "./catalog.mjs";

describe("skills publish draft loader", () => {
  it("loads SKILL.md + companion files from a real directory", async () => {
    const root = join(tmpdir(), `cheshire-skill-publish-${Date.now()}`);
    await mkdir(root, { recursive: true });
    await writeFile(
      join(root, "SKILL.md"),
      `---
name: demo-cli-skill
description: Demo skill used by CLI publish unit tests for Cheshire Skills Store listing.
---

# Demo CLI skill

Use when testing publish.
`,
      "utf8",
    );
    await mkdir(join(root, "references"), { recursive: true });
    await writeFile(join(root, "references", "notes.md"), "# notes\n", "utf8");

    try {
      const draft = await loadLocalSkillDraft(root);
      assert.equal(draft.slug, "demo-cli-skill");
      assert.equal(draft.name, "demo-cli-skill");
      assert.ok(draft.description.length >= 20);
      assert.ok(draft.files.some((f) => f.path === "SKILL.md"));
      assert.ok(draft.files.some((f) => f.path === "references/notes.md"));
      assert.ok(draft.files.find((f) => f.path === "SKILL.md")?.content.startsWith("---"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects directories without SKILL.md", async () => {
    const root = join(tmpdir(), `cheshire-skill-empty-${Date.now()}`);
    await mkdir(root, { recursive: true });
    try {
      await assert.rejects(() => loadLocalSkillDraft(root), /Missing SKILL\.md/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("skills store CLI surface", () => {
  it("documents publish + store commands and API surfaces", () => {
    const help = usageText();
    assert.match(help, /skills:store/);
    assert.match(help, /skills:publish/);
    assert.match(help, /skills:validate/);
    assert.equal(API_SURFACES.skillsStore, "/api/skills-store");
    assert.equal(API_SURFACES.skillScannerSave, "/api/skill-scanner/save");
    assert.equal(API_SURFACES.skillScannerValidate, "/api/skill-scanner/validate");
  });
});
