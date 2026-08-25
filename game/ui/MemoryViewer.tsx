"use client";

import { useEffect, useRef } from "react";

/** What a reveal needs, whether it came from a spot or an arcade prize. */
export type Reveal = {
  title: string;
  message: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  memoryDate?: string | null;
  type: string;
  /** Set for something just won, so the note can say so. */
  wonLabel?: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  PHOTO: "a photo",
  LETTER: "a letter",
  MEMORY: "a memory",
  MESSAGE: "a message",
  GIFT: "a little gift",
  SPECIAL: "something special",
};

const TYPE_MARK: Record<string, string> = {
  PHOTO: "🖼",
  LETTER: "💌",
  MESSAGE: "✉️",
  GIFT: "🎁",
  SPECIAL: "✨",
  MEMORY: "🤍",
};

/** "12 March 2026" from a plain YYYY-MM-DD, without a date library. */
function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    // Fixed to UTC: a plain calendar day has no timezone, and letting the
    // browser's zone shift it would show the day before for anyone west of it.
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * The reveal (PLAN §14).
 *
 * Styled as a note on paper rather than a dialog: warm ruled stock, a torn top
 * edge, the words in handwriting, a photo taped on at a slight angle. Finding
 * something she wrote should not look like a system message — the whole point
 * is that a person left it there.
 */
export function MemoryViewer({
  reveal,
  onClose,
}: {
  reveal: Reveal | null;
  onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);

  // Escape closes it, and focus moves in so a keyboard user is not stranded
  // behind the overlay.
  useEffect(() => {
    if (!reveal) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reveal, onClose]);

  if (!reveal) return null;

  const kind = TYPE_LABEL[reveal.type] ?? "a memory";
  const mark = TYPE_MARK[reveal.type] ?? "🤍";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={reveal.title}
      className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto
                 bg-[#1a1119]/80 p-5 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="my-auto w-full max-w-[22rem]">
        {/* Sits slightly turned, as though it were put down rather than rendered. */}
        <div
          className="note-paper animate-[reveal_520ms_cubic-bezier(0.2,0.9,0.25,1)]
                     rounded-[4px] shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)]"
        >
          {/* Torn top edge. */}
          <div className="note-torn note-paper h-3 w-full" />

          <div className="px-6 pt-1 pb-6">
            {reveal.wonLabel && (
              <p
                className="mb-3 text-center text-[0.7rem] tracking-[0.2em] uppercase"
                style={{ color: "#a8836a" }}
              >
                {reveal.wonLabel}
              </p>
            )}

            {reveal.mediaUrl && (
              <figure className="relative mx-auto mb-5 w-[85%] -rotate-1">
                {/* A strip of tape, so the photo reads as stuck on. */}
                <span
                  aria-hidden
                  className="absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 rotate-2
                             rounded-[2px] bg-white/45 shadow-sm backdrop-blur-[1px]"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={reveal.mediaUrl}
                  alt={reveal.mediaAlt ?? reveal.title}
                  className="w-full rounded-[2px] border-[6px] border-white/70 object-cover
                             shadow-[0_6px_18px_-6px_rgba(0,0,0,0.45)]"
                />
              </figure>
            )}

            <p
              className="text-center text-[0.7rem] tracking-[0.16em] uppercase"
              style={{ color: "#a8836a" }}
            >
              {mark} {kind}
            </p>

            <h2
              className="mt-1 mb-1 text-center text-[1.6rem] leading-tight"
              style={{ fontFamily: "var(--font-note), Georgia, serif" }}
            >
              {reveal.title}
            </h2>

            {reveal.memoryDate && (
              <p
                className="mb-4 text-center text-sm italic"
                style={{
                  fontFamily: "var(--font-note), Georgia, serif",
                  color: "#8d7361",
                }}
              >
                {formatDay(reveal.memoryDate)}
              </p>
            )}

            {/* A rule under the heading, tapering off — a pen stroke, not a border. */}
            <div
              aria-hidden
              className="mx-auto mb-4 h-px w-24"
              style={{
                background:
                  "linear-gradient(to right, transparent, rgb(168 131 106 / 0.55), transparent)",
              }}
            />

            {reveal.message && (
              <p
                className="note-ruled px-1 text-[1.35rem] whitespace-pre-line"
                style={{ fontFamily: "var(--font-hand), cursive", color: "#3f3129" }}
              >
                {reveal.message}
              </p>
            )}

            <div className="mt-6 flex items-center justify-center gap-3">
              {/* A wax seal, standing in for a signature. */}
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-full text-sm
                           shadow-[inset_0_-2px_4px_rgba(0,0,0,0.25)]"
                style={{ background: "radial-gradient(circle at 35% 30%, #e2748c, #b4485f)" }}
              >
                ♥
              </span>
              <button
                ref={close}
                type="button"
                onClick={onClose}
                className="rounded-full px-6 py-2.5 text-sm font-medium tracking-wide
                           text-white transition hover:brightness-110
                           focus-visible:ring-2 focus-visible:ring-rose-300
                           focus-visible:ring-offset-2 focus-visible:outline-none"
                style={{
                  background: "linear-gradient(to bottom, #e0748a, #c25470)",
                  boxShadow: "0 4px 14px -4px rgba(194,84,112,0.7)",
                }}
              >
                Keep it
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
