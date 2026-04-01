-- Profiles table — app-specific user data

CREATE TABLE IF NOT EXISTS profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role              VARCHAR(10) NOT NULL DEFAULT 'user'   CHECK (role IN ('user', 'admin')),
  status            VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  name              TEXT,
  image             TEXT,
  nickname          VARCHAR(100),
  age_group         VARCHAR(20),
  gender            VARCHAR(20),
  onboarding_path   VARCHAR(50),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, image)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims JSONB;
  user_role TEXT;
  user_status TEXT;
BEGIN
  SELECT role, status
    INTO user_role, user_status
    FROM public.profiles
   WHERE id = (event->>'user_id')::UUID;

  claims := event->'claims';
  claims := jsonb_set(claims, '{role}',   to_jsonb(COALESCE(user_role, 'user')));
  claims := jsonb_set(claims, '{status}', to_jsonb(COALESCE(user_status, 'active')));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant permission for Supabase auth admin to call the hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
-- Grant read access to profiles table so the function can query it
GRANT SELECT ON public.profiles TO supabase_auth_admin;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_read_own_profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_can_update_own_profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can view all profiles (for admin dashboard)
CREATE POLICY "admins_can_view_all" ON public.profiles
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
