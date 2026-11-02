import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  LanguageDescription,
  syntaxHighlighting,
} from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, type StateEffect } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  EditorView,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
  rectangularSelection,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { getCM, vim } from "@replit/codemirror-vim";
import { title, type Tab } from "./session";
import type { Settings } from "./settings";

export interface EditorEvents {
  edited(): void;
  moved(): void;
  /** "normal", "insert", "visual", "visual line", "visual block", "replace", or "" with vim off. */
  mode(mode: string): void;
}

// Excalidraw's pen colours, defined in styles.css so light and dark are the stylesheet's business.
// Also used for code blocks in the reading view.
export const ink = HighlightStyle.define([
  { tag: [t.comment, t.meta], color: "var(--grey)", fontStyle: "italic" },
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: "var(--violet)" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "var(--green)" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--orange)" },
  { tag: [t.typeName, t.className, t.namespace, t.tagName], color: "var(--blue)" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.attributeName], color: "var(--blue)" },
  { tag: [t.heading, t.strong], color: "var(--violet)", fontWeight: "600" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: [t.link, t.url], color: "var(--primary)", textDecoration: "underline", textUnderlineOffset: "3px" },
  { tag: [t.punctuation, t.bracket], color: "var(--muted)" },
  { tag: t.invalid, color: "var(--red)", textDecoration: "underline wavy" },
]);

const theme = EditorView.theme({
  "&": { height: "100%", color: "var(--ink)", backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--mono)", fontSize: "var(--size)", lineHeight: "1.6" },
  ".cm-content": { padding: "10px 0 40vh", caretColor: "var(--primary)" },
  ".cm-line": { padding: "0 24px 0 12px" },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--grey)", border: "none" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 18px", minWidth: "3ch" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--ink)" },
  "& .cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "var(--primary-light)",
  },
  ".cm-selectionMatch": { backgroundColor: "var(--wash-yellow)" },
  "&.cm-focused .cm-matchingBracket": { backgroundColor: "var(--primary-light)", outline: "none" },
  ".cm-cursor": { borderLeftColor: "var(--primary)", borderLeftWidth: "2px" },
  // The vim plugin ships its cursor colours at highest precedence and colours the glyph inline.
  ".cm-fat-cursor": { background: "var(--primary) !important", color: "var(--canvas) !important" },
  "&:not(.cm-focused) .cm-fat-cursor": { background: "none !important", outline: "1px solid var(--primary) !important" },
  ".cm-panels": { backgroundColor: "var(--island)", color: "var(--ink)" },
  ".cm-panels-top": { borderBottom: "1px solid var(--border)" },
  ".cm-searchMatch": { backgroundColor: "var(--wash-yellow)" },
  ".cm-searchMatch-selected": { backgroundColor: "var(--primary-light)" },
});

/** vim's relativenumber: the cursor's own line keeps its real number, every other line shows its distance. */
function relative(lineNo: number, state: EditorState): string {
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;
  return lineNo === cursorLine ? String(lineNo) : String(Math.abs(lineNo - cursorLine));
}

export function languageName(tab: Tab): string {
  return ((tab.path || tab.state) && LanguageDescription.matchFilename(languages, title(tab))?.name) || "Plain text";
}

/** One CodeMirror view. Each tab keeps its own EditorState, so undo history stays per tab. */
export class Editor {
  readonly view: EditorView;
  private states = new Map<string, EditorState>();
  private shown = "";
  private language = new Compartment();
  private options = new Compartment();
  /** Spelling is per tab: on for notes and markdown, off for code, where every identifier would be underlined. */
  private spelling = new Compartment();
  private prose = new Map<string, boolean>();

  constructor(parent: HTMLElement, private settings: Settings, private events: EditorEvents) {
    this.view = new EditorView({ parent });
  }

  show(tab: Tab) {
    if (this.states.has(this.shown)) this.states.set(this.shown, this.view.state);
    const known = this.states.get(tab.id);
    const state = known ?? this.newState(tab);
    this.states.set(tab.id, state);
    this.view.setState(state);
    this.shown = tab.id;
    this.watchMode();
    if (!known) void this.setLanguage(tab);
  }

  drop(id: string) {
    this.states.delete(id);
    this.prose.delete(id);
  }

