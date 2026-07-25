-- Fix workspace create RLS errors
-- Run this in Supabase SQL Editor

-- 1) Owners can always see their own workspaces
-- (fixes INSERT ... RETURNING / .select() after create)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspaces'
      AND policyname = 'Owners can view their workspaces'
  ) THEN
    CREATE POLICY "Owners can view their workspaces"
      ON public.workspaces FOR SELECT
      USING (auth.uid() = owner_id);
  END IF;
END $$;

-- 2) Make sure authenticated users can insert workspaces they own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspaces'
      AND policyname = 'Authenticated users can create workspaces'
  ) THEN
    CREATE POLICY "Authenticated users can create workspaces"
      ON public.workspaces FOR INSERT
      WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

-- 3) Harden workspace member trigger
CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_workspace();

-- 4) Secure create_workspace RPC (bypasses RLS safely for the current user)
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

  -- Ensure profile exists (required by FK owner_id -> profiles.id)
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
