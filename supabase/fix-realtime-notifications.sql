-- Production realtime notifications + workspace activity
-- Run in Supabase SQL Editor (after notifications.sql)

-- Ensure notification types include task lifecycle events
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'invitation_received',
      'invitation_accepted',
      'member_joined',
      'task_assigned',
      'task_completed',
      'task_updated',
      'task_deleted',
      'role_changed',
      'member_removed',
      'workspace_renamed',
      'welcome',
      'chat_mention'
    )
  );

-- Workspace activity feed (shared by all members, including the actor)
CREATE TABLE IF NOT EXISTS public.workspace_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_activity_workspace_created
  ON public.workspace_activity (workspace_id, created_at DESC);

ALTER TABLE public.workspace_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view workspace activity" ON public.workspace_activity;
CREATE POLICY "Members can view workspace activity"
  ON public.workspace_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_activity.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can insert workspace activity" ON public.workspace_activity;
CREATE POLICY "Members can insert workspace activity"
  ON public.workspace_activity FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_activity.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

ALTER TABLE public.workspace_activity REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'workspace_activity'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_activity;
  END IF;
END $$;

-- Harden notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (recipient_id)
  WHERE is_read = FALSE;
