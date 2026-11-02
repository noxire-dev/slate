import { expect, test } from "bun:test";
import { resolveLink } from "./markdown";
import { matching, resolve, type Command } from "./palette";
import { defaults, parseSettings } from "./settings";
import { HOME, parseIndex, workspaceFor, workspaceId } from "./workspaces";

test("markdown links resolve against the file they were found in", () => {
  expect(resolveLink("C:\\repo\\docs\\plan.md", "./steps/one.md#setup")).toBe("C:\\repo\\docs\\steps\\one.md");
  expect(resolveLink("C:\\repo\\docs\\plan.md", "../READ%20ME.md")).toBe("C:\\repo\\READ ME.md");
  expect(resolveLink("/home/me/notes/a.md", "b.md")).toBe("/home/me/notes/b.md");
  expect(resolveLink(null, "b.md")).toBe(null);
});

test("a damaged settings file degrades to defaults, field by field", () => {
  expect(parseSettings(null)).toEqual(defaults);
  expect(parseSettings("{not json")).toEqual(defaults);
  const parsed = parseSettings('{"vim":true,"fontSize":900,"theme":"neon","wrap":"yes","extra":1}');
  expect(parsed).toEqual({ ...defaults, vim: true, fontSize: 40 });
});


test("the command bar lists by prefix and only runs what was named exactly", () => {
  const cmd = (name: string, aliases: string[] = []): Command => ({ name, aliases, hint: "", run() {} });
  const commands = [cmd("w", ["write", "save"]), cmd("saveas"), cmd("settings"), cmd("zen", ["centered"])];
  expect(matching(commands, "").length).toBe(4);
  expect(matching(commands, "s").map((c) => c.name)).toEqual(["w", "saveas", "settings"]); // "save" is an alias of w
  expect(matching(commands, "cen").map((c) => c.name)).toEqual(["zen"]);
  expect(resolve(commands, "w notes.md")).toEqual({ command: commands[0], arg: "notes.md" });
  expect(resolve(commands, "centered")?.command.name).toBe("zen");
  expect(resolve(commands, "s/foo/bar/")).toBe(null); // vim substitute must fall through to vim
  expect(resolve(commands, "42")).toBe(null);
});

test("a workspace id is stable per folder and safe as a file name", () => {
  const id = workspaceId("C:\\Users\\me\\Projects\\My App!");
  expect(id).toMatch(/^ws-my-app-[a-z0-9]+$/);
  expect(workspaceId("c:\\users\\ME\\projects\\my app!\\")).toBe(id); // Windows paths are case-insensitive
  expect(workspaceId("D:\\other\\My App!")).not.toBe(id); // same folder name, different place
  const index = parseIndex("{broken");
  expect(index).toEqual({ current: HOME, list: [], unread: [] });
  const first = workspaceFor(index, "C:\\repo");
  expect(workspaceFor(index, "C:\\repo\\")).toBe(first);
  expect(index.list.map((w) => w.name)).toEqual(["repo"]);
  expect(parseIndex(JSON.stringify({ ...index, current: "ws-gone" })).current).toBe(HOME);
});
