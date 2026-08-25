import Link from "next/link";

import {
  createPrize,
  createSpot,
  deleteSpot,
  resetProgress,
  saveMemory,
  savePrize,
  updateRelationship,
  updateSpot,
} from "@/lib/admin/actions";
import { getAdminWorld, type AdminSpot } from "@/lib/admin/query";
import { logout } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/dal";

import { Combobox } from "./Combobox";
import { NewSpotPlacement } from "./NewSpotPlacement";
import { PlacementField } from "./PlacementField";
import { AltSubmitButton, SaveButton } from "./SaveButton";

export const metadata = { title: "Admin" };

/**
 * The content editor.
 *
 * Plain server-action forms throughout — no client components except the submit
 * buttons — so this works with JavaScript off and has no state to fall out of
 * sync with the database.
 *
 * Everything is collapsed by default. The previous version laid every field of
 * every spot out at once, which was a wall of inputs with no shape to it. Now a
 * spot is one line until you open it, and its fields are grouped into where it
 * is and what it says, rather than one long row of boxes.
 */

const input =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm " +
  "outline-none transition focus-visible:border-white/30 " +
  "focus-visible:ring-2 focus-visible:ring-rose-400/60";
const labelText = "text-[0.7rem] font-medium tracking-wide uppercase opacity-50";
const card = "rounded-2xl border border-white/10 bg-white/[0.025]";
const hint = "text-xs leading-relaxed opacity-45";
const ghost =
  "rounded-lg border border-white/20 px-3 py-1.5 text-sm transition hover:bg-white/10";

const TYPES = ["PHOTO", "LETTER", "MEMORY", "MESSAGE", "GIFT", "SPECIAL"];
/** Only what the server will accept. SVG is refused: it can carry script. */
const ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

const KIND_LABEL: Record<string, string> = {
  ARCADE: "Arcade cabinet",
  FRAME: "Photo frame",
  LETTER: "Letter",
  KEEPSAKE: "Keepsake",
};

function Field({
  label,
  children,
  help,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className={labelText}>{label}</span>
      {children}
      {help && <span className={hint}>{help}</span>}
    </label>
  );
}

function TypeSelect({ value }: { value: string }) {
  return (
    <Field label="Kind of thing">
      <Combobox
        name="type"
        defaultValue={value}
        className={input}
        options={TYPES.map((t) => ({ value: t, label: t[0] + t.slice(1).toLowerCase() }))}
      />
    </Field>
  );
}

/**
 * A share link is a web page, not an image, so it renders as nothing in the
 * game. Worth saying up front rather than letting a photo silently not appear.
 */
function looksUnusable(url: string | null): string | null {
  if (!url) return null;
  if (/drive\.google\.com|docs\.google\.com/.test(url)) {
    return "A Google Drive share link is a web page, not an image — it will not show up. Use the file picker instead.";
  }
  if (/dropbox\.com.*\?dl=0/.test(url)) {
    return "This Dropbox link opens a preview page. Change ?dl=0 to ?raw=1.";
  }
  if (!/^https?:\/\//.test(url)) return "Needs to start with http:// or https://";
  return null;
}

/** Shows whether an image URL actually resolves to an image. */
function MediaPreview({ url, alt }: { url: string | null; alt: string | null }) {
  const warning = looksUnusable(url);
  if (!url) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl bg-black/20 p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt ?? ""}
        className="size-14 shrink-0 rounded-lg border border-white/15 object-cover"
      />
      <p
        className={`text-xs leading-relaxed ${warning ? "text-amber-200" : "opacity-45"}`}
      >
        {warning ??
          "This is the photo the game will show. Blank means the link is not a direct image."}
      </p>
    </div>
  );
}

function PhotoFields({
  url,
  alt,
  uploadsReady,
}: {
  url: string | null;
  alt: string | null;
  uploadsReady: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field
        label="Photo"
        help={
          uploadsReady
            ? "Choose a file, or paste a direct image link below. A chosen file wins."
            : "Upload is not configured — only a direct image link will work."
        }
      >
        <input
          className={`${input} file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-white`}
          type="file"
          name="image"
          accept={ACCEPT}
          disabled={!uploadsReady}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="…or a direct image link">
          <input
            className={input}
            name="mediaUrl"
            defaultValue={url ?? ""}
            placeholder="https://…"
          />
        </Field>
        <Field label="Describe the photo" help="Read out if the picture cannot load.">
          <input className={input} name="mediaAlt" defaultValue={alt ?? ""} />
        </Field>
      </div>
      <MediaPreview url={url} alt={alt} />
    </div>
  );
}

