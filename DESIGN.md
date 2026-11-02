---
name: slate
description: A plain canvas with a few quiet islands floating on it, after Excalidraw. Drawn clean throughout; the one hand-made thing is the heading face.
colors:
  primary: "light-dark(#6965db, #a8a5ff)"
  primary-ink: "light-dark(#4a47b1, #d5d3ff)"
  primary-light: "light-dark(#e0dfff, #403e6a)"
  canvas: "light-dark(#ffffff, #121212)"
  island: "light-dark(#ffffff, #232329)"
  surface: "light-dark(#f1f0ff, #31303b)"
  surface-low: "light-dark(#f6f6f9, #1c1c21)"
  border: "light-dark(#e1e1ea, #3a3a44)"
  ink: "light-dark(#1b1b1f, #e3e3e8)"
  muted: "light-dark(#6a6a78, #a0a0ad)"
  danger: "light-dark(#e03131, #ff8787)"
  pen-violet: "light-dark(#6741d9, #b197fc)"
  pen-green: "light-dark(#2f9e44, #69db7c)"
  pen-orange: "light-dark(#d9480f, #ffa94d)"
  pen-blue: "light-dark(#1971c2, #74c0fc)"
  pen-red: "light-dark(#c92a2a, #ff8787)"
  pen-grey: "light-dark(#868e96, #868e96)"
  wash-yellow: "light-dark(#fff3bf, rgb(255 236 153 / 0.16))"
  wash-blue: "light-dark(#e7f5ff, rgb(165 216 255 / 0.1))"
  wash-green: "light-dark(#d3f9d8, rgb(178 242 187 / 0.16))"
  wash-red: "light-dark(#ffe3e3, rgb(255 201 201 / 0.16))"
typography:
  display:
    fontFamily: "'Excalifont', 'Segoe Print', cursive"
    fontSize: "36px"
    fontWeight: 400
    lineHeight: 1.2
  headline:
    fontFamily: "'Excalifont', 'Segoe Print', cursive"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1.2
  title:
    fontFamily: "'Excalifont', 'Segoe Print', cursive"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.2
  body:
    fontFamily: "'Assistant', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  body-compact:
    fontFamily: "'Assistant', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "'Assistant', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.2
  label-small:
    fontFamily: "'Assistant', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.2
  code:
    fontFamily: "'Cascadia Mono', 'Cascadia Code', Consolas, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  xs: "5px"
  sm: "6px"
  control: "7px"
  md: "8px"
  island: "10px"
spacing:
  hair: "2px"
  island-pad: "4px"
  control-x: "12px"
  island-inset: "12px"
  face-top: "36px"
  face-side: "40px"
components:
  tab:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "28px"
    padding: "0 4px 0 10px"
  tab-hover:
    backgroundColor: "{colors.surface-low}"
    textColor: "{colors.ink}"
  tab-selected:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary-ink}"
  window-button:
    textColor: "{colors.muted}"
    width: "44px"
    height: "40px"
  window-button-hover:
    backgroundColor: "{colors.surface-low}"
    textColor: "{colors.ink}"
  window-button-quit-hover:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.canvas}"
  island:
    backgroundColor: "{colors.island}"
    rounded: "{rounded.island}"
    height: "36px"
    padding: "4px"
  segment:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "28px"
    padding: "0 12px"
  segment-hover:
    backgroundColor: "{colors.surface-low}"
    textColor: "{colors.ink}"
  segment-selected:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary-ink}"
  mode-pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary-ink}"
    typography: "{typography.label-small}"
    rounded: "{rounded.control}"
    height: "28px"
    padding: "0 8px"
  input-text:
    backgroundColor: "{colors.island}"
    textColor: "{colors.ink}"
    typography: "{typography.code}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
    width: "230px"
  input-select:
    backgroundColor: "{colors.island}"
    textColor: "{colors.ink}"
    typography: "{typography.code}"
    rounded: "{rounded.md}"
    padding: "6px 30px 6px 10px"
    width: "230px"
  checkbox:
    backgroundColor: "{colors.island}"
    rounded: "{rounded.xs}"
    size: "18px"
  checkbox-checked:
    backgroundColor: "{colors.primary}"
  code-block:
    backgroundColor: "{colors.surface-low}"
    typography: "{typography.code}"
    rounded: "{rounded.island}"
    padding: "14px 16px"
  blockquote:
    backgroundColor: "{colors.wash-blue}"
    rounded: "{rounded.island}"
    padding: "12px 18px"
  inline-code:
    backgroundColor: "{colors.wash-yellow}"
    rounded: "{rounded.xs}"
    padding: "2px 5px"
  copy-button:
    backgroundColor: "{colors.island}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "3px 9px"
  copy-button-done:
    textColor: "{colors.pen-green}"
  outline-link:
    textColor: "{colors.muted}"
    typography: "{typography.label-small}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  outline-link-hover:
    backgroundColor: "{colors.surface-low}"
    textColor: "{colors.ink}"
  outline-link-current:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary-ink}"
  find-input:
    backgroundColor: "{colors.surface-low}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "28px"
    width: "220px"
  mark:
    backgroundColor: "{colors.wash-yellow}"
    textColor: "{colors.ink}"
  mark-current:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary-ink}"
