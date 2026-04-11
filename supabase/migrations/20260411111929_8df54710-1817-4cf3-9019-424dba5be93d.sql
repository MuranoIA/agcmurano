
-- Table to map vendor emails to names for governance
CREATE TABLE public.vendor_email_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  vendor_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_email_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vendor_email_mapping"
ON public.vendor_email_mapping FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read vendor_email_mapping"
ON public.vendor_email_mapping FOR SELECT
TO authenticated
USING (true);

-- Insert vendor mappings
INSERT INTO public.vendor_email_mapping (email, vendor_name) VALUES
  ('maiara@muranoprofessional.com.br', 'Maiara'),
  ('hugo@muranoprofessional.com.br', 'Hugo'),
  ('jacques@muranoprofessional.com.br', 'Jacques');

-- Allow vendedores to INSERT overlay_valores_mes
CREATE POLICY "Vendedores can insert overlay_valores_mes"
ON public.overlay_valores_mes FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'vendedor'));

-- Allow vendedores to UPDATE overlay_valores_mes
CREATE POLICY "Vendedores can update overlay_valores_mes"
ON public.overlay_valores_mes FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'vendedor'));

-- Create a security definer function to get vendor name for current user
CREATE OR REPLACE FUNCTION public.get_vendor_name_for_user(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vendor_name
  FROM public.vendor_email_mapping
  WHERE email = (SELECT email FROM auth.users WHERE id = _user_id)
$$;
