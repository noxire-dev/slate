import "@fontsource/assistant/400.css";
import "@fontsource/assistant/600.css";
import { getCM, Vim } from "@replit/codemirror-vim";
import { Editor, ink, languageName } from "./editor";
import { renderMarkdown, resolveLink } from "./markdown";
import { Palette, resolve, type Command } from "./palette";
import { Session, title, type Tab } from "./session";
import { parseSettings, type Settings } from "./settings";
import { BrowserStore, TauriStore, type Launch, type Store } from "./store";
import { HOME, parseIndex, workspaceFor } from "./workspaces";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const icon = (path: string) => `<svg viewBox="0 0 10 10" aria-hidden="true"><path d="${path}"/></svg>`;
const CROSS = icon("M1.5 1.5l7 7m0-7l-7 7");
const PLUS = icon("M5 1v8M1 5h8");

const store: Store = "__TAURI_INTERNALS__" in window ? new TauriStore() : new BrowserStore();
let settings = parseSettings(await store.load("settings"));
let settingsOpen = false;

// Which tab set comes up: the project slate was launched from, else home if it was handed loose
// files, else wherever the user last was.
const index = parseIndex(await store.load("workspaces").catch(() => null));
const launch: Launch = await store.launch().catch(() => ({ files: [], read: false, scratch: false, background: false }));
let session = new Session(store, launch.workspace ? workspaceFor(index, launch.workspace).id : launch.files.length ? HOME : index.current);
const editor = new Editor($("editor"), settings, {
  edited() {
    session.active.dirty = true;
    render();
    scheduleFlush();
  },
  moved: renderRule,
  mode(mode) {
    $("mode").dataset.vim = mode;
    renderRule();
  },
});

/** Pulls the editor's text into the active tab. Cheap to skip per keystroke, so it runs on flush. */
function sync() {
  session.active.text = editor.text();
  session.active.cursor = editor.cursor().pos;
}

// The whole point of slate: everything typed reaches disk on its own, shortly after it's typed.
let flushTimer = 0;
function scheduleFlush() {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush().catch(report), 400);
}
function flush() {
  clearTimeout(flushTimer);
  sync();
  render();
  return session.persist();
}

// A problem stays on screen until the user does something next. It used to be cleared by the
// very render that followed it, so a file that failed to open showed nothing at all.
let problem = "";
function report(error: unknown) {
  problem = String(error).replace(/^Error: /, "");
  renderRule();
}
for (const type of ["keydown", "mousedown"]) {
  addEventListener(type, () => problem && ((problem = ""), renderRule()), true);
}

const isMarkdown = (tab: Tab) => !tab.path || /\.(md|markdown|mdx|txt)$/i.test(tab.path);

function show(id: string) {
  session.activeId = id;
  session.active.unread = false;
  settingsOpen = false;
  editor.show(session.active);
  render();
  flip();
  scheduleFlush();
  void checkDisk();
}

const faces = [$("editor"), $("reader"), $("settings")];
const readingAt = new Map<string, number>();
$("reader").addEventListener("scroll", () => readingAt.set(session.activeId, $("reader").scrollTop));

/** Puts the right face on screen: the source, the rendered page, or settings. */
function flip() {
  const tab = session.active;
  const face = $(settingsOpen ? "settings" : tab.reading ? "reader" : "editor");
  for (const each of faces) each.hidden = each !== face;
  if (face.id !== "reader") ((outline.hidden = true), (find.hidden = true));
  if (face.id === "reader") {
    face.replaceChildren(renderMarkdown(tab.text, ink));
    face.scrollTop = readingAt.get(tab.id) ?? 0;
  }
  if (face.id === "editor") editor.view.focus();
  else if (face.id === "reader") face.focus();
  else face.querySelector<HTMLElement>("input:checked")?.focus();
  renderRule();
}

function setReading(reading: boolean) {
  const tab = session.active;
  reading &&= isMarkdown(tab);
  if (!settingsOpen && Boolean(tab.reading) === reading) return;
  sync();
  tab.reading = reading;
  settingsOpen = false;
  flip();
  scheduleFlush();
}

function toggleSettings(open = !settingsOpen) {
  settingsOpen = open;
  flip();
}

