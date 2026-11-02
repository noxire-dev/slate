/** A workspace is a tab set of its own, keyed by a project folder. Home is the one with no folder. */
export interface Workspace {
  /** Also the name of its state file. */
  id: string;
  path: string;
  name: string;
}

export interface Index {
  /** The workspace to open on a plain launch. */
  current: string;
  list: Workspace[];
  /** Ids an agent queued something into while the user was elsewhere. Home can be one of them. */
  unread: string[];
}

/** Home keeps the state file slate always had, so nothing needs migrating. */
export const HOME = "session";

/** Stable per folder, readable in the data directory, and safe as a file name. */
export function workspaceId(path: string): string {
  const folder = path.replace(/[\\/]+$/, "");
  let hash = 0x811c9dc5;
  for (const char of folder.toLowerCase()) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  const slug = (folder.split(/[\\/]/).pop() ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `ws-${slug || "folder"}-${(hash >>> 0).toString(36)}`;
}

export function parseIndex(json: string | null): Index {
  try {
    const saved = JSON.parse(json ?? "null");
    const list = Array.isArray(saved?.list) ? saved.list.filter((w: Workspace) => w?.id && w?.path && w?.name) : [];
    const current = [HOME, ...list.map((w: Workspace) => w.id)].includes(saved?.current) ? saved.current : HOME;
    const unread = Array.isArray(saved?.unread) ? saved.unread.filter((id: unknown) => typeof id === "string") : [];
    return { current, list, unread };
  } catch {
    return { current: HOME, list: [], unread: [] };
  }
}

/** The workspace for a folder, added to the index the first time that folder is seen. */
export function workspaceFor(index: Index, path: string): Workspace {
  const id = workspaceId(path);
  let found = index.list.find((w) => w.id === id);
  if (!found) {
    found = { id, path, name: path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path };
    index.list.push(found);
  }
  return found;
}
