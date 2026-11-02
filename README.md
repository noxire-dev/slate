# slate

A notepad for Windows with no network code, no account, no AI and no telemetry. It keeps every tab without asking, and it renders the markdown your coding agents write.

## What it does

- **Keeps everything.** Text is written to disk about 400 ms after you type it. Quitting never asks "save changes?", and every tab is back at the next launch, saved to a file or not.
- **Reads markdown.** Flip any tab to Read (Ctrl+E) for a rendered page with highlighted code, tables, task lists, a heading outline (Ctrl+Shift+O), find (Ctrl+F) and a copy button on code blocks. Links to other files open as tabs. Web links open in your browser.
- **Follows files that change.** When an agent rewrites a file you have open, the tab reloads on its own. If you had unsaved edits, they are kept, and saving asks before overwriting the newer file.
- **Vim keys, built in and optional.** Turn them on in Settings or with `:vim`. Mappings and `:set` lines live in a vimrc (`:vimrc`). Yanks go to the Windows clipboard.
- **A tab set per project.** Run slate from inside a git repository and it opens that repository's own tabs. Plain launches use the home set.
- **One list of everything it can do.** Ctrl+Shift+P, or `:` with vim keys on.

## Install

Run `slate_x.y.z_x64-setup.exe`. It installs for your user only and needs no administrator rights. It adds a Start menu entry, puts `slate` on your PATH, and offers itself for `.md`, `.txt` and a few other text files. Uninstalling takes all of that back out.

The installer is not code-signed yet, so Windows SmartScreen will warn. Choose "More info", then "Run anyway".

## Use it from an agent

The command line is the whole API.

| Command | What happens |
|---|---|
| `slate plan.md` | Opens the file and brings slate to the front. |
| `slate --read plan.md` | The same, rendered. |
| `slate add plan.md` | Queues the file without taking focus. The tab is marked unread. |
| `slate add --scratch notes.md` | Copies the text into a note slate keeps. The file itself is not opened. |

`add` works whether slate is running or not. If it is not, the tab is filed and waiting at the next launch.

For Claude Code, one line in `CLAUDE.md` is enough:

```
After writing a plan, report or review file, run `slate add --read <file>`.
```

## Privacy

slate makes no network requests. There is no update check, no crash reporting and no analytics. The only thing that leaves the app is a link you click, which opens in your default browser.

Your tabs, settings and vimrc live in `%LOCALAPPDATA%\dev.mirako.slate\`. Unsaved text is stored there as plain text.

slate reads and writes only files you pointed at: picked in a dialog, dropped on the window, named on the command line, or allowed in a prompt. A markdown file cannot make it open anything else.

## Build from source

You need [Bun](https://bun.sh) and [Rust](https://rustup.rs).

```
bun install
bun test
bun run tauri build
```

The installer lands in `src-tauri/target/release/bundle/nsis/`. `bun run tauri dev` runs it with live reload.

## Licence

MIT. See [LICENSE](LICENSE). The bundled fonts and libraries keep their own licences, listed in [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md).