---

# Design System: slate

## Overview

**Creative North Star: "The Whiteboard Canvas"**

slate looks and feels like Excalidraw, the owner's pinned direction ("I much prefer like excalidraw style look and feel"). A plain canvas owns the whole window. The chrome is a 40px title row of pill tabs with flat window buttons, and two small rounded islands floating at the bottom. There is one violet, and its light tint marks whatever is selected. Everything else in the chrome is quiet grey on white (or on #121212 in the dark theme, which the app calls Ink; light is Paper).

Everything is drawn clean: hairline rules in `border`, soft grounds, no outlines that pretend to be pen. The one hand-made thing is the heading face: Excalifont for h1 to h3, the Settings title and the empty-tab placeholder. Inline code sits on yellow highlighter, quotes on a blue wash. A first pass faked hand-drawn outlines with an SVG displacement filter; the owner found them rough and they were removed.

Colour is functional. Syntax is highlighted with Excalidraw's pen colours, grounds use its highlighter washes, and both themes come from the same tokens through `light-dark()`. There is no motion: faces (Write, Read, Settings) swap instantly and no transition or animation is declared anywhere, except the 120ms fade that reveals the code-block Copy button (see Known and accepted). The previous one-bit pixel world was rejected by the owner as hard to read and nothing of it is carried here.

**Key Characteristics:**
- White canvas, text owns the window; chrome is one title row plus floating islands: two at the bottom, and in Read an outline or find island at the top right.
- One violet. Its light tint is the only "selected" signal.
- Drawn clean: 1px hairlines and soft grounds. The only hand-made thing is the Excalifont heading face.
- Pen colours for syntax, highlighter washes for grounds.
- Light and dark from one token set via `light-dark()`.
- No motion.

## Colors

A neutral canvas with a single violet accent, plus a borrowed set of felt-tip pens and highlighters that only ever touch content.

### Primary
- **Excalidraw Violet** (`primary`): the caret, links in Read, the focus ring, the checked checkbox fill.
- **Violet Ink** (`primary-ink`): text on the violet tint (selected tab, selected segment, mode pill), and link hover.
- **Violet Tint** (`primary-light`): the ground of anything selected or current: the current tab, the current face segment, the pressed Settings button, text selection, the matching bracket, the selected search match in Write, the current heading in the outline, the current find match in Read, the focus halo on inputs and the find field.

### Secondary
- **The pens** (`pen-violet`, `pen-green`, `pen-orange`, `pen-blue`, `pen-red`, `pen-grey`): syntax only. Violet for keywords and markdown headings/strong, green for strings, orange for numbers and atoms, blue for types, tags, functions and attributes, grey italic for comments and line numbers, red with a wavy underline for invalid. The same style colours fenced code in Read. Green, orange and red double as the text colour of the vim mode pill on their matching wash, and green is the Copy button's one-second "Copied" state.
- **The highlighters** (`wash-yellow`, `wash-blue`, `wash-green`, `wash-red`): grounds only. Yellow behind inline code, search and selection matches in Write, and find matches in Read; blue behind blockquotes; green, yellow and red behind the vim mode pill for insert, visual and replace. In dark they are low-alpha tints, not solid fills.

### Neutral
- **Canvas** (`canvas`): the window and every face.
- **Island** (`island`): floating panels, input fields, kbd caps, CodeMirror panels. Same white as the canvas in light; a lifted grey in dark.
- **Surface** (`surface`): the resting mode pill.
- **Surface Low** (`surface-low`): hover ground for every chrome control (including outline links), code block ground, table header, the settings segmented track, the find field.
- **Border** (`border`): hairlines on inputs, tables, fieldset tops, panel edges, the scrollbar thumb.
- **Ink** (`ink`): text.
- **Muted** (`muted`): resting chrome text, notes, legends, punctuation in syntax.
- **Danger** (`danger`): the close-window hover and the path/error text in the status island.

