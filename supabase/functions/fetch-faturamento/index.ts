import { corsHeaders } from '@supabase/supabase-js/cors'

const API_BASE = 'https://apiconsultacliente.muranoprofessional.com.br';

async function getToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: 'venus', senha: 'consultacliente' }),
  });
  if (!res.ok) {
    throw new Error(`Auth failed [${res.status}]: ${await res.text()}`);
  }
  const data = await res.json();
  return data.token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const token = await getToken();

    const res = await fetch(`${API_BASE}/claude/faturamento`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Faturamento API failed [${res.status}]: ${await res.text()}`);
    }

    const faturamento = await res.json();

    return new Response(JSON.stringify(faturamento), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    console.error('Error fetching faturamento:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
