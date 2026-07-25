-- Enable Supabase Realtime for invitation + member sync
-- Run this in the Supabase SQL Editor

-- Full row payloads on UPDATE/DELETE (needed for status + remove/leave toasts)
ALTER TABLE public.workspace_members REPLICA IDENTITY FULL;
ALTER TABLE public.workspace_invitations REPLICA IDENTITY FULL;

-- Add tables to realtime publication (safe if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'workspace_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'workspace_invitations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_invitations;
  END IF;
END $$;

-- Allow a non-owner member to leave a workspace (self-remove)
CREATE OR REPLACE FUNCTION public.leave_workspace(
  p_workspace_id UUID
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

  SELECT role INTO member_role
  FROM public.workspace_members
  WHERE workspace_id = p_workspace_id
    AND user_id = uid;

  IF member_role IS NULL THEN
    RAISE EXCEPTION 'You are not a member of this workspace';
  END IF;

  IF member_role = 'owner' THEN
    RAISE EXCEPTION 'Workspace owners cannot leave. Transfer ownership or delete the workspace.';
  END IF;

  DELETE FROM public.workspace_members
  WHERE workspace_id = p_workspace_id
    AND user_id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_workspace(UUID) TO authenticated;
