-- Fix: notification fan-out inserts were failing when chained with .select()
-- because SELECT RLS only allows recipient_id = auth.uid().
-- App code now inserts without .select(). Optionally allow senders to read
-- rows they created (safe for admin/debug; not required for delivery).

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (
    recipient_id = auth.uid()
    OR sender_id = auth.uid()
  );

-- Ensure insert policy is present (sender can fan-out to other recipients)
DROP POLICY IF EXISTS "Users can insert notifications as sender" ON public.notifications;
CREATE POLICY "Users can insert notifications as sender"
  ON public.notifications FOR INSERT
  WITH CHECK (sender_id = auth.uid());