### Named Rules
**The One Violet Rule.** Selected means violet tint ground with violet ink text at weight 600. The current item of a list (outline heading, find match) is the same tint at weight 400. Nothing else is violet-tinted, and nothing selected is marked any other way.

**The Pens Stay On The Page Rule.** Pen colours and washes colour content (syntax, code, quotes, matches, the vim mode pill). Chrome controls are neutral or violet only.

## Typography

All three faces are the owner's defaults, not fixed: Settings lets the user replace the writing, heading and interface fonts with any installed family. The chosen family is placed in front of the documented stack (`--mono`, `--hand`, `--ui`), which stays as the fallback. Sizes, weights and roles below hold whatever the family.

**Display Font:** Excalifont (self-hosted woff2, OFL; with Segoe Print, cursive)
**Body Font:** Assistant 400/600 via @fontsource (with Segoe UI Variable Text, Segoe UI, system-ui)
**Label/Mono Font:** the user's chosen writing font, default Cascadia Mono (with Cascadia Code, Consolas)

**Character:** A tidy humanist sans runs the chrome and the reading column; a marker-pen hand takes the headings. The contrast is the point: typeset body, handwritten signposts.

### Hierarchy
- **Display** (Excalifont 400, 36px, 1.2): h1 in Read and the Settings title.
- **Headline** (Excalifont 400, 26px, 1.2): h2 in Read and Settings; always sits on a 1px `border` hairline, 6px below the text.
- **Title** (Excalifont 400, 20px, 1.2): h3 in Read. h4 to h6 drop back to Assistant 600 16px/1.3.
- **Body** (Assistant 400, 16px, 1.65): the Read column, capped at 600px inside a 680px measure.
- **Body compact** (Assistant 400, 15px): Settings rows and tables in Read.
- **Label** (Assistant 400, 14px, 1.2; 600 when selected): tabs, segments, buttons, notes, legends.
- **Label small** (13px): the status island, the keys list (in mono), outline links, the find count, and CodeMirror's find panel. 13px is the floor of the ramp; the 12px Copy label is below it and is recorded under Known and accepted, not here.
- **Code** (mono 400, 14px default, 1.6): the Write face, at the user's size setting (8 to 40px); fenced code in Read at 14px/1.6; inline code and kbd at 0.88em; text, number and select inputs at 14px.

Headings use `text-wrap: balance` and a 24px scroll margin so an outline or find jump lands them clear of the top edge. The status position readout and the find count use tabular numerals.

### Named Rules
**The Hand Is For Signposts Rule.** Excalifont appears on h1 to h3, the Settings title and the empty-tab placeholder. Never on body text, controls, tabs or the islands.

**The Two Weights Rule.** Assistant ships at 400 and 600 only. 600 means selected, a legend, a table header, or a minor heading.

## Layout

The body is a two-row grid: a 40px title row and the desk filling the rest. Nothing else is in flow; the three faces are stacked absolutely over the desk and swapped with `hidden`.

The title row is padded 8px left. Tabs are 28px pills with a 2px gap, basis 190px, squeezing to a 62px minimum before the strip scrolls; the selected tab never squeezes below 96px and always keeps its close button. 40px of bare bar is always kept after the tabs so the window can be dragged. Window buttons are 44px wide, stretch the full bar height, and run to the window corner.

Two islands sit 12px above the bottom edge: status at left 14px, actions at right 24px (clear of the scrollbar). A 72px gradient from transparent to canvas fades text out beneath them, and the editor keeps a 64px bottom scroll margin so the cursor never goes under an island; CodeMirror's bottom panels take 56px of bottom padding for the same reason. The status island hides itself when it has nothing to say.

In Read, two more islands can float at the top right, 52px from the top and 24px from the right, one at a time: the outline (260px wide, capped at the face height minus 120px, scrolling inside) and the find bar (a 220px field, a 44px count, two 28px icon buttons). Both are hidden unless summoned and are dismissed when the face changes.

Write pads lines 12px left, 24px right, with 40vh of trailing space. Read and Settings pad 36px top and 30vh bottom, centring a 680px column (560px for Settings) with a 40px minimum side. Code blocks and tables may use the full 680px; everything else stops at 600px, so there is one left edge. Vertical rhythm in Read is 1.1em after blocks and 1.9em before hand headings.

Under 620px wide: the saved-state text leaves the status island, face padding drops to 20px, and settings rows wrap.

## Elevation & Depth

Flat, with one exception. The canvas, title row and every control are flat; hover is a tonal step to `surface-low`, never a lift. The only shadow in the system is the island shadow, a 1px ring plus a soft 5px blur, which is what makes an island read as floating on the canvas. In dark the island is also a lighter grey than the canvas, so depth survives where the shadow is weak.

