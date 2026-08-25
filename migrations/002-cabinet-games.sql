-- Tell each arcade cabinet which mini-game it runs.
--
-- `config.game` picks both the visual and the game, so a new cabinet is a
-- component plus a branch in game/world/spots — never a migration.
--
-- Safe to re-run.

BEGIN;

UPDATE spots SET config = '{"game":"claw"}'::jsonb
  WHERE kind = 'ARCADE' AND title = 'the claw machine';

UPDATE spots SET config = '{"game":"booth"}'::jsonb
  WHERE kind = 'ARCADE' AND title = 'the photo booth';

COMMIT;
