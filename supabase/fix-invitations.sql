-- Pending workspace invitations (accept before joining)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_invitations_pending_unique
  ON public.workspace_invitations (workspace_id, invitee_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_invitee_id
  ON public.workspace_invitations (invitee_id);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id
  ON public.workspace_invitations (workspace_id);

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Invitees can view own invitations" ON public.workspace_invitations;
CREATE POLICY "Invitees can view own invitations"
  ON public.workspace_invitations FOR SELECT
  USING (invitee_id = auth.uid() OR inviter_id = auth.uid() OR public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "Owners can cancel invitations" ON public.workspace_invitations;
CREATE POLICY "Owners can cancel invitations"
  ON public.workspace_invitations FOR UPDATE
  USING (public.is_workspace_owner(workspace_id) OR invitee_id = auth.uid())
  WITH CHECK (public.is_workspace_owner(workspace_id) OR invitee_id = auth.uid());

-- Replace direct-add invite with pending invitation
DROP FUNCTION IF EXISTS public.invite_workspace_member(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.invite_workspace_member(
  p_workspace_id UUID,
  p_email TEXT
)
RETURNS public.workspace_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  target_id UUID;
  normalized_email TEXT := lower(trim(p_email));
  result public.workspace_invitations;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF normalized_email IS NULL OR normalized_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF NOT public.is_workspace_owner(p_workspace_id) THEN
    RAISE EXCEPTION 'Only the workspace owner can invite members';
  END IF;

  SELECT id INTO target_id
  FROM public.profiles
  WHERE email IS NOT NULL
    AND lower(email) = normalized_email
  LIMIT 1;

  IF target_id IS NULL THEN
    SELECT id INTO target_id
    FROM auth.users
    WHERE email IS NOT NULL
      AND lower(email) = normalized_email
    LIMIT 1;

    IF target_id IS NOT NULL THEN
      INSERT INTO public.profiles (id, full_name, email)
      SELECT
        u.id,
        COALESCE(
          u.raw_user_meta_data->>'full_name',
          u.raw_user_meta_data->>'name',
          split_part(u.email, '@', 1),
          'User'
        ),
        u.email
      FROM auth.users u
      WHERE u.id = target_id
      ON CONFLICT (id) DO UPDATE
      SET email = COALESCE(EXCLUDED.email, public.profiles.email);
    END IF;
  END IF;

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'No registered user found with that email';
  END IF;

  IF target_id = uid THEN
    RAISE EXCEPTION 'You cannot invite yourself';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = target_id
  ) THEN
    RAISE EXCEPTION 'This user is already a member of the workspace';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workspace_invitations
    WHERE workspace_id = p_workspace_id
      AND invitee_id = target_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'An invitation is already pending for this user';
  END IF;

  INSERT INTO public.workspace_invitations (
    workspace_id,
    inviter_id,
    invitee_id,
    invitee_email,
    status
  )
  VALUES (
    p_workspace_id,
    uid,
    target_id,
    normalized_email,
    'pending'
  )
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_workspace_member(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(
  p_invitation_id UUID
)
RETURNS public.workspace_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  invite public.workspace_invitations;
  result public.workspace_members;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO invite
  FROM public.workspace_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF invite.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF invite.invitee_id <> uid THEN
    RAISE EXCEPTION 'This invitation is not for you';
  END IF;

  IF invite.status <> 'pending' THEN
    RAISE EXCEPTION 'This invitation is no longer pending';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (invite.workspace_id, uid, 'member')
  ON CONFLICT (workspace_id, user_id) DO NOTHING
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    SELECT * INTO result
    FROM public.workspace_members
    WHERE workspace_id = invite.workspace_id
      AND user_id = uid;
  END IF;

  UPDATE public.workspace_invitations
  SET status = 'accepted',
      responded_at = NOW()
  WHERE id = p_invitation_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_workspace_invitation(
  p_invitation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  invite public.workspace_invitations;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO invite
  FROM public.workspace_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF invite.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF invite.invitee_id <> uid THEN
    RAISE EXCEPTION 'This invitation is not for you';
  END IF;

  IF invite.status <> 'pending' THEN
    RAISE EXCEPTION 'This invitation is no longer pending';
  END IF;

  UPDATE public.workspace_invitations
  SET status = 'declined',
      responded_at = NOW()
  WHERE id = p_invitation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_workspace_invitation(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_workspace_invitation(
  p_invitation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  invite public.workspace_invitations;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO invite
  FROM public.workspace_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF invite.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF NOT public.is_workspace_owner(invite.workspace_id) THEN
    RAISE EXCEPTION 'Only the workspace owner can cancel invitations';
  END IF;

  IF invite.status <> 'pending' THEN
    RAISE EXCEPTION 'This invitation is no longer pending';
  END IF;

  UPDATE public.workspace_invitations
  SET status = 'cancelled',
      responded_at = NOW()
  WHERE id = p_invitation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_workspace_invitation(UUID) TO authenticated;

-- Allow invitees to peek at workspace details for pending invites
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspaces'
      AND policyname = 'Invitees can view invited workspaces'
  ) THEN
    CREATE POLICY "Invitees can view invited workspaces"
      ON public.workspaces FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.workspace_invitations wi
          WHERE wi.workspace_id = workspaces.id
            AND wi.invitee_id = auth.uid()
            AND wi.status = 'pending'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can view invitation counterpart profiles'
  ) THEN
    CREATE POLICY "Users can view invitation counterpart profiles"
      ON public.profiles FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.workspace_invitations wi
          WHERE wi.status = 'pending'
            AND (
              (wi.inviter_id = profiles.id AND wi.invitee_id = auth.uid())
              OR (wi.invitee_id = profiles.id AND wi.inviter_id = auth.uid())
            )
        )
      );
  END IF;
END $$;
