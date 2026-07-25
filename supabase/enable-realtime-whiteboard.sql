-- Shared collaborative whiteboard (one logical board per workspace)
-- Broadcast realtime does NOT require table publication.
-- Run after whiteboards.sql if you haven't created the table yet.

CREATE TABLE IF NOT EXISTS public.whiteboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  drawing_data JSONB NOT NULL DEFAULT '{"version":1,"strokes":[]}'::jsonb,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whiteboards_workspace_updated
  ON public.whiteboards (workspace_id, updated_at DESC);

-- Prefer a single row per workspace for late-joiner snapshots
DELETE FROM public.whiteboards a
USING public.whiteboards b
WHERE a.workspace_id = b.workspace_id
  AND a.updated_at < b.updated_at;

DELETE FROM public.whiteboards a
USING public.whiteboards b
WHERE a.workspace_id = b.workspace_id
  AND a.updated_at = b.updated_at
  AND a.id::text > b.id::text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whiteboards_workspace_unique
  ON public.whiteboards (workspace_id);

ALTER TABLE public.whiteboards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view workspace whiteboards" ON public.whiteboards;
CREATE POLICY "Members can view workspace whiteboards"
  ON public.whiteboards FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Members can insert workspace whiteboards" ON public.whiteboards;
CREATE POLICY "Members can insert workspace whiteboards"
  ON public.whiteboards FOR INSERT
  WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Members can update workspace whiteboards" ON public.whiteboards;
CREATE POLICY "Members can update workspace whiteboards"
  ON public.whiteboards FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Members can delete workspace whiteboards" ON public.whiteboards;
CREATE POLICY "Members can delete workspace whiteboards"
  ON public.whiteboards FOR DELETE
  USING (
    public.is_workspace_member(workspace_id)
    AND created_by = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.set_whiteboards_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whiteboards_updated_at ON public.whiteboards;
CREATE TRIGGER trg_whiteboards_updated_at
  BEFORE UPDATE ON public.whiteboards
  FOR EACH ROW
  EXECUTE FUNCTION public.set_whiteboards_updated_at();

-- Upsert helper for collaborative autosave (SECURITY DEFINER-safe membership check)
CREATE OR REPLACE FUNCTION public.upsert_workspace_whiteboard(
  p_workspace_id UUID,
  p_drawing_data JSONB
)
RETURNS public.whiteboards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  result public.whiteboards;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Not a workspace member';
  END IF;

  INSERT INTO public.whiteboards (workspace_id, drawing_data, created_by)
  VALUES (p_workspace_id, COALESCE(p_drawing_data, '{"version":1,"strokes":[]}'::jsonb), uid)
  ON CONFLICT (workspace_id)
  DO UPDATE SET
    drawing_data = EXCLUDED.drawing_data,
    updated_at = NOW()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_workspace_whiteboard(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_workspace_whiteboard(UUID, JSONB) TO service_role;
