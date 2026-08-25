/**
 * The portrait shell, applied to the game routes only.
 *
 * It lives here rather than in the root layout so the admin — a content editor
 * that wants a full, scrollable page — is not squeezed into a phone-shaped
 * column.
 */
export default function GameLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="stage">
        <div className="screen">{children}</div>
      </div>

      <div className="rotate-hint">
        <span className="text-3xl">📱</span>
        <p className="text-base">Turn your phone upright</p>
        <p className="text-sm opacity-60">
          Our world is a little taller than it is wide.
        </p>
      </div>
    </>
  );
}
