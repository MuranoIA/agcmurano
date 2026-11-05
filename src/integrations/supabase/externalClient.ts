import { createClient } from '@supabase/supabase-js';

// Stack "clientes" na VPS (views vw_grandes_contas, agenda_gc, metas_agc, faturamento...).
// A URL e a chave vêm das variáveis do deploy (.env.production na VPS) ou do .env.local
// em desenvolvimento. Nenhuma chave fica no código: o repositório é público.
const EXTERNAL_SUPABASE_URL =
  (import.meta.env.VITE_CLIENTES_SUPABASE_URL as string | undefined) ||
  'https://api-clientes.muranoprofessional.com.br';
const EXTERNAL_SUPABASE_ANON_KEY = import.meta.env.VITE_CLIENTES_SUPABASE_KEY as string | undefined;

if (!EXTERNAL_SUPABASE_ANON_KEY) {
  throw new Error(
    'VITE_CLIENTES_SUPABASE_KEY não definida: configure a chave anon do Supabase clientes ' +
      'nas variáveis do deploy (ou no .env.local em desenvolvimento). Veja .env.example.',
  );
}

export const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY);