function render() {
  const tabs = session.tabs.map((tab) => {
    const el = document.createElement("div");
    el.className = `tab${tab.path ? "" : " scratch"}${tab.path && tab.dirty ? " dirty" : ""}${tab.unread ? " unread" : ""}`;
    el.role = "tab";
    el.tabIndex = 0;
    el.ariaSelected = String(tab.id === session.activeId);
    el.title = tab.path ?? "Not a file yet. slate keeps it until you close the tab.";
    el.onmousedown = (e) => {
      e.preventDefault(); // keep focus where it was
      if (e.button === 1) void closeTab(tab.id);
      else if (tab.id !== session.activeId || settingsOpen) (sync(), show(tab.id));
    };
    el.onkeydown = (e) => e.key === "Enter" && (sync(), show(tab.id));

    const mark = document.createElement("span");
    mark.className = "mark";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = title(tab);

    const close = document.createElement("button");
    close.className = "icon close";
    close.innerHTML = CROSS;
    close.ariaLabel = `Close ${title(tab)}`;
    close.onmousedown = (e) => e.stopPropagation();
    close.onclick = () => void closeTab(tab.id);

    el.append(mark, name, close);
    return el;
  });

  const add = document.createElement("button");
  add.id = "new";
  add.className = "icon";
  add.innerHTML = PLUS;
  add.ariaLabel = "New tab";
  add.title = "New tab (Ctrl+N)";
  add.onclick = newTab;

  $("tabs").replaceChildren(...tabs, add);
  $("tabs").querySelector("[aria-selected=true]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  renderRule();
}

function renderRule() {
  const tab = session.active;
  if (!tab) return;
  const writing = !settingsOpen && !tab.reading;
  const { line, col } = editor.cursor();
  $("mode").textContent = writing ? ($("mode").dataset.vim ?? "") : "";
  $("pos").textContent = writing ? `${line}:${col}` : "";
  const { chars, selected } = editor.count();
  $("count").textContent = !writing ? "" : selected ? `${selected.toLocaleString()} selected` : `${chars.toLocaleString()} chars`;
  $("where").textContent = problem;
  const saved = tab.conflict ? "Changed on disk" : tab.dirty ? "Edited" : "Saved";
  $("state").textContent = settingsOpen ? "" : tab.path ? `${saved}, ${languageName(tab)}` : "Kept";
  $("state").title = tab.path ?? "Not a file yet. slate keeps it until you close the tab.";
  for (const radio of document.querySelectorAll<HTMLInputElement>("[name=face]")) {
    radio.checked = !settingsOpen && radio.value === (tab.reading ? "read" : "write");
    radio.disabled = radio.value === "read" && !isMarkdown(tab);
  }
  $("open-settings").ariaPressed = String(settingsOpen);
}

// ---- Files that change underneath us: an agent rewriting the plan you have open ----

/** Brings the active tab up to date with its file, or flags the conflict if it has unsaved edits. */
async function checkDisk() {
  const tab = session.active;
  if (!tab.path) return;
  sync();
  const before = readingAt.get(tab.id);
  if ((await session.refresh(tab.id)) === "same" || tab !== session.active) return renderRule();
  // Reloaded or conflicting. A reload replaces the text, so the editor's copy of this tab is stale.
  if (!tab.conflict) {
    editor.drop(tab.id);
    editor.show(tab);
    if (before !== undefined) readingAt.set(tab.id, before);
    flip();
  }
  render();
}

// ponytail: polls the active tab's file stamp once a second rather than watching the filesystem.
// One stat per second is nothing; swap in a real watcher if background tabs need to stay fresh.
const stamps = new Map<string, string | null>();
setInterval(async () => {
  const tab = session.active;
  if (!tab?.path || document.hidden) return;
  const stamp = await store.stamp(tab.path).catch(() => null);
  if (stamps.has(tab.id) && stamps.get(tab.id) !== stamp) void checkDisk();
  stamps.set(tab.id, stamp);
}, 1000);
addEventListener("focus", () => (void checkDisk(), void loadKeys())); // keys.json may have been edited elsewhere

function newTab() {
  sync();
  show(session.newTab().id);
}

const openFiles = async (paths?: string[]) => receive({ files: paths ?? (await store.pickOpen()), read: false, scratch: false, background: false });

/** Opens or queues a launch's files in one tab set, which may or may not be the one on screen. */
async function fileInto(target: Session, launch: Launch) {
  const onScreen = target === session;
  const known = new Set(target.tabs);
  for (const path of launch.files) {
    const arriving = launch.scratch ? target.adopt(path, !launch.background) : target.open(path, !launch.background);
    const tab = await arriving.catch(report);
    if (!tab) continue;
    if (onScreen && known.has(tab) && !tab.dirty) editor.drop(tab.id); // it may just have been reloaded from disk
    const markdown = launch.scratch || /\.(md|markdown|mdx)$/i.test(path);
    if (launch.read || (!known.has(tab) && settings.readMarkdown && markdown)) tab.reading = true;
    if (launch.background && !(onScreen && tab.id === target.activeId)) tab.unread = true;
  }
  return known;
}

/** Takes files from anywhere: the picker, a drop, the command line, an agent running `slate add`. */
async function receive(launch: Launch) {
  const target = launch.workspace === undefined ? session.name : launch.workspace ? workspaceFor(index, launch.workspace).id : HOME;
  if (target !== session.name && launch.background) {
    // An agent queued something for another project. File it there and leave the user where they are.
    const elsewhere = new Session(store, target);
    await elsewhere.restore();
    await fileInto(elsewhere, launch);
    await elsewhere.persist();
    if (!index.unread.includes(target)) index.unread.push(target);
    return saveIndex();
  }
  if (target !== session.name) await switchTo(target);
  sync();
  const known = await fileInto(session, launch);
  // Queued in the background: the tab strip changes, and nothing else moves under the user.
  if (launch.background && known.has(session.active)) (render(), scheduleFlush());
  else show(session.activeId);
}

// ---- Workspaces: a tab set per project folder ----

function saveIndex() {
  const picker = $<HTMLSelectElement>("workspace");
  const label = (id: string, name: string) => new Option(`${index.unread.includes(id) ? "● " : ""}${name}`, id);
  picker.replaceChildren(label(HOME, "home"), ...index.list.map((w) => Object.assign(label(w.id, w.name), { title: w.path })));
  picker.value = session.name;
  picker.hidden = index.list.length === 0;
  picker.classList.toggle("unread", index.unread.length > 0);
  return store.save("workspaces", JSON.stringify(index, null, 2)).catch(report);
}

async function switchTo(id: string) {
  if (id === session.name) return;
  await flush().catch(report);
  editor.clear();
  readingAt.clear();
  stamps.clear();
  session = new Session(store, id);
  await session.restore();
  arrive();
  show(session.activeId);
}

/** The user is now looking at this workspace: it is where a plain launch returns to, and it is read. */
function arrive() {
  index.current = session.name;
  index.unread = index.unread.filter((id) => id !== session.name);
  void saveIndex();
}
$<HTMLSelectElement>("workspace").onchange = (e) => void switchTo((e.target as HTMLSelectElement).value);

async function save(saveAs = false, to?: string) {
  sync();
  const tab = session.active;
  if (tab.state) {
    await store.save(tab.state, tab.text);
    tab.dirty = false;
    await (tab.state === "vimrc" ? applyVimrc() : loadKeys());
    if (!problem) report(`${title(tab)} saved and applied.`);
    return flush();
  }
  if (!(await session.save(tab.id, saveAs, to))) return;
  void editor.setLanguage(tab);
  await flush();
}

async function closeTab(id: string) {
  sync();
  const last = session.tabs.length === 1;
  if (!(await session.close(id))) return flip();
  editor.drop(id);
  readingAt.delete(id);
  show(session.activeId);
  // Closing the last card closes the window, as it does in Notepad and every browser.
  if (last) store.quit();
}

/** `:q`. On the last card it just leaves; the text is kept either way, so there is nothing to ask. */
function quitCard() {
  if (session.tabs.length === 1) store.quit();
  else void closeTab(session.activeId);
}

/** Ctrl+1 to Ctrl+8 pick a tab by position; Ctrl+9 is always the last one, as in browsers. */
function goToTab(n: number) {
  const target = n === 9 ? session.tabs.at(-1) : session.tabs[n - 1];
  if (target && (target !== session.active || settingsOpen)) (sync(), show(target.id));
}

/** Text size, for writing and reading alike. 0 puts it back to the default. */
function zoom(step: number) {
  change({ fontSize: step ? settings.fontSize + step : 14 });
}
// The webview would zoom the whole window, chrome included. Only the text should grow.
addEventListener("wheel", (e) => e.ctrlKey && (e.preventDefault(), zoom(e.deltaY < 0 ? 1 : -1)), { passive: false });

function cycle(step: number) {
  const { tabs } = session;
  const next = tabs[(tabs.indexOf(session.active) + step + tabs.length) % tabs.length];
  if (next !== session.active) (sync(), show(next.id));
}

// ---- Settings ----

function applySettings() {
  const root = document.documentElement.style;
  root.colorScheme = settings.theme === "system" ? "light dark" : settings.theme;
  // Each chosen font goes in front of the stylesheet's own stack, which stays as the fallback.
  const stacks = {
    "--mono": [settings.fontFamily, '"Cascadia Mono", Consolas, monospace'],
    "--hand": [settings.headingFont, '"Excalifont", "Segoe Print", cursive'],
    "--ui": [settings.uiFont, '"Assistant", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif'],
  };
  for (const [token, [chosen, fallback]] of Object.entries(stacks)) {
    const font = chosen.replace(/["\\;{}]/g, "").trim();
    if (font) root.setProperty(token, `"${font}", ${fallback}`);
    else root.removeProperty(token);
  }
  root.setProperty("--size", `${settings.fontSize}px`);
  document.body.classList.toggle("zen", settings.zen);
}

const form = $<HTMLFormElement>("settings-form");
async function fillForm() {
  const fonts = await store.listFonts().catch(() => []);
  for (const picker of form.querySelectorAll<HTMLSelectElement>("select")) {
    const group = (label: string, names: string[]) => {
      const el = Object.assign(document.createElement("optgroup"), { label });
      el.append(...names.map((name) => new Option(name, name)));
      return el;
    };
    // Nerd Font builds with double-width icons don't flag themselves monospace, so the name counts too.
    const isMono = (f: { name: string; mono: boolean }) => f.mono || /mono|code|consol|courier|nerd font|\bNF[MP]?\b/i.test(f.name);
    const mono = fonts.filter(isMono).map((f) => f.name);
    const rest = fonts.filter((f) => !isMono(f)).map((f) => f.name);
    // Whatever is already chosen stays pickable, even a font that has since been uninstalled.
    const chosen = settings[picker.name as "fontFamily" | "headingFont" | "uiFont"];
    const missing = chosen && !fonts.some((f) => f.name === chosen) ? [new Option(chosen, chosen)] : [];
    picker.replaceChildren(
      new Option(`Default (${picker.dataset.default})`, ""),
      ...missing,
      // The writing font leads with monospace; the other two are usually proportional.
      ...(picker.name === "fontFamily" ? [group("Monospace", mono), group("Everything else", rest)] : [group("Proportional", rest), group("Monospace", mono)]),
    );
  }
  for (const [key, value] of Object.entries(settings)) {
    const field = form.elements.namedItem(key);
    if (field instanceof RadioNodeList) field.value = String(value);
    else if (field instanceof HTMLInputElement && field.type === "checkbox") field.checked = Boolean(value);
    else if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) field.value = String(value);
  }
}
form.addEventListener("input", () => {
  const read: Record<string, unknown> = {};
  for (const key of Object.keys(settings)) {
    const field = form.elements.namedItem(key);
    if (field instanceof RadioNodeList || field instanceof HTMLSelectElement) read[key] = field.value;
    else if (field instanceof HTMLInputElement) {
      read[key] = field.type === "checkbox" ? field.checked : field.type === "number" ? field.valueAsNumber || undefined : field.value;
    }
  }
  change(read, false);
});

/** The one way settings change, whether from the Settings face or from a command. */
function change(patch: Partial<Settings> | Record<string, unknown>, refill = true) {
  const vimWasOn = settings.vim;
  settings = parseSettings(JSON.stringify({ ...settings, ...patch }));
  applySettings();
  editor.configure(settings);
  if (settings.vim && !vimWasOn) void applyVimrc();
  editor.view.requestMeasure();
  if (refill) void fillForm(); // not while the form itself is the source: it would pull the control out from under the user
  void store.save("settings", JSON.stringify(settings, null, 2)).catch(report);
}
form.addEventListener("submit", (e) => e.preventDefault());

// ---- The reading face ----

const reader = $("reader");
function follow(e: MouseEvent) {
  const link = (e.target as Element).closest("a");
  if (!link) return;
  e.preventDefault(); // a link must never navigate the app itself away
  const href = link.getAttribute("href") ?? "";
  if (href.startsWith("#")) document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView();
  else if (/^(https?|mailto):/i.test(href)) store.openExternal(href);
  else {
    const path = resolveLink(session.active.path, href);
    if (path) void openFiles([path]);
  }
}
reader.addEventListener("click", (e) => {
  const copy = (e.target as Element).closest?.("button.copy");
  if (!copy) return follow(e);
  const code = copy.parentElement?.querySelector("code")?.textContent ?? "";
  void navigator.clipboard.writeText(code).then(() => {
    copy.textContent = "Copied";
    copy.classList.add("done");
    setTimeout(() => ((copy.textContent = "Copy"), copy.classList.remove("done")), 1200);
  });
});
reader.addEventListener("auxclick", follow);
reader.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const page = reader.clientHeight;
  const moves: Record<string, number> = { j: 60, k: -60, d: page / 2, u: -page / 2, " ": page * 0.9, g: -1e9, G: 1e9 };
  if (e.key in moves) (e.preventDefault(), reader.scrollBy({ top: moves[e.key] }));
  else if (e.key === "/") (e.preventDefault(), openFind());
  else if (e.key === "n" || e.key === "N") (e.preventDefault(), stepFind(e.key === "n" ? 1 : -1));
  else if (["Escape", "e", "i"].includes(e.key)) (e.preventDefault(), setReading(false));
});

