# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(A Tauri 2 desktop app for Windows 11. The interface is HTML/CSS in WebView2; there is no browser distribution.)

## Users

Developers on Windows who work alongside AI coding agents. Two situations, confirmed by the owner:

- Quick scratch: pop the window open next to a terminal or IDE, jot or paste something, close it without deciding anything.
- Reading agent output: markdown plans, reports and logs that agents wrote. Mostly reading, little typing.

Intended for public release, so strangers install it. Not everyone who installs it uses vim.

## Product Purpose

A replacement for Windows Notepad. Success is that closing the window is never a decision: everything typed is still there next launch, saved to a file or not.

## Positioning

Every tab is kept automatically in a session file, so there is no "save changes?" on exit, and the same window renders the markdown that agents produce. Vim motions are built in rather than a plugin.

## Operating Context

Opened from the taskbar, "Open with", or `slate file.md` from a terminal. Often a small window beside other tools rather than maximized. Files are frequently written by agents while the user has them open.

## Capabilities and Constraints

- Tabs; untitled scratch tabs named by their first line.
- Session persistence to `%LOCALAPPDATA%\dev.mirako.slate\` (local, not roaming, because unsaved text can hold secrets), written shortly after each edit and on close.
- Vim motions through `@replit/codemirror-vim`, with `:w`, `:q`, `:wq`, `:e`, `:md`.
- Syntax highlighting by file extension, loaded on demand.
- Rendered markdown view per tab.
- Settings with a real settings screen (public release), stored as JSON.
- Single instance: a second launch hands its files to the running window.
- The command line is the agent API, and there is no network code: `slate file`, `slate --read file`, `slate add file` (queue without taking focus, tab marked unread), `slate add --scratch file` (copy the text into a kept note).
- Workspaces: one tab set per project, keyed by the git repository slate was run from. Plain launches and loose files use home.
- Files that change on disk reload on their own when the tab has no unsaved edits; otherwise saving asks before overwriting.
- A command bar (`:` with Vim keys on, Ctrl+Shift+P or F1 otherwise) lists every command.
- UTF-8 and BOM-marked UTF-16 files. CRLF files stay CRLF, and a file goes back in the encoding it came in.
- File access is granted per file by the user (dialog, drop, command line, or a native prompt), enforced on the Rust side. The page cannot read or write a path the user never pointed at.
- A vimrc (`:vimrc`), vim yank to the Windows clipboard, relative line numbers.
- Read view has a copy button on code blocks, a heading outline (Ctrl+Shift+O) and find (Ctrl+F or `/`).
- Vanilla TypeScript, one stylesheet, colours as CSS custom properties. No UI framework.
- NSIS installer (per-user, file associations, exe on PATH). App icon is the violet card stack from `src-tauri/app-icon-violet.svg`.
- Undecided: code signing, auto-update.

## Brand Commitments

The name is slate, lowercase.

The look and feel is Excalidraw's, in the owner's words: "I much prefer like excalidraw style look and feel." Readability comes before character. Two earlier looks were rejected and must not come back: a slate-grey ground with chalk-pastel syntax ("ugly"), and a one-bit HyperCard pixel world ("kinda hard to read"). The owner also said a polished result would feel wrong with too much chrome.

## Evidence on Hand

No users, testimonials, benchmarks or press. Do not invent any.

## Product Principles

1. Never lose text. Persistence beats every other feature when they conflict.
2. The text is the interface. Chrome has to justify each pixel it takes.
3. Opening and closing cost nothing: fast start, no prompts on exit.
4. Reading is a first-class job, not a preview mode bolted onto an editor.
5. Vim is built in, and optional.

## Accessibility & Inclusion

No product-specific requirement established. Keyboard operation is inherent to the product; visible focus, reduced-motion and contrast basics apply.
