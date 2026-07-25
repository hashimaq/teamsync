-- TeamSync whiteboards (shared board snapshot per workspace)
-- Run in Supabase SQL Editor. For collab upsert helper also run enable-realtime-whiteboard.sql

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

CREATE INDEX IF NOT EXISTS idx_whiteboards_created_by
  ON public.whiteboards (created_by);

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
