import type { Store, TextFile } from "./store";

export interface Tab {
  id: string;
  path: string | null;
  /** Always "\n" line endings. As of the last sync from the editor. */
  text: string;
  dirty: boolean;
  cursor: number;
  crlf: boolean;
  /** How the file was encoded on disk, so it goes back the same way. */
  encoding?: string;
  /** Fingerprint of the file's content when slate last read or wrote it. */
  disk?: string;
  /** The file changed on disk while this tab held unsaved edits. */
  conflict?: boolean;
  /** Showing the rendered markdown rather than the source. */
  reading?: boolean;
  /** Queued by `slate add` and not looked at yet. */
  unread?: boolean;
  /** This tab edits one of slate's own files, not a file on disk. */
  state?: "vimrc" | "keys";
}

type SavedTab = Omit<Tab, "text"> & { text?: string };
interface Saved {
  active: string;
  tabs: SavedTab[];
}

export function title(tab: Tab): string {
  if (tab.state) return tab.state === "keys" ? "keys.json" : tab.state;
  if (tab.path) return tab.path.split(/[\\/]/).pop()!;
  // A scratch note that opens with a markdown heading is named by the heading, not by "# ...".
  const firstLine = tab.text.trimStart().split("\n", 1)[0].replace(/^#+\s*/, "").trim();
  return firstLine.slice(0, 28) || "untitled";
}

/** The open tabs and what happens to them. Survives restarts through `Store`. */
export class Session {
  tabs: Tab[] = [];
  activeId = "";
  private writing: Promise<void> = Promise.resolve();
  /** Nothing was ever saved for this tab set: its one blank tab is a placeholder, not the user's. */
  private pristine = false;

  /** `name` is the state file this tab set lives in: "session" for home, "ws-…" for a workspace. */
  constructor(private store: Store, readonly name = "session") {}

  get active(): Tab {
    return this.tabs.find((t) => t.id === this.activeId)!;
  }

  async restore(): Promise<void> {
    const json = await this.store.load(this.name);
    const saved: Saved = json ? JSON.parse(json) : { active: "", tabs: [] };
    for (const { text, ...tab } of saved.tabs) {
      if ((tab as { vimrc?: boolean }).vimrc) tab.state = "vimrc"; // saved before keys.json existed
      if (text !== undefined) this.tabs.push({ ...tab, text });
      else if (tab.path) {
        // A clean tab whose file has since vanished held nothing we could lose. Drop it.
        const onDisk = await this.store.readFile(tab.path).catch(() => null);
        if (onDisk !== null) this.tabs.push({ ...tab, ...fromDisk(onDisk) });
      }
    }
    this.pristine = !json;
    if (!this.tabs.length) this.newTab();
    this.activeId = this.tabs.some((t) => t.id === saved.active) ? saved.active : this.tabs[0].id;
  }

  /** Writes are queued so a slow one can't land after, and overwrite, a newer one. */
  persist(): Promise<void> {
    // ponytail: one JSON file holding every unsaved buffer, rewritten whole on each change.
    // Split into a file per buffer if people start keeping multi-MB scratch tabs.
    const saved: Saved = {
      active: this.activeId,
      tabs: this.tabs.map(({ text, ...tab }) => (tab.dirty || !tab.path ? { ...tab, text } : tab)),
    };
    const json = JSON.stringify(saved);
    this.writing = this.writing.catch(() => {}).then(() => this.store.save(this.name, json));
    return this.writing;
  }

  newTab(activate = true): Tab {
    const tab: Tab = { id: crypto.randomUUID(), path: null, text: "", dirty: false, cursor: 0, crlf: false };
    this.tabs.push(tab);
    if (activate) this.activeId = tab.id;
    return tab;
  }

  /** Copies a file's text into a note slate keeps. The file itself is not opened or tracked. */
  async adopt(path: string, activate = true): Promise<Tab> {
    const { text } = fromDisk(await this.store.readFile(path));
    return Object.assign(this.newTab(this.clearPlaceholder(activate)), { text });
  }

  async open(path: string, activate = true): Promise<Tab> {
    const already = this.tabs.find((t) => t.path?.toLowerCase() === path.toLowerCase());
    if (already) {
      if (activate) this.activeId = already.id;
      await this.refresh(already.id); // asked for again: show what is on disk now, not what was
      return already;
    }
    const opened = fromDisk(await this.store.readFile(path));
    return Object.assign(this.newTab(this.clearPlaceholder(activate)), { path, ...opened });
  }

  /**
   * A lone blank tab gives way to the first thing opened, like in every editor. When something is
   * queued in the background it stays, because the user may be about to type in it, unless this
   * tab set is brand new and the blank tab was never theirs. Returns whether to activate the newcomer.
   */
  private clearPlaceholder(activate: boolean): boolean {
    const blank = this.tabs.length === 1 && !this.tabs[0].path && !this.tabs[0].text;
    if (!blank || !(activate || this.pristine)) return activate;
    this.tabs = [];
    return true;
  }

  /**
   * Compares a file tab with its file. An untouched tab takes the new content; a tab with unsaved
   * edits keeps them and is marked as conflicting, so the next save asks before overwriting.
   */
  async refresh(id: string): Promise<"same" | "reloaded" | "conflict"> {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab?.path) return "same";
    const file = await this.store.readFile(tab.path).catch(() => null);
    if (!file) return "same"; // deleted or unreadable: what we hold is now the only copy, keep it
    const onDisk = fromDisk(file);
    // A tab restored from a session written before fingerprints existed has nothing to compare.
    tab.disk ??= onDisk.disk;
    if (onDisk.disk === tab.disk) return "same";
    if (tab.dirty) {
      tab.conflict = true;
      return "conflict";
    }
    Object.assign(tab, onDisk, { cursor: Math.min(tab.cursor, onDisk.text.length), conflict: false });
    return "reloaded";
  }

  /** False if the user backed out, of the save dialog or of overwriting a newer file. */
  async save(id: string, saveAs = false, to?: string): Promise<boolean> {
    const tab = this.tabs.find((t) => t.id === id)!;
    const path = to ?? ((!saveAs && tab.path) || (await this.store.pickSave(tab.path ?? `${title(tab)}.txt`)));
    if (!path) return false;
    if (path === tab.path && (await this.refresh(id)) === "conflict") {
      const overwrite = await this.store.confirm(
        `"${title(tab)}" was changed on disk by something else after slate read it. Overwrite it with your version?`,
      );
      if (!overwrite) return false;
    }
    const text = tab.crlf ? tab.text.replace(/\n/g, "\r\n") : tab.text;
    await this.store.writeFile(path, text, tab.encoding ?? "utf-8");
    Object.assign(tab, { path, dirty: false, conflict: false, disk: fingerprint(tab.text, tab.crlf) });
    return true;
  }

  /** False if the tab had unsaved text and the user chose to keep it. */
  async close(id: string): Promise<boolean> {
    const index = this.tabs.findIndex((t) => t.id === id);
    const tab = this.tabs[index];
    const losesText = tab.path ? tab.dirty : tab.text.trim() !== "";
    if (losesText && !(await this.store.confirm(`Close "${title(tab)}" and discard what you haven't saved?`))) {
      return false;
    }
    this.tabs.splice(index, 1);
    if (!this.tabs.length) this.newTab();
    else if (this.activeId === id) this.activeId = this.tabs[Math.min(index, this.tabs.length - 1)].id;
    return true;
  }
}

function fromDisk(file: TextFile): Pick<Tab, "text" | "crlf" | "encoding" | "disk"> {
  const text = file.text.replace(/\r\n/g, "\n");
  const crlf = file.text.includes("\r\n");
  return { text, crlf, encoding: file.encoding, disk: fingerprint(text, crlf) };
}

/** FNV-1a. Only ever compared with another fingerprint of the same file, so 32 bits are plenty. */
function fingerprint(text: string, crlf: boolean): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return `${text.length}:${crlf ? "crlf" : "lf"}:${hash >>> 0}`;
}
