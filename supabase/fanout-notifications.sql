-- Reliable notification fan-out (bypasses RLS for inserts, still auth-gated)
-- Run in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.fanout_notifications(
  p_workspace_id UUID,
  p_rows JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  inserted INTEGER := 0;
  row_item JSONB;
  recipient UUID;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'workspace_id is required';
  END IF;

  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Not a workspace member';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR row_item IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    recipient := NULLIF(row_item->>'recipient_id', '')::UUID;

    -- Skip invalid recipient only (sender MAY receive their own notification)
    IF recipient IS NULL THEN
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.notifications (
        workspace_id,
        recipient_id,
        sender_id,
        type,
        title,
        message,
        metadata
      )
      VALUES (
        p_workspace_id,
        recipient,
        uid,
        row_item->>'type',
        COALESCE(row_item->>'title', 'Notification'),
        COALESCE(row_item->>'message', ''),
        COALESCE(row_item->'metadata', '{}'::jsonb)
      );
      inserted := inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'fanout_notifications skip %: %', recipient, SQLERRM;
    END;
  END LOOP;

  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fanout_notifications(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fanout_notifications(UUID, JSONB) TO service_role;

-- List every member id for fan-out (SECURITY DEFINER so RLS never hides peers)
CREATE OR REPLACE FUNCTION public.list_workspace_member_ids(p_workspace_id UUID)
RETURNS TABLE(user_id UUID, role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(p_workspace_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT wm.user_id, wm.role::TEXT
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_workspace_member_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_workspace_member_ids(UUID) TO service_role;