### Shadow Vocabulary
- **Island** (`box-shadow: 0 0 0 1px light-dark(rgb(0 0 0 / 0.04), rgb(255 255 255 / 0.06)), 0 1px 5px rgb(0 0 0 / 0.15)`): the two bottom islands, the outline and find islands in Read, the command bar, and the selected thumb of the settings segmented control.

### Named Rules
**The One Shadow Rule.** If it floats, it gets the island shadow. If it does not float, it gets none. There is no second shadow value.

## Shapes

Everything is rounded, softly, and nesting decides the radius: an island is 10px, the controls inside it are 7px, so the 4px island padding leaves concentric corners. Tabs, inputs and images are 8px. Icon buttons and kbd caps are 6px. The checkbox and inline-code highlighter are 5px. The dirty/scratch mark on a tab is a 7px circle: filled for unsaved edits, a ring for a tab that is not a file yet.

Icons are inline 10px SVG strokes (1.3px, round caps) in `currentColor`; the find island's chevrons are 12px at 1.5px. Find matches are bare `<mark>` runs with no radius.

Rules are 1px hairlines in `border`: under h2, for `hr`, between Settings groups, around code blocks and table cells. Nothing is outlined in ink. Scrolling for code blocks happens one level inside the block.

### Named Rules
**The No Fake Pen Rule.** No filter, displacement or jitter is used to imitate a hand-drawn line. If a drawn look is ever wanted again, it is real geometry (rough.js or authored SVG paths), never a filtered border.

## Components

### Tabs
- **Shape:** 28px pill, 8px radius, name ellipsised.
- **States:** resting muted text on nothing; hover `surface-low` with ink text; selected violet tint with violet ink.
- **Close:** a 20px icon button, 6px radius, out of layout until hover, focus-within or selected, so a squeezed tab spends its width on its name. The new-tab button is a 28px icon button beside the strip.

### Window buttons
- Flat, square-cornered, 44px wide, full bar height, reaching the top-right pixel. Hover `surface-low`; close hovers to `danger` with canvas-coloured icon. These are the one deliberately unrounded control, because they meet the window corner.

### Islands
- 36px tall, 4px padding, 10px radius, `island` ground, island shadow. Status (left, 13px muted text: mode pill, position, saved state and language, error path in danger) and actions (right: Write/Read segmented plus Settings). The outline and find islands share the anatomy but sit top-right (top 52px, right 24px); the outline grows to its content with 6px padding.

### Outline island
- A `nav` of heading links, 260px wide. Each link is a 13px muted row, 6px 10px padding, 7px radius, ellipsised; indented 12px per heading level from h2 (22px, 34px, 46px for h4 and below). Hover and focus: `surface-low` with ink text, no outline ring. The heading currently in view: violet tint with violet ink. Empty page: one muted 13px line, "No headings in this page." Opened with Ctrl+Shift+O or the `outline` command; arrow keys move between links.

### Find island
- A borderless 220px field, 28px tall, 7px radius, `surface-low` ground, interface font 14px, no outline; focus is a 2px violet-tint ring drawn as a box-shadow. Beside it a 13px muted tabular count (`3/12`, min 44px) and two 28px icon buttons with 12px chevrons that hover to `surface-low`. Matches in the page are `<mark>` on yellow wash with inherited text; the current match is violet tint with violet ink; neither is rounded or outlined. Opened with Ctrl+F or `/` in Read, or the `find` command.

### Segmented control and buttons
- Segments and the Settings button are 28px tall, 12px side padding, 7px radius. Same three states as tabs; selected or pressed is violet tint at 600. Disabled is 40% opacity. The radio inputs are visually hidden and the focus ring is forwarded to the segment.
- In Settings the segmented control sits in a `surface-low` track (3px padding, 10px radius) and the selected thumb is `island` with the island shadow.

### Mode pill
- Shows the vim mode in the status island. 28px, 7px radius, weight 600. Normal: `surface` with violet ink. Insert: green wash, green pen. Visual: yellow wash, orange pen. Replace: red wash, red pen.

### Inputs
- **Text / number:** 1px border, 8px radius, `island` ground, mono 14px, 230px wide (76px for numbers). Focus: border goes violet with a 2px violet-tint halo.
- **Select:** the text field with the native arrow removed: same border, radius, ground, 230px width and focus treatment, set in the interface font at 14px, 30px right padding, and a 12px rounded-stroke chevron 10px from the right edge, drawn as a data-URI SVG. Used for the three Settings font pickers (Writing, Heading, Interface). Each lists every family installed on the machine, read from DirectWrite, grouped Monospace / Everything else (Proportional first for the two non-writing pickers), with a Default option on top.
- **Checkbox:** 18px, 5px radius, 1.5px muted border; checked fills violet with a white rounded check. Settings rows: wrap, line numbers, relative line numbers.
- **Rows:** label left, control right, 42px minimum height. Fieldsets are separated by a 1px top border with a muted 600 legend.
- **Focus everywhere else:** 2px solid violet outline, 1px offset.

