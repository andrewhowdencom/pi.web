import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import hljs from "highlight.js/lib/core";
import { MarkdownRenderer } from "./MarkdownRenderer.js";

vi.mock("highlight.js/lib/core", () => ({
  default: {
    registerLanguage: vi.fn(),
    highlightElement: vi.fn(),
  },
}));

vi.mock("highlight.js/lib/languages/javascript", () => ({ default: {} }));
vi.mock("highlight.js/lib/languages/typescript", () => ({ default: {} }));
vi.mock("highlight.js/lib/languages/go", () => ({ default: {} }));
vi.mock("highlight.js/lib/languages/python", () => ({ default: {} }));
vi.mock("highlight.js/lib/languages/bash", () => ({ default: {} }));
vi.mock("highlight.js/lib/languages/json", () => ({ default: {} }));
vi.mock("highlight.js/lib/languages/yaml", () => ({ default: {} }));
vi.mock("highlight.js/lib/languages/css", () => ({ default: {} }));
vi.mock("highlight.js/lib/languages/xml", () => ({ default: {} }));
vi.mock("highlight.js/lib/languages/sql", () => ({ default: {} }));
vi.mock("highlight.js/lib/languages/rust", () => ({ default: {} }));
vi.mock("highlight.js/lib/languages/markdown", () => ({ default: {} }));

describe("MarkdownRenderer", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders headings", () => {
    render(<MarkdownRenderer content="# Hello" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeDefined();
    expect(heading.textContent).toBe("Hello");
  });

  it("renders bold and italic text", () => {
    render(<MarkdownRenderer content="**bold** and *italic*" />);
    const strong = document.querySelector("strong");
    const em = document.querySelector("em");
    expect(strong).not.toBeNull();
    expect(strong!.textContent).toBe("bold");
    expect(em).not.toBeNull();
    expect(em!.textContent).toBe("italic");
  });

  it("renders unordered lists", () => {
    render(<MarkdownRenderer content={"- item 1\n- item 2"} />);
    const items = document.querySelectorAll("li");
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain("item 1");
    expect(items[1].textContent).toContain("item 2");
  });

  it("renders ordered lists", () => {
    render(<MarkdownRenderer content={"1. first\n2. second"} />);
    const items = document.querySelectorAll("li");
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain("first");
    expect(items[1].textContent).toContain("second");
  });

  it("renders code blocks", () => {
    render(<MarkdownRenderer content={"```js\nconst x = 1;\n```"} />);
    const pre = document.querySelector("pre");
    const code = document.querySelector("pre code");
    expect(pre).not.toBeNull();
    expect(code).not.toBeNull();
    expect(code!.textContent).toContain("const x = 1;");
  });

  it("renders inline code", () => {
    render(<MarkdownRenderer content="use `code` here" />);
    // There may be code elements from highlight.js CSS, so scope to the rendered container
    const codes = document.querySelectorAll("code");
    const inlineCode = Array.from(codes).find((c) => c.textContent === "code");
    expect(inlineCode).toBeDefined();
  });

  it("renders blockquotes", () => {
    render(<MarkdownRenderer content="> a quote" />);
    const blockquote = document.querySelector("blockquote");
    expect(blockquote).not.toBeNull();
    expect(blockquote!.textContent).toContain("a quote");
  });

  it("renders tables", () => {
    render(
      <MarkdownRenderer content={"| a | b |\n|---|---|\n| 1 | 2 |"} />
    );
    const table = document.querySelector("table");
    expect(table).not.toBeNull();
    const cells = document.querySelectorAll("td");
    expect(cells.length).toBe(2);
  });

  it("renders horizontal rules", () => {
    render(<MarkdownRenderer content={"before\n\n---\n\nafter"} />);
    expect(document.querySelector("hr")).not.toBeNull();
  });

  it("strips script tags via sanitization", () => {
    render(
      <MarkdownRenderer content="<script>alert('xss')</script>" />
    );
    expect(document.querySelector("script")).toBeNull();
  });

  it("adds target and rel to links", () => {
    render(<MarkdownRenderer content="[link](https://example.com)" />);
    const link = document.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe("https://example.com");
    expect(link!.getAttribute("target")).toBe("_blank");
    expect(link!.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("removes or neutralizes dangerous href protocols", () => {
    render(<MarkdownRenderer content="[link](javascript:alert(1))" />);
    const link = document.querySelector("a");
    expect(link).not.toBeNull();
    const href = link!.getAttribute("href");
    expect(href === null || !href.startsWith("javascript:")).toBe(true);
  });

  it("parses markdown immediately when not streaming", () => {
    render(<MarkdownRenderer content="Hello **world**" isStreaming={false} />);
    const strong = document.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong!.textContent).toBe("world");
  });

  it("shows raw text during streaming before debounce completes", () => {
    render(<MarkdownRenderer content="Hello **world**" isStreaming={true} />);
    const container = document.querySelector(".markdown-body--raw");
    expect(container).not.toBeNull();
    expect(container!.textContent).toBe("Hello **world**");
  });

  it("calls highlightElement on code blocks after parsing", () => {
    render(<MarkdownRenderer content={"```js\nconst x = 1;\n```"} />);
    expect(vi.mocked(hljs.highlightElement)).toHaveBeenCalled();
  });

  it("renders images with sanitized src", () => {
    render(
      <MarkdownRenderer content="![alt](https://example.com/img.png)" />
    );
    const img = document.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("https://example.com/img.png");
    expect(img!.getAttribute("alt")).toBe("alt");
  });
});
