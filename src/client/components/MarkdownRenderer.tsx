import React, { useEffect, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import go from "highlight.js/lib/languages/go";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import sql from "highlight.js/lib/languages/sql";
import rust from "highlight.js/lib/languages/rust";
import markdown from "highlight.js/lib/languages/markdown";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("go", go);
hljs.registerLanguage("python", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("markdown", markdown);

// Add link security hooks once at module level
try {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      const href = node.getAttribute("href") || "";
      if (/^\s*javascript:/i.test(href) || /^\s*data:/i.test(href)) {
        node.removeAttribute("href");
      } else {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    }
  });
} catch {
  // DOMPurify hooks may fail in some test environments
}

function parseMarkdown(content: string): string {
  const rawHtml = marked.parse(content, { breaks: true }) as string;
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      "a",
      "b",
      "strong",
      "i",
      "em",
      "code",
      "pre",
      "blockquote",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "hr",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "img",
      "div",
      "span",
      "del",
      "ins",
      "sup",
      "sub",
    ],
    ALLOWED_ATTR: [
      "href",
      "title",
      "src",
      "alt",
      "class",
      "target",
      "rel",
      "colspan",
      "rowspan",
      "align",
      "width",
      "height",
    ],
  });
}

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

export function MarkdownRenderer({
  content,
  isStreaming,
}: MarkdownRendererProps) {
  const [displayHtml, setDisplayHtml] = useState<string>("");
  const [isParsed, setIsParsed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!isStreaming) {
      const html = parseMarkdown(content);
      setDisplayHtml(html);
      setIsParsed(true);
    } else {
      setIsParsed(false);
      timeoutRef.current = setTimeout(() => {
        const html = parseMarkdown(content);
        setDisplayHtml(html);
        setIsParsed(true);
      }, 200);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, isStreaming]);

  useEffect(() => {
    if (isParsed && containerRef.current) {
      const blocks = containerRef.current.querySelectorAll("pre code");
      blocks.forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
      });
    }
  }, [isParsed, displayHtml]);

  if (!isParsed) {
    return (
      <div
        className="markdown-body markdown-body--raw"
        style={{ whiteSpace: "pre-wrap" }}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="markdown-body markdown-body--parsed"
      dangerouslySetInnerHTML={{ __html: displayHtml }}
    />
  );
}
