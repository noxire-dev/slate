# Loose ends

From a six-seat adversarial review on 2026-09-20: a Windows Notepad loyalist, a Notepad++ power user, a fan of the Notepads Store app, a vim purist, an AI-agent developer (the target user) and a security-minded stranger. Each read the code, researched the competitor's current features, and argued for staying put. All six said they would not switch today.

## The finding that matters most

"Close without saving and it's all still there" is not a differentiator. Windows Notepad has done it by default since 11.2307 (2023), Notepad++ since v6.6. Every seat said so independently.

What survived every seat: slate has no network code, no account, no AI and no telemetry; it has the best markdown reader of the four for agent output (fenced code with highlighting, tables, task lists, relative links opening as tabs, sanitised, no tracking pixels); vim keys and syntax highlighting are built in; and its session writes are safer than the competition's (write-then-rename, corrupt file moved aside, single instance owns the file).

The strongest honest pitch the council produced: "slate is a notepad with no network code, no account, no AI and no telemetry that keeps every tab without asking and renders the markdown your agents write." Do not call it a Notepad++ alternative; its real competitor is Windows Notepad.

## Bugs (not product choices)

Ticked items are fixed and were checked on the real exe on 2026-09-20: the session moved from Roaming to Local with its three tabs intact, a file rewritten on disk re-rendered in Read within three seconds, a UTF-16 file opened, and a file that is not text left its error on screen. The context-menu and reload-key fix is in, but nobody has right-clicked the real window yet.

- [x] **A file that fails to open shows nothing at all.** `openFiles` reports the error, then `show()` → `renderRule()` clears it in the same tick. Four seats traced this. Windows PowerShell 5.1 `>` and `.reg` exports are UTF-16, so a stranger's first drag-and-drop is often exactly this.
- [x] **slate never notices a file changed on disk, and Ctrl+S then overwrites the newer version.** No watcher; `Session.open` returns the existing tab without re-reading; `Session.save` writes blind. For the target user (agents rewriting PLAN.md) this is the reason to close slate within the hour.
- [x] **Unsaved text, including pasted secrets, sits in Roaming `%APPDATA%`**, which syncs on domain profiles and gets swept up by backup tools. Notepad keeps its equivalent under `%LOCALAPPDATA%`.
- [x] **Read view jumps to the top on every tab switch** (`flip()` sets `scrollTop = 0`).
- [x] **Right-click shows WebView2's browser menu** (Back, Refresh, Save as, Print) and F5 / Ctrl+R outside the editor reloads the app, dropping undo history. Unverified by the seat; it did not launch slate.
- [ ] Typing in the last 400 ms before a hard kill is lost, with no sign on relaunch. Same weakness as everyone else, but slate's pitch invites the comparison.

## Cheap, and worth doing

