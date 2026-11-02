export interface Command {
  name: string;
  aliases?: string[];
  /** What it does, in the user's words. */
  hint: string;
  /** The keyboard shortcut, if there is one, for people learning them. */
  keys?: string;
  run(arg: string): unknown;
}

const names = (command: Command) => [command.name, ...(command.aliases ?? [])];

/** Commands whose name or alias starts with the first word typed. Nothing typed lists them all. */
export function matching(commands: Command[], input: string): Command[] {
  const word = input.trimStart().split(/\s/, 1)[0].toLowerCase();
  return commands.filter((c) => names(c).some((n) => n.startsWith(word)));
}

/** The command the input names exactly, and the rest of the line as its argument. */
export function resolve(commands: Command[], input: string): { command: Command; arg: string } | null {
  const [word, ...rest] = input.trim().split(/\s+/);
  const command = commands.find((c) => names(c).includes(word.toLowerCase()));
  return command ? { command, arg: rest.join(" ") } : null;
}

/**
 * The command bar: a list of what slate can do, filtered as you type. With vim keys on it stands
 * in for vim's own ":" line, and hands anything that isn't a slate command on to vim.
 */
export class Palette {
  private input: HTMLInputElement;
  private list: HTMLElement;
  private shown: Command[] = [];
  private picked = -1;

  constructor(
    private root: HTMLElement,
    private commands: Command[],
    private options: { vim(): boolean; fallback(input: string): void; closed(): void },
  ) {
    this.input = root.querySelector("input")!;
    this.list = root.querySelector("ul")!;
    this.input.addEventListener("input", () => this.filter());
    this.input.addEventListener("keydown", (e) => this.key(e));
    this.input.addEventListener("blur", () => this.close());
    // mousedown, not click: the input's blur would close the bar before a click landed
    this.list.addEventListener("mousedown", (e) => {
      const item = (e.target as Element).closest("li");
      if (!item) return;
      e.preventDefault();
      this.run(this.shown[Number(item.dataset.index)], "");
    });
  }

  get isOpen() {
    return !this.root.hidden;
  }

  open() {
    this.root.hidden = false;
    this.input.value = "";
    this.filter();
    this.input.focus();
  }

  close() {
    if (!this.isOpen) return;
    this.root.hidden = true;
    this.options.closed();
  }

  private filter() {
    this.shown = matching(this.commands, this.input.value);
    // With vim on, Enter must not guess: ":s" is vim's substitute, not the first thing starting with s.
    this.picked = this.options.vim() || !this.shown.length ? -1 : 0;
    this.paint();
  }

  private paint() {
    this.list.replaceChildren(
      ...this.shown.map((command, index) => {
        const item = document.createElement("li");
        item.role = "option";
        item.dataset.index = String(index);
        item.ariaSelected = String(index === this.picked);
        const name = Object.assign(document.createElement("b"), { textContent: command.name });
        const hint = Object.assign(document.createElement("span"), { textContent: command.hint });
        const keys = Object.assign(document.createElement("kbd"), { textContent: command.keys ?? "" });
        item.append(name, hint, keys);
        return item;
      }),
    );
    this.list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }

  private key(e: KeyboardEvent) {
    e.stopPropagation(); // the app's own shortcuts stay out of the way while the bar is open
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (step && this.shown.length) {
      e.preventDefault();
      this.picked = (this.picked + step + this.shown.length) % this.shown.length;
      this.paint();
    } else if (e.key === "Tab") {
      e.preventDefault();
      const target = this.shown[Math.max(this.picked, 0)];
      if (target) this.input.value = `${target.name} `;
      this.filter();
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const typed = this.input.value;
      const exact = resolve(this.commands, typed);
      if (this.picked >= 0 && !exact) this.run(this.shown[this.picked], "");
      else if (exact) this.run(exact.command, exact.arg);
      else {
        this.close();
        if (typed.trim()) this.options.fallback(typed);
      }
    }
  }

  private run(command: Command, arg: string) {
    this.close();
    command.run(arg);
  }
}
