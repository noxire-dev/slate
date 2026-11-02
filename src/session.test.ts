import { expect, test } from "bun:test";
import { Session, title } from "./session";
import type { Store } from "./store";

function fakeStore(files: Record<string, string> = {}) {
  const state = { saved: {} as Record<string, string>, files, confirmAnswer: true, confirms: 0 };
  const store: Store = {
    load: async (name) => state.saved[name] ?? null,
    save: async (name, json) => void (state.saved[name] = json),
    openState: async () => {},
    readClipboard: async () => "",
    writeClipboard: async () => {},
    readFile: async (path) => {
      if (!(path in files)) throw new Error("not found");
      return { text: files[path], encoding: "utf-8" };
    },
    stamp: async () => null,
    writeFile: async (path, text) => void (files[path] = text),
    pickOpen: async () => [],
    pickSave: async () => "C:\\picked.txt",
    confirm: async () => (state.confirms++, state.confirmAnswer),
    launch: async () => ({ files: [], read: false, scratch: false, background: false }),
    showWindow() {},
    listFonts: async () => [],
    onFiles() {},
    onQuit() {},
    quit() {},
    minimize() {},
    toggleMaximize() {},
    openExternal() {},
  };
  return { store, state };
}

test("unsaved text survives quitting without saving", async () => {
  const { store } = fakeStore({ "C:\\a.ts": "on disk" });
  const first = new Session(store);
  await first.restore();
  first.active.text = "scratch thought\nsecond line";
  first.active.dirty = true;
  const file = await first.open("C:\\a.ts");
  file.text = "edited, never saved";
  file.dirty = true;
  await first.persist();

  const second = new Session(store);
  await second.restore();
  expect(second.tabs.map((t) => t.text)).toEqual(["scratch thought\nsecond line", "edited, never saved"]);
  expect(second.active.path).toBe("C:\\a.ts");
  expect(title(second.tabs[0])).toBe("scratch thought");
  expect(title({ ...second.tabs[0], text: "## Plan for Friday\nbody" })).toBe("Plan for Friday");
});

test("clean file tabs are re-read from disk, and dropped if the file is gone", async () => {
  const { store, state } = fakeStore({ "C:\\a.txt": "v1", "C:\\b.txt": "b" });
  const first = new Session(store);
  await first.restore();
  await first.open("C:\\a.txt");
  await first.open("C:\\b.txt");
  await first.persist();
  expect(state.saved.session).not.toContain("v1");

  state.files["C:\\a.txt"] = "v2";
  delete state.files["C:\\b.txt"];
  const second = new Session(store);
  await second.restore();
  expect(second.tabs.map((t) => t.text)).toEqual(["v2"]);
  expect(second.activeId).toBe(second.tabs[0].id);
});

test("CRLF files stay CRLF on save", async () => {
  const { store, state } = fakeStore({ "C:\\w.txt": "one\r\ntwo" });
  const session = new Session(store);
  await session.restore();
  const tab = await session.open("C:\\w.txt");
  expect(tab.text).toBe("one\ntwo");
  tab.text = "one\ntwo\nthree";
  await session.save(tab.id);
  expect(state.files["C:\\w.txt"]).toBe("one\r\ntwo\r\nthree");
});

test("closing a tab with unsaved text asks first; an untitled save goes through the picker", async () => {
  const { store, state } = fakeStore();
  const session = new Session(store);
  await session.restore();
  const tab = session.active;
  tab.text = "keep me";
  state.confirmAnswer = false;
  expect(await session.close(tab.id)).toBe(false);
  expect(session.tabs).toContain(tab);

  expect(await session.save(tab.id)).toBe(true);
  expect(state.files["C:\\picked.txt"]).toBe("keep me");
  expect(await session.close(tab.id)).toBe(true);
  expect(state.confirms).toBe(1);
  expect(session.tabs.length).toBe(1); // never zero tabs
  expect(session.active.text).toBe("");
});

test("a file rewritten on disk reloads into an untouched tab, and is never silently overwritten by an edited one", async () => {
  const { store, state } = fakeStore({ "C:\\plan.md": "v1 from the agent" });
  const session = new Session(store);
  await session.restore();
  const tab = await session.open("C:\\plan.md");

  state.files["C:\\plan.md"] = "v2 from the agent";
  expect(await session.refresh(tab.id)).toBe("reloaded");
  expect(tab.text).toBe("v2 from the agent");

  tab.text = "my edit on top of v2";
  tab.dirty = true;
  state.files["C:\\plan.md"] = "v3 from the agent";
  expect(await session.refresh(tab.id)).toBe("conflict");
  expect(tab.text).toBe("my edit on top of v2"); // unsaved edits are never replaced

  state.confirmAnswer = false;
  expect(await session.save(tab.id)).toBe(false);
  expect(state.files["C:\\plan.md"]).toBe("v3 from the agent");

  state.confirmAnswer = true;
  expect(await session.save(tab.id)).toBe(true);
  expect(state.files["C:\\plan.md"]).toBe("my edit on top of v2");
  expect(await session.refresh(tab.id)).toBe("same"); // our own write is not a conflict
});

test("slate add queues a file, or a copy of its text, without moving the user off their tab", async () => {
  const { store } = fakeStore({ "C:\plan.md": "# Plan", "C:\report.md": "# Report\nfindings" });
  const session = new Session(store);
  await session.restore();
  session.active.text = "what I was typing";
  const mine = session.activeId;

  const queued = await session.open("C:\plan.md", false);
  const copied = await session.adopt("C:\report.md", false);
  expect(session.activeId).toBe(mine);
  expect(session.tabs.length).toBe(3); // the tab being typed in was not replaced as "blank"
  expect(queued.path).toBe("C:\plan.md");
  expect([copied.path, copied.text]).toEqual([null, "# Report\nfindings"]);
  expect(title(copied)).toBe("Report");
});

test("each workspace is a tab set of its own", async () => {
  const { store, state } = fakeStore({ "C:\\repo\\PLAN.md": "# Plan" });
  const home = new Session(store);
  await home.restore();
  home.active.text = "home scratch";
  await home.persist();

  const repo = new Session(store, "ws-repo-abc");
  await repo.restore();
  await repo.open("C:\\repo\\PLAN.md");
  await repo.persist();

  expect(Object.keys(state.saved).sort()).toEqual(["session", "ws-repo-abc"]);
  const homeAgain = new Session(store);
  await homeAgain.restore();
  expect(homeAgain.tabs.map((t) => t.text)).toEqual(["home scratch"]);
});
