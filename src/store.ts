import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { ask } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { installedMonoFonts } from "./fonts";

export interface TextFile {
  text: string;
  /** "utf-8", "utf-8-bom", "utf-16le" or "utf-16be" */
  encoding: string;
}

/** What a launch asked for: `slate [add] [--read] [--scratch] files…` */
export interface Launch {
  files: string[];
  /** Open rendered. */
  read: boolean;
  /** Copy the text into a note slate keeps, instead of opening the file. */
  scratch: boolean;
  /** Queue without taking focus; the tabs show as unread. */
  background: boolean;
  /** The project folder it belongs to, null for home. Undefined means "wherever the user is now": the picker, a drop. */
  workspace?: string | null;
}

export interface FontFamily {
  name: string;
  mono: boolean;
}

/**
 * Everything slate does to the disk or the OS. The app talks to this, never to Tauri.
 *
 * File access is granted, not assumed: the Rust side reads and writes only what the user picked,
 * dropped, named on the command line, or allowed in a prompt. A path the page makes up (a link in
 * a markdown file, a name typed after :w) raises that prompt.
 */
export interface Store {
  /** slate's own files: "settings", "workspaces", "vimrc", "keys", and one tab set per workspace ("session" is home). */
  load(name: string): Promise<string | null>;
  save(name: string, json: string): Promise<void>;
  /** Opens one of slate's own files in the app Windows opens it with. */
  openState(name: string): Promise<void>;
  /** The Windows clipboard, as text. */
  readClipboard(): Promise<string>;
  writeClipboard(text: string): Promise<void>;
  readFile(path: string): Promise<TextFile>;
  writeFile(path: string, text: string, encoding: string): Promise<void>;
  /** Changes whenever the file is rewritten; null if it is gone. Cheap enough to poll. */
  stamp(path: string): Promise<string | null>;
  pickOpen(): Promise<string[]>;
  pickSave(suggested: string): Promise<string | null>;
  confirm(message: string): Promise<boolean>;
  /** Every font family installed on this machine. */
  listFonts(): Promise<FontFamily[]>;
  /** What this process was started with ("Open with", `slate add --read plan.md`). */
  launch(): Promise<Launch>;
  /** Files dropped on the window, or handed over by a second launch. */
  onFiles(handler: (launch: Launch) => void): void;
  /** The window starts hidden; the app shows it once there is something to show. */
  showWindow(): void;
  /** Runs when the window is closing. The window waits for it. */
  onQuit(handler: () => Promise<void>): void;
  /** Closes the window, which runs the onQuit handler first. */
  quit(): void;
  minimize(): void;
  toggleMaximize(): void;
  /** Opens a web or mail link in the default app, never inside slate. */
  openExternal(url: string): void;
}

export class TauriStore implements Store {
  load = (name: string) => invoke<string | null>("load_state", { name });
  save = (name: string, json: string) => invoke<void>("save_state", { name, json });
  openState = (name: string) => invoke<void>("open_state", { name });
  // Through Rust, not navigator.clipboard: WebView2 may ask, or refuse, before letting a page read it.
  readClipboard = async () => (await readText().catch(() => "")) ?? "";
  writeClipboard = (text: string) => writeText(text);
  readFile = (path: string) => invoke<TextFile>("read_file", { path });
  writeFile = (path: string, text: string, encoding: string) => invoke<void>("write_file", { path, text, encoding });
  stamp = (path: string) => invoke<string | null>("file_stamp", { path });
  // The pickers run on the Rust side: picking a file there is what grants slate access to it.
  pickOpen = () => invoke<string[]>("pick_open");
  pickSave = (suggested: string) => invoke<string | null>("pick_save", { suggested });
  confirm = (message: string) => ask(message, { title: "slate", kind: "warning" });
  launch = () => invoke<Launch>("launch");
  showWindow = () => void getCurrentWindow().show().then(() => getCurrentWindow().setFocus());
  listFonts = () => invoke<FontFamily[]>("list_fonts");
  quit = () => void getCurrentWindow().close();
  minimize = () => void getCurrentWindow().minimize();
  toggleMaximize = () => void getCurrentWindow().toggleMaximize();
  openExternal = (url: string) => void openUrl(url);

  onFiles(handler: (launch: Launch) => void) {
    void listen<Launch>("open-files", (event) => handler(event.payload));
    void getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "drop") handler({ files: event.payload.paths, read: false, scratch: false, background: false });
    });
  }

  onQuit(handler: () => Promise<void>) {
    // A handler that throws would leave a window that can't be closed.
    void getCurrentWindow().onCloseRequested(() => handler().catch(() => {}));
  }
}

/** Stands in for the disk when the UI runs in a plain browser (`bun run dev`). */
export class BrowserStore implements Store {
  load = async (name: string) => localStorage.getItem(name);
  save = async (name: string, json: string) => localStorage.setItem(name, json);
  openState = async () => {};
  readClipboard = () => navigator.clipboard.readText();
  writeClipboard = (text: string) => navigator.clipboard.writeText(text);
  readFile = async (path: string) => ({ text: localStorage.getItem(`file:${path}`) ?? "", encoding: "utf-8" });
  stamp = async () => null;
  writeFile = async (path: string, text: string) => localStorage.setItem(`file:${path}`, text);
  pickOpen = async () => [];
  pickSave = async (suggested: string) => prompt("Save as", suggested);
  confirm = async (message: string) => confirm(message);
  launch = async () => ({ files: [], read: false, scratch: false, background: false });
  showWindow() {}
  // A browser can't enumerate fonts without a permission prompt, so it probes a list of likely ones.
  listFonts = async () => installedMonoFonts().map((name) => ({ name, mono: true }));
  quit() {}
  minimize() {}
  toggleMaximize() {}
  openExternal = (url: string) => void window.open(url, "_blank", "noopener");
  onFiles() {}
  onQuit(handler: () => Promise<void>) {
    addEventListener("beforeunload", () => void handler());
  }
}
