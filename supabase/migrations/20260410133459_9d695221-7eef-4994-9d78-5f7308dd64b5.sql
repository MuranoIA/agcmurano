
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- user_roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Drop old permissive policies on clientes
DROP POLICY IF EXISTS "Public read clientes" ON public.clientes;
DROP POLICY IF EXISTS "Public insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "Public update clientes" ON public.clientes;
DROP POLICY IF EXISTS "Public delete clientes" ON public.clientes;

-- New clientes policies
CREATE POLICY "Authenticated can read clientes"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert clientes"
  ON public.clientes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update clientes"
  ON public.clientes FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete clientes"
  ON public.clientes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Drop old permissive policies on overlay_vendedores
DROP POLICY IF EXISTS "Public read overlay_vendedores" ON public.overlay_vendedores;
DROP POLICY IF EXISTS "Public insert overlay_vendedores" ON public.overlay_vendedores;
DROP POLICY IF EXISTS "Public update overlay_vendedores" ON public.overlay_vendedores;
DROP POLICY IF EXISTS "Public delete overlay_vendedores" ON public.overlay_vendedores;

CREATE POLICY "Authenticated can read overlay_vendedores"
  ON public.overlay_vendedores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert overlay_vendedores"
  ON public.overlay_vendedores FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update overlay_vendedores"
  ON public.overlay_vendedores FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete overlay_vendedores"
  ON public.overlay_vendedores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Drop old permissive policies on overlay_valores_mes
DROP POLICY IF EXISTS "Public read overlay_valores_mes" ON public.overlay_valores_mes;
DROP POLICY IF EXISTS "Public insert overlay_valores_mes" ON public.overlay_valores_mes;
DROP POLICY IF EXISTS "Public update overlay_valores_mes" ON public.overlay_valores_mes;
DROP POLICY IF EXISTS "Public delete overlay_valores_mes" ON public.overlay_valores_mes;

CREATE POLICY "Authenticated can read overlay_valores_mes"
  ON public.overlay_valores_mes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert overlay_valores_mes"
  ON public.overlay_valores_mes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update overlay_valores_mes"
  ON public.overlay_valores_mes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete overlay_valores_mes"
  ON public.overlay_valores_mes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Drop old permissive policies on overlay_visitas
DROP POLICY IF EXISTS "Public read overlay_visitas" ON public.overlay_visitas;
DROP POLICY IF EXISTS "Public insert overlay_visitas" ON public.overlay_visitas;
DROP POLICY IF EXISTS "Public update overlay_visitas" ON public.overlay_visitas;
DROP POLICY IF EXISTS "Public delete overlay_visitas" ON public.overlay_visitas;

CREATE POLICY "Authenticated can read overlay_visitas"
  ON public.overlay_visitas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert overlay_visitas"
  ON public.overlay_visitas FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update overlay_visitas"
  ON public.overlay_visitas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete overlay_visitas"
  ON public.overlay_visitas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