// ---- Outline: the headings of the page being read, as an island you can jump from ----

const outline = $("outline");
function toggleOutline(open = outline.hidden) {
  const tab = session.active;
  if (!open || settingsOpen || !tab.reading) return void (outline.hidden = true);
  const headings = [...reader.querySelectorAll<HTMLHeadingElement>("h1, h2, h3, h4, h5, h6")];
  outline.replaceChildren(
    ...(headings.length
      ? headings.map((h) => {
          const a = document.createElement("a");
          a.href = "#" + h.id;
          a.dataset.level = h.tagName[1];
          a.textContent = h.textContent ?? "";
          return a;
        })
      : [Object.assign(document.createElement("p"), { textContent: "No headings in this page." })]),
  );
  outline.hidden = false;
  markCurrentHeading();
  outline.querySelector<HTMLElement>("a[aria-current='true'], a")?.focus();
}
outline.addEventListener("click", (e) => {
  const a = (e.target as Element).closest("a");
  if (!a) return;
  e.preventDefault();
  document.getElementById(decodeURIComponent(a.getAttribute("href")!.slice(1)))?.scrollIntoView({ block: "start" });
  reader.focus();
  markCurrentHeading();
});
outline.addEventListener("keydown", (e) => {
  const links = [...outline.querySelectorAll<HTMLAnchorElement>("a")];
  const at = links.indexOf(document.activeElement as HTMLAnchorElement);
  if (e.key === "ArrowDown" || e.key === "j") (e.preventDefault(), links[Math.min(at + 1, links.length - 1)]?.focus());
  else if (e.key === "ArrowUp" || e.key === "k") (e.preventDefault(), links[Math.max(at - 1, 0)]?.focus());
  else if (e.key === "Escape") (e.preventDefault(), toggleOutline(false), reader.focus());
});
/** The heading last scrolled past is the current one. */
function markCurrentHeading() {
  if (outline.hidden) return;
  // The last heading that has reached the top of the view. Before any has, the first one; at
  // the very bottom, the last one, since a short final section can never scroll to the top.
  const headings = [...reader.querySelectorAll("h1, h2, h3, h4, h5, h6")];
  const top = reader.getBoundingClientRect().top + 80;
  const atBottom = reader.scrollTop + reader.clientHeight >= reader.scrollHeight - 2;
  let current: Element | null = atBottom ? headings.at(-1) ?? null : headings[0] ?? null;
  if (!atBottom) for (const h of headings) if (h.getBoundingClientRect().top <= top) current = h;
  for (const a of outline.querySelectorAll("a")) a.ariaCurrent = String(current !== null && a.getAttribute("href") === "#" + current.id);
}
reader.addEventListener("scroll", markCurrentHeading);

