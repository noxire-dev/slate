export interface Settings {
  theme: "system" | "light" | "dark";
  fontFamily: string;
  /** Headings in Read and Settings. Empty means Excalifont. */
  headingFont: string;
  /** Tabs, islands, settings and reading prose. Empty means Assistant. */
  uiFont: string;
  fontSize: number;
  tabSize: number;
  lineNumbers: boolean;
  /** Line numbers counted from the cursor's line, the way vim's relativenumber does. */
  relativeNumbers: boolean;
  wrap: boolean;
  /** Underline misspellings in notes and markdown. Never in code. */
  spellcheck: boolean;
  vim: boolean;
  /** Text set in a centred column instead of from the left edge. */
  zen: boolean;
  /** Open .md files in the reading view instead of as source. */
  readMarkdown: boolean;
}

export const defaults: Settings = {
  theme: "system",
  fontFamily: "",
  headingFont: "",
  uiFont: "",
  fontSize: 14,
  tabSize: 2,
  lineNumbers: true,
  relativeNumbers: false,
  wrap: true,
  spellcheck: true,
  vim: false,
  zen: false,
  readMarkdown: false,
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

/** Anything missing, mistyped or out of range falls back to its default, so a hand-edited file can't brick the app. */
export function parseSettings(json: string | null): Settings {
  let saved: Record<string, unknown> = {};
  try {
    saved = JSON.parse(json ?? "{}") ?? {};
  } catch {}
  const out: Record<string, unknown> = { ...defaults };
  for (const [key, fallback] of Object.entries(defaults)) {
    if (typeof saved[key] === typeof fallback) out[key] = saved[key];
  }
  const settings = out as unknown as Settings;
  if (!["system", "light", "dark"].includes(settings.theme)) settings.theme = defaults.theme;
  settings.fontSize = clamp(settings.fontSize, 8, 40);
  settings.tabSize = clamp(settings.tabSize, 1, 8);
  return settings;
}
