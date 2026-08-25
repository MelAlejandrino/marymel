"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that says what it is doing.
 *
 * The admin is plain server-action forms, which submit with no feedback at all
 * — you press Save and nothing visibly happens until the page quietly comes
 * back with new values. `useFormStatus` is the one piece of client state worth
 * having here: it reads the pending state of the form it sits inside, so this
 * needs no props and no wiring.
 */
export function SaveButton({
  children = "Save",
  pendingLabel,
  variant = "primary",
}: {
  children?: React.ReactNode;
  /** Defaults to the label with an ellipsis, e.g. "Saving…". */
  pendingLabel?: string;
  variant?: "primary" | "ghost" | "danger";
}) {
  const { pending } = useFormStatus();

  const base =
    "relative rounded-lg px-3 py-1.5 text-sm font-medium transition " +
    "disabled:cursor-progress disabled:opacity-60";
  const skin = {
    primary: "bg-rose-500 text-white hover:bg-rose-600",
    ghost: "border border-white/20 hover:bg-white/10",
    danger: "text-rose-300/70 underline underline-offset-4 hover:text-rose-300",
  }[variant];

  return (
    <button
      type="submit"
      // aria-busy so it is announced, not just visibly greyed out.
      aria-busy={pending}
      disabled={pending}
      className={`${base} ${skin}`}
    >
      {pending ? (pendingLabel ?? `${children}…`) : children}
    </button>
  );
}

/**
 * A second submit in the same form — "Remove" beside "Save". It carries a
 * name/value so the action can tell which one was pressed, and it greys out
 * while *either* is running, because the form is busy either way.
 */
export function AltSubmitButton({
  children,
  name,
  value,
  pendingLabel,
  variant = "ghost",
}: {
  children: React.ReactNode;
  name: string;
  value: string;
  pendingLabel?: string;
  variant?: "ghost" | "danger";
}) {
  const { pending } = useFormStatus();

  const skin = {
    ghost: "border border-white/20 hover:bg-white/10 rounded-lg px-3 py-1.5 text-sm",
    danger:
      "text-xs text-rose-300/70 underline underline-offset-4 hover:text-rose-300",
  }[variant];

  return (
    <button
      type="submit"
      name={name}
      value={value}
      aria-busy={pending}
      disabled={pending}
      className={`${skin} transition disabled:cursor-progress disabled:opacity-50`}
    >
      {pending ? (pendingLabel ?? `${children}…`) : children}
    </button>
  );
}