// ---- Find in the Read face. The editor has CodeMirror's own; this one marks matches in the page. ----

const find = $("find");
const findInput = find.querySelector("input")!;
let matches: HTMLElement[] = [];
let matchAt = -1;
function openFind() {
  if (settingsOpen || !session.active.reading) return;
  find.hidden = false;
  findInput.select();
}
function closeFind() {
  find.hidden = true;
  clearMatches();
  reader.focus();
}
function clearMatches() {
  for (const m of matches) m.replaceWith(...m.childNodes);
  reader.normalize();
  matches = [];
  matchAt = -1;
  find.querySelector(".count")!.textContent = "";
}
/** Wraps every case-insensitive occurrence in the page's text nodes in <mark>. Plain text only, never inside <pre>'s buttons. */
function runFind() {
  clearMatches();
  const needle = findInput.value.trim().toLowerCase();
  if (!needle) return;
  const walker = document.createTreeWalker(reader, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest("button") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const texts: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
  for (const text of texts) {
    let hay = text.data.toLowerCase();
    let node: Text = text;
    let from = hay.indexOf(needle);
    while (from >= 0) {
      const hit = node.splitText(from);
      const rest = hit.splitText(needle.length);
      const mark = document.createElement("mark");
      hit.replaceWith(mark);
      mark.append(hit);
      matches.push(mark);
      node = rest;
      hay = node.data.toLowerCase();
      from = hay.indexOf(needle);
    }
  }
  stepFind(1);
}
function stepFind(dir: number) {
  if (find.hidden && findInput.value.trim()) (find.hidden = false), runFind();
  if (!matches.length) return void (find.querySelector(".count")!.textContent = findInput.value.trim() ? "0" : "");
  matches[matchAt]?.classList.remove("current");
  matchAt = (matchAt + dir + matches.length) % matches.length;
  matches[matchAt].classList.add("current");
  matches[matchAt].scrollIntoView({ block: "center" });
  find.querySelector(".count")!.textContent = `${matchAt + 1}/${matches.length}`;
}
findInput.addEventListener("input", runFind);
findInput.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Enter") (e.preventDefault(), stepFind(e.shiftKey ? -1 : 1));
  else if (e.key === "Escape") (e.preventDefault(), closeFind());
});
for (const b of find.querySelectorAll<HTMLButtonElement>("button")) b.onclick = () => stepFind(Number(b.dataset.dir));

