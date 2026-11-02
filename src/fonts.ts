// Only the browser dev build uses this. The app asks DirectWrite for the real list (list_fonts).
const candidates = [
  "Cascadia Mono", "Cascadia Code", "Consolas", "JetBrains Mono", "Fira Code", "Fira Mono",
  "Source Code Pro", "IBM Plex Mono", "Hack", "Iosevka", "Geist Mono", "Commit Mono",
  "Monaspace Neon", "Monaspace Argon", "Maple Mono", "Victor Mono", "Roboto Mono", "Ubuntu Mono",
  "Inconsolata", "DejaVu Sans Mono", "Noto Sans Mono", "Space Mono", "Anonymous Pro", "Input Mono",
  "Berkeley Mono", "MonoLisa", "Operator Mono", "Dank Mono", "Comic Mono", "SF Mono", "Menlo",
  "Lucida Console", "Courier New",
];

/** The candidates that are really installed: text set in one measures differently from the fallback. */
export function installedMonoFonts(): string[] {
  const pen = document.createElement("canvas").getContext("2d")!;
  const width = (family: string) => {
    pen.font = `72px ${family}`;
    return pen.measureText("mmmmmmmmmmlli10OQ@#").width;
  };
  // Two fallbacks, because whichever font the browser maps "monospace" to would otherwise hide.
  const fallbacks = ["monospace", "serif"];
  return candidates.filter((name) => fallbacks.some((base) => width(`"${name}", ${base}`) !== width(base)));
}