  /** Forgets every tab, for when a whole different tab set comes on screen. */
  clear() {
    this.states.clear();
    this.shown = "";
  }

  text(): string {
    return this.view.state.doc.toString();
  }

  cursor() {
    const head = this.view.state.selection.main.head;
    const line = this.view.state.doc.lineAt(head);
    return { pos: head, line: line.number, col: head - line.from + 1 };
  }

  /** Languages load on demand. The tab may no longer be on screen by the time one arrives. */
  async setLanguage(tab: Tab) {
    const found = (tab.path || tab.state) && LanguageDescription.matchFilename(languages, title(tab));
    this.prose.set(tab.id, !found || found.name === "Markdown");
    this.apply(this.language.reconfigure(found ? await found.load() : []), tab.id);
    this.apply(this.spelling.reconfigure(this.spellAttr(tab.id)), tab.id);
  }

  private spellAttr(id: string) {
    return EditorView.contentAttributes.of({ spellcheck: String(this.settings.spellcheck && (this.prose.get(id) ?? false)) });
  }

  /** Characters in the document, and in the selection if there is one. Both are O(1). */
  count() {
    const { doc, selection } = this.view.state;
    return { chars: doc.length, selected: selection.ranges.reduce((sum, r) => sum + (r.to - r.from), 0) };
  }

  configure(settings: Settings) {
    this.settings = settings;
    this.apply(this.options.reconfigure(this.optionExtensions()));
    for (const id of this.states.keys()) this.apply(this.spelling.reconfigure(this.spellAttr(id)), id);
    this.watchMode();
  }

  /** Applies an effect to one tab's state, or to every tab's, whether or not it is on screen. */
  private apply(effects: StateEffect<unknown>, only?: string) {
    for (const [id, state] of this.states) {
      if (only && id !== only) continue;
      if (id === this.shown) this.view.dispatch({ effects });
      else this.states.set(id, state.update({ effects }).state);
    }
  }

  // Swapping state or toggling vim rebuilds the vim plugin, which starts over in normal mode
  // with no listeners.
  private watchMode() {
    const cm = getCM(this.view);
    cm?.on("vim-mode-change", (e: { mode: string; subMode?: string }) =>
      this.events.mode(e.subMode ? `${e.mode} ${e.subMode === "linewise" ? "line" : "block"}` : e.mode),
    );
    this.events.mode(cm ? "normal" : "");
  }

  private optionExtensions() {
    const s = this.settings;
    return [
      s.vim ? vim() : [],
      s.lineNumbers ? [lineNumbers(s.relativeNumbers ? { formatNumber: relative } : {}), highlightActiveLineGutter()] : [],
      s.wrap ? EditorView.lineWrapping : [],
      EditorState.tabSize.of(s.tabSize),
      indentUnit.of(" ".repeat(s.tabSize)),
    ];
  }

  private newState(tab: Tab): EditorState {
    return EditorState.create({
      doc: tab.text,
      selection: { anchor: Math.min(tab.cursor, tab.text.length) },
      extensions: [
        this.options.of(this.optionExtensions()), // first: vim has to see keys before any other keymap
        history(),
        drawSelection(),
        // Ctrl+click adds a cursor, Alt+drag selects a column, Ctrl+D takes the next occurrence.
        EditorState.allowMultipleSelections.of(true),
        rectangularSelection(),
        crosshairCursor(),
        this.spelling.of([]),
        EditorView.scrollMargins.of(() => ({ bottom: 64 })),
        placeholder("Type. slate keeps it, saved or not.   Ctrl+Shift+P lists everything it can do."),
        highlightSelectionMatches(),
        bracketMatching(),
        indentOnInput(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        this.language.of([]),
        syntaxHighlighting(ink),
        theme,
        EditorView.updateListener.of((update) => {
          if (this.settings.relativeNumbers && update.selectionSet && !update.docChanged) {
            const line = (s: EditorState) => s.doc.lineAt(s.selection.main.head).number;
            if (line(update.state) !== line(update.startState)) {
              queueMicrotask(() => this.view.dispatch({ effects: this.options.reconfigure(this.optionExtensions()) }));
            }
          }
          if (update.docChanged) this.events.edited();
          if (update.docChanged || update.selectionSet) this.events.moved();
        }),
      ],
    });
  }
}