function Placement({
  spot,
  others,
}: {
  spot: AdminSpot;
  others: { x: number; z: number; title: string; kind: string }[];
}) {
  return (
    <form action={updateSpot} className="flex flex-col gap-4">
      <input type="hidden" name="spotId" value={spot.id} />

      <Field
        label="Name"
        help={'Reads inside a sentence: "Read the note on the step". Keep it lowercase.'}
      >
        <input className={input} name="title" defaultValue={spot.title} />
      </Field>

      <PlacementField
        kind={spot.kind}
        x={spot.x}
        z={spot.z}
        rotation={spot.rotation}
        others={others}
      />

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="published"
            defaultChecked={spot.published}
            className="size-4 accent-rose-500"
          />
          Visible to her
        </label>
        <SaveButton>Save placement</SaveButton>
      </div>
    </form>
  );
}

function MemoryEditor({
  spot,
  uploadsReady,
}: {
  spot: AdminSpot;
  uploadsReady: boolean;
}) {
  return (
    <form action={saveMemory} className="flex flex-col gap-4">
      <input type="hidden" name="spotId" value={spot.id} />

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field label="Title">
          <input className={input} name="title" defaultValue={spot.memory?.title ?? ""} />
        </Field>
        <Field label="Date">
          <input
            className={input}
            name="memoryDate"
            type="date"
            defaultValue={spot.memory?.memoryDate ?? ""}
          />
        </Field>
      </div>

      <Field label="What it says" help="Shown in handwriting on the note.">
        <textarea
          className={`${input} min-h-32 leading-relaxed`}
          name="message"
          defaultValue={spot.memory?.message ?? ""}
        />
      </Field>

      <TypeSelect value={spot.memory?.type ?? "MEMORY"} />

      <PhotoFields
        url={spot.memory?.mediaUrl ?? null}
        alt={spot.memory?.mediaAlt ?? null}
        uploadsReady={uploadsReady}
      />

      <div>
        <SaveButton>Save note</SaveButton>
      </div>
    </form>
  );
}

function PrizeEditor({
  spot,
  uploadsReady,
}: {
  spot: AdminSpot;
  uploadsReady: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className={hint}>
        Prizes stay on the server until she wins them. Once she has won them all
        the cabinet keeps working — it just stops recording anything new.
      </p>

      {spot.prizes.map((prize, i) => (
        <details key={prize.id} className="rounded-xl border border-white/10 bg-black/15">
          <summary className="cursor-pointer px-4 py-3 text-sm">
            <span className="opacity-40">{i + 1}.</span> {prize.title}
          </summary>
          <form
            action={savePrize}
            className="flex flex-col gap-4 border-t border-white/10 p-4"
          >
            <input type="hidden" name="prizeId" value={prize.id} />
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <Field label="Title">
                <input className={input} name="title" defaultValue={prize.title} />
              </Field>
              <TypeSelect value={prize.type} />
            </div>
            <Field label="What it says">
              <textarea
                className={`${input} min-h-24 leading-relaxed`}
                name="message"
                defaultValue={prize.message ?? ""}
              />
            </Field>
            <PhotoFields
              url={prize.mediaUrl}
              alt={prize.mediaAlt}
              uploadsReady={uploadsReady}
            />
            <div className="flex flex-wrap items-center gap-3">
              <SaveButton>Save prize</SaveButton>
              <AltSubmitButton name="remove" value="1" pendingLabel="Removing…">
                Remove
              </AltSubmitButton>
            </div>
          </form>
        </details>
      ))}

      <form
        action={createPrize}
        className="flex flex-wrap items-end gap-3 rounded-xl bg-white/[0.03] p-4"
      >
        <input type="hidden" name="spotId" value={spot.id} />
        <Field label="Add a prize" className="min-w-44 flex-1">
          <input className={input} name="title" placeholder="A tiny star" />
        </Field>
        <div className="min-w-36">
          <TypeSelect value="GIFT" />
        </div>
        <SaveButton pendingLabel="Adding…">Add</SaveButton>
      </form>
    </div>
  );
}

