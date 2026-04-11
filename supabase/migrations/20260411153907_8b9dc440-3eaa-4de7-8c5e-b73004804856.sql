-- Drop and recreate vendedor update policy with WITH CHECK
DROP POLICY IF EXISTS "Vendedores can update overlay_valores_mes" ON public.overlay_valores_mes;
CREATE POLICY "Vendedores can update overlay_valores_mes"
ON public.overlay_valores_mes
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'vendedor'::app_role))
WITH CHECK (has_role(auth.uid(), 'vendedor'::app_role));

-- Fix admin update policy too
DROP POLICY IF EXISTS "Admins can update overlay_valores_mes" ON public.overlay_valores_mes;
CREATE POLICY "Admins can update overlay_valores_mes"
ON public.overlay_valores_mes
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
