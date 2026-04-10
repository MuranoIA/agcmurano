
-- Table for CSV client data
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  vendedor TEXT,
  objetivo_rs NUMERIC,
  tm_mes NUMERIC,
  tm_pedido NUMERIC,
  ciclo_medio_d NUMERIC,
  mcc NUMERIC,
  meses_1a_compra NUMERIC,
  dias_sem_compra NUMERIC,
  status TEXT,
  dias_para_acao NUMERIC,
  proxima_acao TEXT,
  n_pedidos NUMERIC,
  fat_total NUMERIC,
  primeira_compra TEXT,
  ultima_compra TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Dynamic monthly values stored as JSONB (key: "Jan/25", value: number)
ALTER TABLE public.clientes ADD COLUMN meses JSONB NOT NULL DEFAULT '{}';

-- Overlay: vendedor assignments
CREATE TABLE public.overlay_vendedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  vendedor TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Overlay: edited monthly values
CREATE TABLE public.overlay_valores_mes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL,
  mes TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(codigo, mes)
);

-- Overlay: visit records
CREATE TABLE public.overlay_visitas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  vendedor TEXT NOT NULL,
  data TEXT NOT NULL,
  hora TEXT NOT NULL,
  teve_venda BOOLEAN NOT NULL DEFAULT false,
  observacao TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overlay_vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overlay_valores_mes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overlay_visitas ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth required)
CREATE POLICY "Public read clientes" ON public.clientes FOR SELECT USING (true);
CREATE POLICY "Public insert clientes" ON public.clientes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update clientes" ON public.clientes FOR UPDATE USING (true);
CREATE POLICY "Public delete clientes" ON public.clientes FOR DELETE USING (true);

CREATE POLICY "Public read overlay_vendedores" ON public.overlay_vendedores FOR SELECT USING (true);
CREATE POLICY "Public insert overlay_vendedores" ON public.overlay_vendedores FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update overlay_vendedores" ON public.overlay_vendedores FOR UPDATE USING (true);
CREATE POLICY "Public delete overlay_vendedores" ON public.overlay_vendedores FOR DELETE USING (true);

CREATE POLICY "Public read overlay_valores_mes" ON public.overlay_valores_mes FOR SELECT USING (true);
CREATE POLICY "Public insert overlay_valores_mes" ON public.overlay_valores_mes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update overlay_valores_mes" ON public.overlay_valores_mes FOR UPDATE USING (true);
CREATE POLICY "Public delete overlay_valores_mes" ON public.overlay_valores_mes FOR DELETE USING (true);

CREATE POLICY "Public read overlay_visitas" ON public.overlay_visitas FOR SELECT USING (true);
CREATE POLICY "Public insert overlay_visitas" ON public.overlay_visitas FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update overlay_visitas" ON public.overlay_visitas FOR UPDATE USING (true);
CREATE POLICY "Public delete overlay_visitas" ON public.overlay_visitas FOR DELETE USING (true);

-- Realtime subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.overlay_vendedores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.overlay_valores_mes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.overlay_visitas;
