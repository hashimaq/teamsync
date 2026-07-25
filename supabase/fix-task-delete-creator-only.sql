-- Only the task creator can delete their task
-- Run in Supabase SQL Editor

DROP POLICY IF EXISTS "Members can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Creators can delete their tasks" ON public.tasks;

CREATE POLICY "Creators can delete their tasks"
  ON public.tasks FOR DELETE
  USING (
    public.is_workspace_member(workspace_id)
    AND created_by = auth.uid()
  );