// ---- Chrome ----

$("minimize").onclick = () => store.minimize();
$("maximize").onclick = () => store.toggleMaximize();
$("quit").onclick = () => store.quit();
$("open-settings").onclick = () => toggleSettings();
for (const radio of document.querySelectorAll<HTMLInputElement>("[name=face]")) {
  radio.onchange = () => setReading(radio.value === "read");
}

// These win over vim's own Ctrl+O / Ctrl+N / Ctrl+W. In a notepad, Ctrl+S has to mean save.
const vimOwns = new Set(["ctrl+w", "ctrl+o", "ctrl+n", "ctrl+t", "ctrl+e"]);
const shortcuts: Record<string, () => unknown> = {
  "ctrl+s": () => save().catch(report),
  "ctrl+shift+s": () => save(true).catch(report),
  "ctrl+o": () => openFiles(),
  "ctrl+n": newTab,
  "ctrl+t": newTab,
  "ctrl+w": () => closeTab(session.activeId),
  "ctrl+tab": () => cycle(1),
  "ctrl+shift+tab": () => cycle(-1),
  "ctrl+e": () => setReading(settingsOpen ? Boolean(session.active.reading) : !session.active.reading),
  "ctrl+,": () => toggleSettings(),
  "ctrl+shift+o": () => toggleOutline(),
  "ctrl+=": () => zoom(1),
  "ctrl+shift++": () => zoom(1),
  "ctrl+-": () => zoom(-1),
  "ctrl+0": () => zoom(0),
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`ctrl+${n}`, () => goToTab(n)])),
  "ctrl+shift+p": () => palette.open(),
  f1: () => palette.open(),
  // Ctrl+C and Ctrl+V are vim's with Vim keys on. These work in every mode, as in a terminal.
  "ctrl+shift+c": copy,
  "ctrl+shift+v": paste,
};