export default async function AdminPage() {
  // `requireUser` sends a stranger to the login page. A signed-in player, though,
  // gets told what is wrong — silently bouncing them to the world looks exactly
  // like a broken link. The actions all call `requireAdmin` themselves, so
  // nothing here relies on this page for its security.
  const admin = await requireUser();

  if (admin.role !== "ADMIN") {
    return (
      <main className="mx-auto flex h-[100dvh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-medium">This is the admin area</h1>
        <p className="text-sm opacity-70">
          You are signed in as <strong>{admin.email}</strong>, which is a player
          account. Sign out and back in with the admin account to edit the world.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <form action={logout}>
            <SaveButton pendingLabel="Signing out…">Sign out</SaveButton>
          </form>
          <Link href="/" className={ghost}>
            Back to the world
          </Link>
        </div>
      </main>
    );
  }

  const { relationship, spots, players } = await getAdminWorld();
  const uploadsReady = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );

  return (
    <div className="h-[100dvh] overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#14101a]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <h1 className="text-lg font-medium tracking-tight">Your world</h1>
            <p className="text-xs opacity-45">{admin.email}</p>
          </div>
          <Link href="/" className={ghost}>
            Open the world
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-5 py-6 pb-24">
        {!uploadsReady && (
          <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs leading-relaxed text-amber-100">
            <strong>Photo upload is not set up.</strong> Add{" "}
            <code>CLOUDINARY_CLOUD_NAME</code>, <code>CLOUDINARY_API_KEY</code> and{" "}
            <code>CLOUDINARY_API_SECRET</code> to <code>.env</code>, then restart
            the dev server. Until then only a direct image link works.
          </p>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium tracking-wide uppercase opacity-50">
              In the world
            </h2>
            <span className="text-xs opacity-35">
              {spots.length} {spots.length === 1 ? "thing" : "things"}
            </span>
          </div>

          {spots.length === 0 && (
            <p className={`${card} p-6 text-center text-sm opacity-55`}>
              Nothing placed yet. Add something below.
            </p>
          )}

          {spots.map((spot) => (
            <details key={spot.id} className={card}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-2.5 p-4">
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[0.65rem] tracking-wide uppercase opacity-70">
                  {KIND_LABEL[spot.kind] ?? spot.kind}
                </span>
                <span className="text-sm">{spot.title}</span>
                {!spot.published && (
                  <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[0.65rem] text-amber-200">
                    hidden
                  </span>
                )}
                <span className="ml-auto text-xs opacity-30">
                  {spot.x}, {spot.z}
                </span>
              </summary>

              <div className="flex flex-col gap-6 border-t border-white/10 p-4">
                <Placement
                  spot={spot}
                  others={spots
                    .filter((other) => other.id !== spot.id)
                    .map(({ x, z, title, kind }) => ({ x, z, title, kind }))}
                />

                <div className="border-t border-white/10 pt-5">
                  {spot.kind === "ARCADE" ? (
                    <PrizeEditor spot={spot} uploadsReady={uploadsReady} />
                  ) : (
                    <MemoryEditor spot={spot} uploadsReady={uploadsReady} />
                  )}
                </div>

                <form action={deleteSpot} className="border-t border-white/10 pt-4">
                  <input type="hidden" name="spotId" value={spot.id} />
                  <SaveButton variant="danger" pendingLabel="Deleting…">
                    Delete this and everything on it
                  </SaveButton>
                </form>
              </div>
            </details>
          ))}
        </section>

        <details className={card}>
          <summary className="cursor-pointer p-4 text-sm">
            <span className="opacity-50">+</span> Place something new
          </summary>
          <form
            action={createSpot}
            className="flex flex-col gap-4 border-t border-white/10 p-4"
          >
            <Field label="Name" help="Lowercase — it reads inside a sentence.">
              <input
                className={input}
                name="title"
                placeholder="the note by the gate"
              />
            </Field>
            <NewSpotPlacement
              others={spots.map(({ x, z, title, kind }) => ({ x, z, title, kind }))}
            />
            <p className={hint}>
              It starts hidden, so you can write it before she can find it.
            </p>
            <div>
              <SaveButton pendingLabel="Placing…">Place it</SaveButton>
            </div>
          </form>
        </details>

        <details className={card}>
          <summary className="cursor-pointer p-4 text-sm">
            <span className="opacity-50">⚙</span> Anniversary and progress
          </summary>
          <div className="flex flex-col gap-6 border-t border-white/10 p-4">
            <form action={updateRelationship} className="flex flex-col gap-3">
              <p className={hint}>
                What the door at the entrance checks its question against.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Month" className="w-24">
                  <input
                    className={input}
                    name="month"
                    type="number"
                    min="1"
                    max="12"
                    defaultValue={relationship.anniversaryMonth}
                  />
                </Field>
                <Field label="Day" className="w-24">
                  <input
                    className={input}
                    name="day"
                    type="number"
                    min="1"
                    max="31"
                    defaultValue={relationship.anniversaryDay}
                  />
                </Field>
                <SaveButton />
              </div>
            </form>

            <div className="flex flex-col gap-3 border-t border-white/10 pt-5">
              <p className={hint}>
                Clears what she has found, so the world can be walked fresh.
              </p>
              {players.map((player) => (
                <form
                  key={player.id}
                  action={resetProgress}
                  className="flex items-center gap-3"
                >
                  <input type="hidden" name="userId" value={player.id} />
                  <span className="text-sm">{player.name}</span>
                  <div className="ml-auto">
                    <SaveButton variant="ghost" pendingLabel="Resetting…">
                      Reset progress
                    </SaveButton>
                  </div>
                </form>
              ))}
            </div>
          </div>
        </details>

        <form action={logout} className="pt-2">
          <button className="text-xs underline underline-offset-4 opacity-40 hover:opacity-100">
            Sign out
          </button>
        </form>
      </main>
    </div>
  );
}
