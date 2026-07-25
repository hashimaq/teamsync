-- Workspace Member Management
-- Run this in Supabase SQL Editor

-- 1) Add email to profiles for invite-by-email lookup
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;

-- Backfill emails from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '');

-- 2) Keep profile email in sync on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1),
      'User'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      NULL
    ),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    email = COALESCE(EXCLUDED.email, public.profiles.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3) ensure_profile also syncs email from auth.users
CREATE OR REPLACE FUNCTION public.ensure_profile(
  p_full_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.profiles;
  uid UUID := auth.uid();
  user_email TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = uid;

  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (
    uid,
    COALESCE(NULLIF(TRIM(p_full_name), ''), 'User'),
    NULLIF(TRIM(p_avatar_url), ''),
    user_email
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = CASE
      WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = ''
        THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END,
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    email = COALESCE(EXCLUDED.email, public.profiles.email)
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_profile(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile(TEXT, TEXT) TO service_role;

-- 4) Invite member by registered email (owner only)
CREATE OR REPLACE FUNCTION public.invite_workspace_member(
  p_workspace_id UUID,
  p_email TEXT
)
RETURNS public.workspace_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  target_id UUID;
  normalized_email TEXT := lower(trim(p_email));
  result public.workspace_members;
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

  IF EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = target_id
  ) THEN
    RAISE EXCEPTION 'This user is already a member of the workspace';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (p_workspace_id, target_id, 'member')
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_workspace_member(UUID, TEXT) TO authenticated;

-- 5) Remove member (owner only, cannot remove owner role)
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

  IF NOT public.is_workspace_owner(p_workspace_id) THEN
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

-- 6) Ensure member insert policy exists for owners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspace_members'
      AND policyname = 'Owners can insert workspace members'
  ) THEN
    CREATE POLICY "Owners can insert workspace members"
      ON public.workspace_members FOR INSERT
      WITH CHECK (
        public.is_workspace_owner(workspace_id)
        OR user_id = auth.uid()
      );
  END IF;
END $$;