// keys.json: "ctrl+shift+c": "copy" binds a key to a command (with its argument after a space),
// "" frees a key for vim or the webview. It wins over the defaults above, vim's keys included.
let userKeys: Record<string, string> = {};
const KEYS_STARTER = JSON.stringify(
  {
    "//": 'Key: command. Commands are the names in Ctrl+Shift+P, with an argument after a space. "" frees a key. Saved keys apply at once.',
    "ctrl+shift+c": "copy",
    "ctrl+shift+v": "paste",
  },
  null,
  2,
);
async function loadKeys() {
  const text = await store.load("keys").catch(() => null);
  try {
    const parsed: unknown = JSON.parse(text ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("it should be one { } object");
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith("//")) continue;
      if (typeof value !== "string" || (value && !resolve(commands, value))) throw new Error(`no command called "${value}" for ${key}`);
      next[key.toLowerCase().replace(/\s/g, "")] = value;
    }
    userKeys = next;
  } catch (error) {
    report(`keys.json: ${String(error).replace(/^(Syntax)?Error: /, "")}`);
  }
}

/** keys.json opens as a tab, or in whatever Windows opens .json with. */
async function openKeys(where: string) {
  let text = await store.load("keys").catch(() => null);
  if (text === null) await store.save("keys", (text = KEYS_STARTER));
  if (where === "editor") return store.openState("keys").catch(report);
  const tab = session.tabs.find((t) => t.state === "keys") ?? Object.assign(session.newTab(), { state: "keys" as const, text });
  show(tab.id);
}
$("keys-here").onclick = () => void openKeys("");
$("keys-out").onclick = () => void openKeys("editor");

const typingIn = (e: Event) => (e.target as Element).closest?.("input, select");

async function copy() {
  const { state } = editor.view;
  const text =
    settingsOpen || session.active.reading
      ? String(getSelection() ?? "")
      : state.selection.ranges.map((r) => state.sliceDoc(r.from, r.to)).filter(Boolean).join("\n");
  if (text) await store.writeClipboard(text).catch(report);
}

async function paste() {
  if (settingsOpen || session.active.reading) return;
  const text = (await store.readClipboard().catch(() => "")).replace(/\r\n?/g, "\n");
  if (!text) return;
  editor.view.dispatch(editor.view.state.replaceSelection(text), { scrollIntoView: true, userEvent: "input.paste" });
  editor.view.focus();
}

// The webview's own menu (Back, Refresh, Save as, Print) has no business here. Where text can be
// selected or typed, the menu stays, because that is where Copy and Paste live.
addEventListener("contextmenu", (e) => {
  const typing = (e.target as Element).closest?.(".cm-content, input, select");
  if (!typing && getSelection()?.isCollapsed !== false) e.preventDefault();
});

addEventListener(
  "keydown",
  (e) => {
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "f" && !settingsOpen && session.active.reading) {
      e.preventDefault();
      return openFind();
    }
    // F5 and Ctrl+R would reload the page and throw away every tab's undo history. With vim keys
    // on, Ctrl+R inside the editor is redo, and vim cancels the reload itself.
    const reload = e.key === "F5" || (e.ctrlKey && e.key.toLowerCase() === "r");
    if (reload && !(settings.vim && (e.target as Element).closest?.(".cm-editor"))) return e.preventDefault();
    const combo = `${e.ctrlKey ? "ctrl+" : ""}${e.shiftKey ? "shift+" : ""}${e.key.toLowerCase()}`;
    const bound = e.altKey ? undefined : userKeys[combo];
    if (bound === "") return;
    if (bound) {
      const found = resolve(commands, bound);
      if (!found || ((found.command.name === "copy" || found.command.name === "paste") && typingIn(e))) return;
      e.preventDefault();
      e.stopPropagation();
      return void found.command.run(found.arg);
    }
    // In the command bar, find box and settings fields, copy and paste stay the webview's own.
    if ((combo === "ctrl+shift+c" || combo === "ctrl+shift+v") && typingIn(e)) return;
    // With Vim keys on, these mean delete-word, jump back, complete, indent and scroll. :q :e
    // :new and :md do what the shortcuts did, so inside the editor vim keeps its keys.
    if (settings.vim && vimOwns.has(combo) && (e.target as Element).closest?.(".cm-editor")) return;
    const action = (!e.altKey && shortcuts[combo]) || (settingsOpen && e.key === "Escape" && (() => toggleSettings(false)));
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    action();
  },
  true,
);

