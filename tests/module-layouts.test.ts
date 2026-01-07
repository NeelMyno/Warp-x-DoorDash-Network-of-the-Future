import test from "node:test";
import assert from "node:assert/strict";

import { pickPrimarySection } from "../src/lib/modules/section-utils";
import { getModuleBySlug } from "../src/lib/modules/registry";

// ─────────────────────────────────────────────────────────────────────────────
// pickPrimarySection tests
// ─────────────────────────────────────────────────────────────────────────────

test("pickPrimarySection: returns undefined for empty sections array", () => {
  const result = pickPrimarySection([]);
  assert.equal(result, undefined);
});

test("pickPrimarySection: prefers end-vision section when non-empty", () => {
  const sections = [
    { key: "progress", label: "Progress", content: "progress content", isEmpty: false },
    { key: "end-vision", label: "End Vision", content: "end-vision content", isEmpty: false },
    { key: "roadmap", label: "Roadmap", content: "roadmap content", isEmpty: false },
  ];
  const result = pickPrimarySection(sections);
  assert.equal(result?.key, "end-vision");
});

test("pickPrimarySection: falls back to first non-empty if end-vision is empty", () => {
  const sections = [
    { key: "end-vision", label: "End Vision", content: null, isEmpty: true },
    { key: "progress", label: "Progress", content: "progress content", isEmpty: false },
    { key: "roadmap", label: "Roadmap", content: null, isEmpty: true },
  ];
  const result = pickPrimarySection(sections);
  assert.equal(result?.key, "progress");
});

test("pickPrimarySection: falls back to first non-empty if end-vision is missing", () => {
  const sections = [
    { key: "progress", label: "Progress", content: "progress content", isEmpty: false },
    { key: "roadmap", label: "Roadmap", content: null, isEmpty: true },
  ];
  const result = pickPrimarySection(sections);
  assert.equal(result?.key, "progress");
});

test("pickPrimarySection: returns first section if all are empty", () => {
  const sections = [
    { key: "end-vision", label: "End Vision", content: null, isEmpty: true },
    { key: "progress", label: "Progress", content: null, isEmpty: true },
  ];
  const result = pickPrimarySection(sections);
  assert.equal(result?.key, "end-vision");
});

// ─────────────────────────────────────────────────────────────────────────────
// Registry tests
// ─────────────────────────────────────────────────────────────────────────────

test("year-in-review module is registered with full_bleed_single_section layout", () => {
  const entry = getModuleBySlug("year-in-review");
  assert.ok(entry, "year-in-review module should be registered");
  assert.equal(entry.layout, "full_bleed_single_section");
});

test("year-in-review module has strict primarySectionKey set to end-vision", () => {
  const entry = getModuleBySlug("year-in-review");
  assert.ok(entry, "year-in-review module should be registered");
  assert.equal(entry.primarySectionKey, "end-vision", "year-in-review must strictly render end-vision only");
});

test("narrative modules retain their layout", () => {
  const bigAndBulky = getModuleBySlug("big-and-bulky");
  assert.ok(bigAndBulky, "big-and-bulky module should be registered");
  assert.equal(bigAndBulky.layout, "narrative");
});

test("narrative modules do not have primarySectionKey (use fallback)", () => {
  const bigAndBulky = getModuleBySlug("big-and-bulky");
  assert.ok(bigAndBulky, "big-and-bulky module should be registered");
  assert.equal(bigAndBulky.primarySectionKey, undefined, "narrative modules should not set primarySectionKey");
});

