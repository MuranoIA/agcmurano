
-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated can insert overlay_visitas" ON public.overlay_visitas;

-- Recreate with proper role checks
CREATE POLICY "Authenticated can insert overlay_visitas"
ON public.overlay_visitas FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor')
);
