"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { nextMatch, type Option } from "./typeahead";

export type { Option };

/**
 * A dropdown we control, in place of the native one.
 *
 * This is the ARIA "select-only combobox" pattern: a button that owns the
 * value, a listbox that appears under it, and `aria-activedescendant` to say
 * which option is highlighted. Focus never leaves the button, which is what
 * lets the keyboard behave the way a real <select> does without us having to
 * shuffle focus between eleven elements.
 *
 * Two things it must not lose, being a replacement for a form control:
 *
 *  - The forms here are plain server actions, so the value has to reach the
 *    server under `name`. A hidden input carries it.
 *  - The admin is documented as working with JavaScript off. So the server
 *    renders a real <select>, and this only takes over once it has mounted —
 *    with no JS the native control is what stays on the page, and submits.
 */

/** The answer never changes, so the subscription has nothing to listen to. */
const subscribeToNothing = () => () => {};

export function Combobox({
  name,
  options,
  value: controlled,
  defaultValue,
  onChange,
  className = "",
}: {
  name: string;
  options: Option[];
  /** Pass with `onChange` to drive it from outside; omit to let it hold its own. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
}) {
  const [own, setOwn] = useState(defaultValue ?? options[0]?.value ?? "");
  const value = controlled ?? own;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  /** Letters typed in quick succession, for jump-to-option. */
  const typed = useRef({ text: "", at: 0 });
  const id = useId();

  /**
   * Whether we are past hydration. `useSyncExternalStore` is the sanctioned way
   * to ask: it hands React a different answer on the server than on the client
   * without that counting as a mismatch, and without an effect that sets state.
   */
  const mounted = useSyncExternalStore(subscribeToNothing, () => true, () => false);

  const selected = options.findIndex((o) => o.value === value);

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    setOwn(option.value);
    onChange?.(option.value);
    setOpen(false);
  }

  function show() {
    setActive(selected === -1 ? 0 : selected);
    setOpen(true);
  }

  // Keep the highlighted option in view when the list is long enough to scroll.
  useEffect(() => {
    if (!open) return;
    list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  // Anywhere else on the page closes it. pointerdown, not click, so it shuts
  // before the thing underneath reacts.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  /** Typing letters jumps to the next option starting with them, as a select does. */
  function typeahead(key: string, now: number) {
    const text = (now - typed.current.at < 700 ? typed.current.text : "") + key.toLowerCase();
    typed.current = { text, at: now };
    const index = nextMatch(options, text, open ? active : selected);
    if (index === -1) return;
    if (open) setActive(index);
    else choose(index);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const last = options.length - 1;
    const move = (to: number) => {
      e.preventDefault();
      if (open) setActive(Math.min(last, Math.max(0, to)));
      else show();
    };

    switch (e.key) {
      case "ArrowDown":
        return move(active + 1);
      case "ArrowUp":
        return move(active - 1);
      case "Home":
        return move(0);
      case "End":
        return move(last);
      case "Enter":
      case " ":
        e.preventDefault();
        return open ? choose(active) : show();
      case "Escape":
        return setOpen(false);
      case "Tab":
        // Moving on commits what is highlighted, then gets out of the way.
        if (open) choose(active);
        return;
      default:
        // Printable single characters only — not F1, not Shift.
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          typeahead(e.key, e.timeStamp);
        }
    }
  }

  const label = options[selected]?.label ?? "";

  // Before hydration — and forever, with JS off — the real control.
  if (!mounted) {
    return (
      <select
        name={name}
        defaultValue={value}
        className={className}
        onChange={(e) => {
          setOwn(e.target.value);
          onChange?.(e.target.value);
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div ref={root} className="relative">
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={`${className} flex items-center justify-between gap-2 text-left`}
      >
        <span className="truncate">{label}</span>
        <svg
          viewBox="0 0 12 8"
          aria-hidden="true"
          className={`w-2.5 shrink-0 opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 1.5 6 6.5 11 1.5" />
        </svg>
      </button>

      {/* ponytail: opens downward always. Flip it upward if a dropdown near the
          bottom of the panel starts getting clipped. */}
      <ul
        ref={list}
        id={`${id}-list`}
        role="listbox"
        hidden={!open}
        className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border
                   border-white/15 bg-[#1b1420] p-1 shadow-xl shadow-black/40"
      >
        {options.map((o, i) => (
          <li
            key={o.value}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === selected}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => choose(i)}
            onPointerMove={() => setActive(i)}
            className={`flex cursor-pointer items-center justify-between gap-2 rounded-md
                        px-2.5 py-1.5 text-sm ${i === active ? "bg-white/10" : ""}`}
          >
            <span className="truncate">{o.label}</span>
            {i === selected && <span aria-hidden="true" className="text-rose-300">✓</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
