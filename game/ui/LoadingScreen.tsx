"use client";

/** PLAN §29 — the wait should feel like part of the world, not a spinner. */
export function LoadingScreen({ done }: { done: boolean }) {
  return (
    <div
      aria-hidden={done}
      className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-3
                  bg-[#14101a] text-center transition-opacity duration-700
                  ${done ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <span className="animate-pulse text-4xl">❤️</span>
      <p className="text-white/80">Preparing your little world...</p>
      <p className="text-sm text-white/40">Loading our memories...</p>
    </div>
  );
}