- [x] Open UTF-16 and BOM-marked files (detect BOM, decode, keep encoding on save). Code pages and a picker are costly; this is not.
- [x] Vim on: let vim own Ctrl+W, Ctrl+O, Ctrl+N, Ctrl+T while the editor has focus. Insert-mode Ctrl+W (delete word) currently closes the tab, and on the last tab quits the app. `:q`, `:e`, `:tabnew` already cover those actions. Done 2026-09-20, plus Ctrl+E; not yet tried by hand in the real window.
- [x] Ctrl+Shift+V is "paste as plain text" almost everywhere, and "paste" in Windows Terminal. In slate it flips to Read, so a stranger's first paste makes their text vanish. Move the Read toggle. Done 2026-09-20: the toggle is Ctrl+E, as in Obsidian.
- [x] A `vimrc` file beside `settings.json` (2026-09-29): `:vimrc` opens it as a tab, `:w` saves and re-applies it, every line runs through vim's ex at start and when Vim keys are turned on. Checked in the browser build: `imap jk <Esc>` and `set rnu` from the file both took effect.
- [x] Vim yank to the Windows clipboard (2026-09-29): `clipboard=unnamedplus` by default, `:set clipboard=` turns the mirroring off, `"*` is an alias of `"+`. Checked in the browser build.
- [x] Clipboard both ways (2026-11-02): vim `p`/`P` read the Windows clipboard (through the Rust clipboard plugin, not `navigator.clipboard`), Ctrl+Shift+C / Ctrl+Shift+V copy and paste in any mode, and `keys.json` (`:keys`, `:keys editor`, two buttons in Settings) rebinds any shortcut to a command. Typechecked and `cargo check`ed only; not run in the real window.
- [x] `:e path` and `:w name` use their arguments (relative to the active file).
- [x] Relative line numbers (2026-09-29): a Settings toggle and `:set rnu` / `:set nornu`; `:set nu` and `:set wrap` map to their settings too.
- [x] A command bar (`:` with Vim keys on, Ctrl+Shift+P or F1 for everyone) that lists every command with its shortcut. `:vim`, `:zen` / `:centered`, `:wrap`, `:numbers` added. Checked in the browser build only: keyboard input cannot be sent to the real window without taking focus.
- [x] Column selection and multiple cursors (2026-10-02): Ctrl+click adds a cursor, Alt+drag selects a column, Ctrl+D takes the next occurrence. Typechecked only; not yet tried by hand.
- [x] Zoom (Ctrl +/-/0 and Ctrl+wheel change the text size, for reading too), Ctrl+1-9 tab switching, a character count in the status island (selection length when there is one), spellcheck for notes and markdown with a Settings toggle. Typechecked only (2026-10-02): the browser automation broke and slate was open, so none of it has been run. Whether WebView2 draws the squiggles is unknown.
- [x] Read view (2026-09-29): a Copy button on every code block (added after sanitising, so a <button> in the document is still stripped), an outline island (Ctrl+Shift+O, `:outline`, j/k to move, tracks the heading you are on), and find (Ctrl+F or `/`, n/N and Enter/Shift+Enter to step, matches marked in the page). Checked in the browser build; scroll-driven heading tracking was only checked with a synthetic scroll event because the automation tab was hidden.
- [ ] Read view: `file.ts:123` links and `slate file:line` from the terminal, always-on-top.
- [x] README, LICENSE (MIT, owner's call: open source, sold on the Store, donations), privacy section in the README, and THIRD-PARTY-LICENSES.md with the full OFL text for Excalifont and Assistant. LICENSE and the third-party file ship inside the installer.
- [ ] Donations: needs the owner's handle (GitHub Sponsors, Ko-fi) for a README link and `.github/FUNDING.yml`.
- [ ] Microsoft Store: check whether an MSIX submission is signed by Microsoft, which would remove the need to buy a certificate for Store users. Unverified.
- [x] File access is granted, not assumed (2026-10-02, `src-tauri/src/grants.rs`). Rust reads and writes only what the user picked in a dialog, dropped, named on the command line, or allowed in a native prompt; the pickers moved to the Rust side so the page cannot grant itself anything, and the grant list is a file the page has no command to write. Siblings of a granted file are readable (relative links), a git repository is readable throughout, writes need the exact file. Checked on the real exe: a pre-existing tab and a command-line file opened with no prompt, a sibling opened with no prompt, a nested file and `C:Windowswin.ini` both raised the prompt and were refused on "Don't allow".
- [ ] `forced-colors` (high contrast) rules; a visible Open / Save control for people who do not read the key list.

## The agent API (added 2026-09-20, checked on the real exe)

The command line is the whole API, so there is still no network code. `slate plan.md` opens and comes to the front; `slate --read plan.md` opens rendered; `slate add plan.md` queues it without taking focus and marks the tab unread; `slate add --scratch x.md` copies the text into a note slate keeps. With nothing running, `add` files the tab and exits in under a second without showing a window. The window now starts hidden and shows itself once loaded, which also removes the white flash at launch.

- [x] The installer puts the exe on the user PATH (2026-09-26), so `slate add plan.md` works by name. Verified: install, add by name in 16ms, reinstall without a duplicate PATH entry, uninstall restores PATH byte for byte.
- [x] Workspaces, keyed by folder (owner's call, 2026-09-20): the git repository slate was run from, else the one the first file lives in, else home. Each is its own tab set (`ws-<folder>-<hash>.json` beside `session.json`). `slate add` from inside a repo files into that repo's set without moving the user, and flags it on the switcher; opening a file in the foreground switches the window over. The switcher only appears once a workspace exists. `:ws <name>` switches too. Checked on the real exe.
- [ ] No way yet to forget a workspace, and its tab set file stays behind if the folder is deleted.

## Costly

- [x] Installer (2026-09-26): `bun run tauri build` makes `src-tauri/target/release/bundle/nsis/slate_0.1.0_x64-setup.exe`, 2.1 MB, per-user, no admin, WebView2 bootstrapped, Start menu entry, uninstall entry, file associations for .md/.markdown/.mdx and .txt/.log/.json/.toml/.yaml/.yml/.ini/.cfg/.env, install dir on the user PATH. The PATH edit is done by the exe (`slate --path-add` / `--path-remove`, tested with a >1024-char PATH) because NSIS strings cap at 1024 and this machine's user PATH is 1981.
- [ ] Code signing. Unsigned, SmartScreen warns and Smart App Control blocks outright. Needs a certificate (Azure Trusted Signing is the cheap route) plus `bundle.windows.signCommand`.
- [ ] Updater plugin, winget / Scoop manifests. Both need a public release URL first.
- [ ] Images in Read view (needs the asset protocol with a scoped allowlist). Mermaid.
- [ ] Large files: one JSON holding every unsaved buffer, rewritten on each edit. At minimum refuse or warn above a size.
- [ ] Switching tabs wipes vim marks, dot-repeat and `gv` (the editor state swap rebuilds the vim plugin). Undo history does not survive a relaunch.
- [ ] Side-by-side live preview. Localisation. Screen-reader audit. The custom title bar loses Windows 11 snap layouts.

## Not slate's fight

Find in files, plugins, macros outside vim, diff, hex, print, multiple windows, folder trees, math, vim-flavoured regex, being on every server like `notepad.exe`.
