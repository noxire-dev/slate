import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { highlightCode, type Highlighter } from "@lezer/highlight";
import DOMPurify from "dompurify";
import { marked } from "marked";

/**
 * Markdown to DOM nodes that are safe to insert. The webview can read and write any file the
 * user can, so a script smuggled in through a README must never run: the HTML is sanitised here,
 * and the CSP forbids inline script as the second lock.
 */
export function renderMarkdown(source: string, highlighter: Highlighter): DocumentFragment {
  const html = marked.parse(source, { gfm: true, async: false });
  const page = DOMPurify.sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: ["style", "form", "button", "textarea", "select"],
    FORBID_ATTR: ["style", "id", "name"],
  });

  const taken = new Set<string>();
  for (const heading of page.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    // GitHub's anchor rule, so the tables of contents agents write resolve.
    let id = (heading.textContent ?? "").trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-");
    while (taken.has(id)) id += "-1";
    taken.add(id);
    heading.id = id;
  }
  for (const box of page.querySelectorAll("input")) box.disabled = true;
  // Our own buttons go in after DOMPurify has run, so a <button> in the document itself is still stripped.
  for (const pre of page.querySelectorAll("pre")) {
    const copy = document.createElement("button");
    copy.className = "copy";
    copy.type = "button";
    copy.textContent = "Copy";
    copy.ariaLabel = "Copy code";
    pre.append(copy);
  }
  for (const block of page.querySelectorAll<HTMLElement>("pre > code[class^='language-']")) {
    void highlight(block, block.className.slice("language-".length), highlighter);
  }
  return page;
}

async function highlight(block: HTMLElement, name: string, highlighter: Highlighter) {
  const support = await LanguageDescription.matchLanguageName(languages, name, true)?.load().catch(() => null);
  if (!support) return;
  const code = block.textContent ?? "";
  const out = document.createDocumentFragment();
  highlightCode(
    code,
    support.language.parser.parse(code),
    highlighter,
    (text, classes) => {
      const node = classes ? Object.assign(document.createElement("span"), { className: classes }) : null;
      out.append(node ? (node.append(text), node) : text);
    },
    () => out.append("\n"),
  );
  block.replaceChildren(out);
}

/** Resolves a link found in a markdown file at `from` to an absolute Windows or POSIX path. */
export function resolveLink(from: string | null, href: string): string | null {
  if (!from) return null;
  try {
    const base = new URL(`file:///${from.replace(/\\/g, "/").replace(/^\//, "")}`);
    const path = decodeURIComponent(new URL(href.split("#")[0], base).pathname);
    return /^\/[A-Za-z]:/.test(path) ? path.slice(1).replace(/\//g, "\\") : path;
  } catch {
    return null;
  }
}
