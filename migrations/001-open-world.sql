-- Chapters -> mini open world.
--
-- DESTRUCTIVE: drops the chapter tables. `users` and `relationships` are left
-- alone, so logins and the anniversary answer survive. At the time this was
-- written the dropped tables held only placeholder seed content
-- (3 levels, 2 placeholder collectibles, no memories, no progress).
--
-- Safe to re-run.

BEGIN;

-- Old content model. memories/collectibles are recreated below against spots.
DROP TABLE IF EXISTS level_progress CASCADE;
DROP TABLE IF EXISTS collected_items CASCADE;
DROP TABLE IF EXISTS collectibles CASCADE;
DROP TABLE IF EXISTS memories CASCADE;
DROP TABLE IF EXISTS levels CASCADE;
DROP TYPE IF EXISTS level_status;

DO $$ BEGIN
  CREATE TYPE spot_kind AS ENUM ('ARCADE', 'FRAME', 'LETTER', 'KEEPSAKE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE content_type AS ENUM
    ('PHOTO', 'LETTER', 'MEMORY', 'MESSAGE', 'GIFT', 'SPECIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Anything she can walk up to. No unlock dates: the world is open.
CREATE TABLE spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  relationship_id uuid NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  kind spot_kind NOT NULL,
  title text NOT NULL,
  x real NOT NULL,
  z real NOT NULL,
  rotation real DEFAULT 0 NOT NULL,
  config jsonb,
  published boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX spots_relationship ON spots (relationship_id);

CREATE TABLE memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  spot_id uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  media_url text,
  media_alt text,
  memory_date date,
  type content_type DEFAULT 'MEMORY' NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX memories_spot ON memories (spot_id);

CREATE TABLE collectibles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  spot_id uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  title text NOT NULL,
  type content_type DEFAULT 'MEMORY' NOT NULL,
  message text,
  media_url text,
  media_alt text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX collectibles_spot ON collectibles (spot_id);

-- The unique constraints make discover/collect idempotent, so the server can
-- use ON CONFLICT DO NOTHING instead of read-then-write.
CREATE TABLE discoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spot_id uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  discovered_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT discoveries_user_spot UNIQUE (user_id, spot_id)
);

CREATE TABLE collected_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collectible_id uuid NOT NULL REFERENCES collectibles(id) ON DELETE CASCADE,
  collected_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT collected_items_user_collectible UNIQUE (user_id, collectible_id)
);

COMMIT;
