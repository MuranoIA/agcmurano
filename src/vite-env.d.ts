/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase da stack AGC (api-agc). */
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** Supabase da stack clientes (api-clientes). URL opcional: padrão api-clientes. */
  readonly VITE_CLIENTES_SUPABASE_URL?: string;
  readonly VITE_CLIENTES_SUPABASE_KEY: string;
  readonly VITE_ANTHROPIC_API_URL?: string;
  readonly VITE_ANTHROPIC_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