// ---- Commands: one table behind the command bar, the vim ":" line and the ex commands ----

/** A path typed after :e or :w, taken relative to the file in the active tab. Absolute paths pass through. */
const typedPath = (arg: string) => (arg ? (/^([a-z]:[\\/]|[\\/])/i.test(arg) ? arg : resolveLink(session.active.path, arg)) : null);
const onOff = (on: boolean) => (on ? "on" : "off");

const commands: Command[] = [
  { name: "w", aliases: ["write", "save"], hint: "Save to a file", keys: "Ctrl S", run: (arg) => save(false, typedPath(arg) ?? undefined).catch(report) },
  { name: "saveas", hint: "Save under a new name", keys: "Ctrl Shift S", run: () => save(true).catch(report) },
  { name: "e", aliases: ["edit", "open"], hint: "Open a file", keys: "Ctrl O", run: (arg) => openFiles(typedPath(arg) ? [typedPath(arg)!] : undefined) },
  { name: "new", aliases: ["tabnew"], hint: "New tab", keys: "Ctrl N", run: newTab },
  { name: "q", aliases: ["quit", "close"], hint: "Close this tab", keys: "Ctrl W", run: quitCard },
  { name: "wq", aliases: ["x"], hint: "Save, then close this tab", run: () => save().then(quitCard, report) },
  { name: "qa", aliases: ["qall", "exit"], hint: "Quit slate. Every tab is kept.", run: () => store.quit() },
  { name: "md", aliases: ["read"], hint: "Flip between Write and Read", keys: "Ctrl E", run: () => setReading(settingsOpen ? Boolean(session.active.reading) : !session.active.reading) },
  { name: "zen", aliases: ["centered", "center"], hint: "Centre the text in a column", run: () => change({ zen: !settings.zen }) },
  { name: "vim", hint: "Turn Vim keys on or off", run: () => (change({ vim: !settings.vim }), report(`Vim keys are ${onOff(settings.vim)}.`)) },
  { name: "wrap", hint: "Wrap long lines, or don't", run: () => change({ wrap: !settings.wrap }) },
  { name: "numbers", aliases: ["nu"], hint: "Show or hide line numbers", run: () => change({ lineNumbers: !settings.lineNumbers }) },
  { name: "copy", aliases: ["yank"], hint: "Copy the selection to the Windows clipboard", keys: "Ctrl Shift C", run: copy },
  { name: "paste", hint: "Paste from the Windows clipboard", keys: "Ctrl Shift V", run: paste },
  { name: "keys", hint: "Rebind shortcuts in keys.json. keys editor opens it in your own editor", run: (arg) => openKeys(arg) },
  { name: "vimrc", hint: "Open your vimrc: mappings and :set lines that run at every start", run: () => void openVimrc() },
  {
    name: "ws",
    aliases: ["workspace"],
    hint: "Switch project: ws home, ws <name>",
    run(arg) {
      const wanted = arg.toLowerCase();
      const found = wanted === "home" ? HOME : index.list.find((w) => wanted && w.name.toLowerCase().startsWith(wanted))?.id;
      if (found) void switchTo(found);
      else report(index.list.length ? `Workspaces: home, ${index.list.map((w) => w.name).join(", ")}` : "No workspaces yet. Run slate from inside a git repository to start one.");
    },
  },
  { name: "outline", aliases: ["toc", "headings"], hint: "Headings of the page you are reading", keys: "Ctrl Shift O", run: () => toggleOutline(true) },
  { name: "find", hint: "Find in the page", keys: "Ctrl F", run: () => (session.active.reading ? openFind() : editor.view.focus()) },
  { name: "settings", hint: "Fonts, theme and the rest", keys: "Ctrl ,", run: () => toggleSettings(true) },
];

function focusFace() {
  if (settingsOpen) return;
  if (session.active.reading) $("reader").focus();
  else editor.view.focus();
}

const palette = new Palette($("palette"), commands, {
  vim: () => settings.vim,
  closed: focusFace,
  // Not one of ours. With Vim keys on it may well be one of vim's: :s/a/b/, :42, :sort, :noh.
  fallback(input) {
    const cm = settings.vim && getCM(editor.view);
    if (cm) Vim.handleEx(cm as Parameters<typeof Vim.handleEx>[0], input); // the library types getCM and handleEx inconsistently
    else report(`No command called "${input.trim().split(/\s/)[0]}". Ctrl+Shift+P lists them all.`);
  },
});

// In normal mode ":" opens the command bar instead of vim's bare prompt. Visual mode keeps vim's
// own, because it pre-fills the '<,'> range. The ex definitions make every command reachable
// from there, and from user mappings, too.
Vim.defineAction("slateCommands", () => palette.open());

// ---- Vim extras: clipboard, :set options, and a vimrc ----

