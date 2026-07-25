-- Extend notifications CHECK for task lifecycle events
-- Prefer supabase/fix-realtime-notifications.sql for the full production fix.

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
