import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dashSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "routes", "dashboard.jsx"),
  "utf8"
);

function loadHelpers() {
  const start = dashSource.indexOf("function escapeHtml");
  const code = dashSource.slice(start);
  // eslint-disable-next-line no-new-func
  const fn = new Function(code + "\nreturn { mdToHtml, escapeHtml };");
  return fn();
}

describe("markdown import helper", () => {
  const { mdToHtml } = loadHelpers();

  it("converts headings", () => {
    expect(mdToHtml("# Hello")).toContain("<h1>Hello</h1>");
    expect(mdToHtml("## Sub")).toContain("<h2>Sub</h2>");
  });

  it("converts bold and italic", () => {
    const html = mdToHtml("This is **bold** and *italic*.");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("converts bulleted lists", () => {
    const html = mdToHtml("- one\n- two\n- three");
    expect(html).toContain("<ul>");
    expect((html.match(/<li>/g) || []).length).toBe(3);
  });

  it("escapes raw HTML", () => {
    const html = mdToHtml("Hello <script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});