
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read pedidos"
ON public.pedidos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert pedidos"
ON public.pedidos
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pedidos"
ON public.pedidos
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pedidos"
ON public.pedidos
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
