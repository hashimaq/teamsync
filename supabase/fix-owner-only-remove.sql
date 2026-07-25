-- Ensure only the workspace owner can remove members
-- Run in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.remove_workspace_member(
  p_workspace_id UUID,
  p_member_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  member_role TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Hard owner check via workspaces.owner_id (not member role alone)
  IF NOT EXISTS (
    SELECT 1
    FROM public.workspaces
    WHERE id = p_workspace_id
      AND owner_id = uid
  ) THEN
    RAISE EXCEPTION 'Only the workspace owner can remove members';
  END IF;

  SELECT role INTO member_role
  FROM public.workspace_members
  WHERE id = p_member_id
    AND workspace_id = p_workspace_id;

  IF member_role IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF member_role = 'owner' THEN
    RAISE EXCEPTION 'You cannot remove the workspace owner';
  END IF;

  DELETE FROM public.workspace_members
  WHERE id = p_member_id
    AND workspace_id = p_workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_workspace_member(UUID, UUID) TO authenticated;

-- RLS: only owners may delete member rows directly
DROP POLICY IF EXISTS "Owners can delete workspace members" ON public.workspace_members;
CREATE POLICY "Owners can delete workspace members"
  ON public.workspace_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspaces w
      WHERE w.id = workspace_id
        AND w.owner_id = auth.uid()
    )
  );
