-- Workspace chat messages + Realtime
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(trim(message)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_workspace_id_created_at
  ON public.messages (workspace_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON public.messages (sender_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view workspace messages" ON public.messages;
CREATE POLICY "Members can view workspace messages"
  ON public.messages FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Members can send workspace messages" ON public.messages;
CREATE POLICY "Members can send workspace messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND sender_id = auth.uid()
  );

-- Needed so Realtime DELETE/UPDATE payloads include full rows if used later
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
