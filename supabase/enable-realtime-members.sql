-- Enable Supabase Realtime for workspace_members + workspace_invitations
-- Prefer running: enable-realtime-sync.sql (includes leave_workspace)

ALTER TABLE public.workspace_members REPLICA IDENTITY FULL;
ALTER TABLE public.workspace_invitations REPLICA IDENTITY FULL;

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