// Yanks reach the Windows clipboard, and "* means the same as "+. With clipboard=unnamedplus (the
// default here, since copying into an agent's terminal is what this app is for) the unnamed
// register mirrors to the clipboard too; :set clipboard= turns that off.
Vim.defineOption("clipboard", "unnamedplus", "string", ["cb"]);
{
  const registers = Vim.getRegisterController() as unknown as { pushText: (...args: unknown[]) => void };
  const push = registers.pushText.bind(registers);
  registers.pushText = (name: unknown, operator: unknown, text: unknown, ...rest: unknown[]) => {
    const aliased = name === "*" ? "+" : name;
    push(aliased, operator, text, ...rest);
    const mirror = aliased === "+" || (!aliased && clipboardIsUnnamed());
    if (mirror && typeof text === "string") void store.writeClipboard(text).catch(() => {});
  };
}
function clipboardIsUnnamed() {
  return String(Vim.getOption("clipboard") ?? "").includes("unnamed");
}
// p and P read the Windows clipboard, so text copied in another app pastes. Text slate yanked itself
// keeps its register's shape (a yy pastes as a line); text from elsewhere is a line if it ends in one.
type Actions = { continuePaste(cm: unknown, args: unknown, vim: unknown, text: string, register: unknown): void };
type Register = { toString(): string; linewise?: boolean; blockwise?: boolean };
Vim.defineAction("paste", function (this: Actions, cm: unknown, args: { registerName?: string }, vim: unknown) {
  const registers = Vim.getRegisterController() as unknown as { getRegister(name?: string): Register };
  const name = args.registerName === "*" ? "+" : args.registerName;
  const register = registers.getRegister(name);
  if (name !== "+" && (name || !clipboardIsUnnamed())) return this.continuePaste(cm, args, vim, register.toString(), register);
  void store.readClipboard().then(
    (text) => {
      if (!text || text === register.toString()) this.continuePaste(cm, args, vim, register.toString(), register);
      else this.continuePaste(cm, args, vim, text.replace(/\r\n?/g, "\n"), { linewise: text.endsWith("\n"), blockwise: false });
    },
    () => this.continuePaste(cm, args, vim, register.toString(), register),
  );
} as unknown as Parameters<typeof Vim.defineAction>[1]);
const boolOption = (name: string, aliases: string[], key: "relativeNumbers" | "lineNumbers" | "wrap") =>
  Vim.defineOption(name, settings[key], "boolean", aliases, (on?: boolean) => {
    if (on === undefined) return settings[key];
    if (on !== settings[key]) change({ [key]: on });
  });
boolOption("relativenumber", ["rnu"], "relativeNumbers");
boolOption("number", ["nu"], "lineNumbers");
boolOption("wrap", [], "wrap");

const VIMRC_STARTER = [
  '" slate runs each line of this file through vim\'s ":" at every start.',
  '" Mappings, options, and slate\'s own commands all work here. Lines starting with " are comments.',
  '"',
  '" imap jk <Esc>',
  '" nmap H ^',
  '" nmap L $',
  '" set relativenumber',
  '" set clipboard=',
  "",
].join("\n");

/** Runs the vimrc through vim's ex line, one line at a time. A bad line is reported, not fatal. */
async function applyVimrc() {
  const cm = settings.vim && getCM(editor.view);
  if (!cm) return;
  const text = (await store.load("vimrc").catch(() => null)) ?? "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('"')) continue;
    try {
      Vim.handleEx(cm as Parameters<typeof Vim.handleEx>[0], line);
    } catch (error) {
      report(`vimrc: ${line}: ${String(error).replace(/^Error: /, "")}`);
    }
  }
}

/** The vimrc is edited in slate itself, as a tab whose save writes the state file and re-applies it. */
async function openVimrc() {
  const text = (await store.load("vimrc").catch(() => null)) ?? VIMRC_STARTER;
  const tab = session.tabs.find((t) => t.state === "vimrc") ?? Object.assign(session.newTab(), { state: "vimrc" as const, text });
  show(tab.id);
}
Vim.mapCommand(":", "action", "slateCommands", {}, { context: "normal" });
for (const command of commands) {
  for (const name of [command.name, ...(command.aliases ?? [])]) {
    Vim.defineEx(name, name, (_cm: unknown, params: { argString?: string }) => void command.run(params.argString?.trim() ?? ""));
  }
}

applySettings();
void fillForm();
await session.restore();
show(session.activeId);
await receive(launch);
store.onQuit(flush);
void applyVimrc();
void loadKeys();

// `slate add` with nothing running: file the tabs and leave without ever showing a window.
// Unless someone opens slate for real in that moment, in which case stay.
let leaving = launch.background;
store.onFiles((next) => {
  if (!next.background && leaving) ((leaving = false), store.showWindow());
  void receive(next);
});
if (leaving) {
  // Filed unseen. If that wasn't the workspace the user will come back to, flag it on the switcher.
  if (session.name !== index.current && !index.unread.includes(session.name)) index.unread.push(session.name);
  await Promise.all([flush(), saveIndex()]).catch(() => {});
  store.quit();
} else {
  arrive();
  store.showWindow();
}
