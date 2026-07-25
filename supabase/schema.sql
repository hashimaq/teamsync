-- TeamSync Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PROFILES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- WORKSPACES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- WORKSPACE MEMBERS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

-- =====================================================
-- TASKS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  due_date DATE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;

-- =====================================================
-- UPDATED_AT TRIGGER FOR TASKS
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =====================================================
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- AUTO-ADD OWNER AS WORKSPACE MEMBER
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_workspace();

-- =====================================================
-- HELPER: avoid RLS recursion on workspace_members
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(ws_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces
    WHERE id = ws_id
      AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view member profiles in shared workspaces"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm1
      JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = auth.uid()
        AND wm2.user_id = profiles.id
    )
  );

-- Secure profile upsert used by Google/email auth sync
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

-- Workspaces policies
CREATE POLICY "Owners can view their workspaces"
  ON public.workspaces FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Members can view their workspaces"
  ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(id));

CREATE POLICY "Authenticated users can create workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their workspaces"
  ON public.workspaces FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their workspaces"
  ON public.workspaces FOR DELETE
  USING (auth.uid() = owner_id);

-- Secure workspace create used by the app
CREATE OR REPLACE FUNCTION public.create_workspace(
  p_name TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  result public.workspaces;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'Workspace name is required';
  END IF;

  INSERT INTO public.profiles (id, full_name)
  VALUES (uid, 'User')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspaces (owner_id, name, description)
  VALUES (uid, trim(p_name), NULLIF(trim(p_description), ''))
  RETURNING * INTO result;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (result.id, uid, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT, TEXT) TO service_role;

-- Workspace members policies
CREATE POLICY "Members can view workspace members"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Owners can insert workspace members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    public.is_workspace_owner(workspace_id)
    OR user_id = auth.uid()
  );

CREATE POLICY "Owners can update workspace members"
  ON public.workspace_members FOR UPDATE
  USING (public.is_workspace_owner(workspace_id));

CREATE POLICY "Owners can delete workspace members"
  ON public.workspace_members FOR DELETE
  USING (public.is_workspace_owner(workspace_id));

-- Invite member by registered email (owner only)
DROP FUNCTION IF EXISTS public.invite_workspace_member(UUID, TEXT);

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

-- Tasks policies
CREATE POLICY "Members can view workspace tasks"
  ON public.tasks FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "Members can update tasks"
  ON public.tasks FOR UPDATE
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Creators can delete their tasks"
  ON public.tasks FOR DELETE
  USING (
    public.is_workspace_member(workspace_id)
    AND created_by = auth.uid()
  );