### Read content
- **Code block:** `surface-low` ground, 1px `border` hairline, 10px radius, mono 14px/1.6, syntax in pen colours. A Copy button sits 8px inside the top-right corner: `island` ground, 1px `border`, 7px radius, 3px 9px padding, muted interface-font label; invisible until the block is hovered or the button focused; hover turns the label ink. After a click it reads "Copied" in green pen with a green border for one second.
- **Blockquote:** blue wash, 10px radius, 12px 18px padding, no outline.
- **Inline code:** yellow highlighter, 5px radius. **kbd:** island ground, 1px border with a 2px bottom edge, 6px radius.
- **h2 and hr:** 1px `border` hairline, full column width.
- **Links:** violet, 1px underline offset 3px; hover thickens to 2px in violet ink.
- **Tables:** 1px `border` grid, `surface-low` header at 600, 15px text, scroll horizontally inside their own box.
- **Task lists:** the system checkbox, hung in the list margin.

### Command bar
The vim `:` line, vim messages and Write's find panel are CodeMirror bottom panels, restyled as one floating island: centred, 60px above the window's bottom edge (so it clears the two islands), `island` ground and shadow, 10px radius, at least 440px wide and never wider than the window minus 32px. The vim line is 40px tall, mono 14px, the `:` prefix in `primary` at weight 600, the input with no border and no focus outline because the bar itself is the field. Commands added in this pass: `outline` (Ctrl+Shift+O), `find` (Ctrl+F; in Read also `/`) and `vimrc`, which opens the vimrc state file as an ordinary tab named "vimrc" whose save writes and re-applies it. It looks like any other tab.

### Editor
- Transparent over the canvas, violet 2px caret, violet-tint selection, yellow-wash matches, grey line numbers with the active one in ink, no gutter border. The vim block cursor is solid violet with canvas-coloured glyph. The empty-tab placeholder is muted Excalifont.

## Do's and Don'ts

### Do:
- **Do** mark selection with violet tint ground, violet ink text, weight 600, everywhere.
- **Do** define every colour once as a `light-dark()` token and let the theme be `color-scheme`.
- **Do** float new persistent chrome as an island (10px radius, 4px padding, 7px inner controls, the island shadow) or not add it at all. The text owns the window.
- **Do** float transient Read tools (outline, find) as islands at the top right, 52px down and 24px in, one at a time.
- **Do** highlight found text with a bare `<mark>` on yellow wash, and the current match on violet tint; no radius, no outline.
- **Do** hide in-content controls (the code-block Copy button) until hover or focus, so the page reads as a page.
- **Do** keep anything that scrolls clear of the islands (64px scroll margin, 56px panel padding, the 72px fade).
- **Do** separate with 1px `border` hairlines and soft grounds.
- **Do** use pen colours for syntax and washes for grounds, in both faces, from the one shared highlight style.
- **Do** keep type at 13px or above.

### Don't:
- **Don't** imitate hand-drawn lines with SVG filters; the owner rejected the result as rough.
- **Don't** put Excalifont on chrome: tabs, islands, buttons, inputs and the title row stay typeset. The empty-tab placeholder is the only hand-lettering outside Read and Settings headings.
- **Don't** add a second accent or a second shadow.
- **Don't** mark "current" with anything but the violet tint: not an arrow, a bar, or a bold weight on its own.
- **Don't** add transitions or animation. Faces and states change instantly.
- **Don't** bring back the one-bit pixel look, and don't drift into a dark pastel code-editor theme; the owner rejected the first and the direction refuses the second.

## Known and accepted

State of the record, not rules.

- No finish-review pass was run on this world; the owner wanted a lighter process.
- Markdown images do not load in Read (CSP); only alt text shows, in muted 14px.
- The vim `:` line, Write's find panel, the outline and find islands, the Copy button and hover states were never captured from the real exe. Their styles above are read from source, not seen.
- The code-block Copy button fades in over 120ms, the only transition in the stylesheet, and its label is 12px, below the 13px floor. Both are defects the build carries against the no-motion and 13px rules, not system values.
- The select chevron is a data-URI SVG, so its stroke is the light-theme `muted` hex in both themes; it cannot follow the token.
- The app icon is still the black-and-white card-stack mark from the previous world.
