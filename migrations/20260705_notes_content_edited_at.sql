-- Adds a dedicated "when was the content (title/body) actually last
-- changed" timestamp to notes, separate from `updated_at` (which also gets
-- touched by starring/pin-reordering). Powers the "Edited X ago" indicator
-- shown above a note's contents — matching Apple Notes' semantics of
-- tracking edits, not opens or metadata changes.
-- Run this against your Supabase database.

ALTER TABLE public.admin_notes
  ADD COLUMN IF NOT EXISTS content_edited_at timestamptz NOT NULL DEFAULT now();

-- Backfill: best available guess for existing rows is their current
-- updated_at (we can't retroactively know which past updates were content
-- vs. metadata-only).
UPDATE public.admin_notes
SET content_edited_at = updated_at
WHERE content_edited_at IS DISTINCT FROM updated_at;
