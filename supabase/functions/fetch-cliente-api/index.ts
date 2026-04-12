const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE = 'https://apiconsultacliente.muranoprofessional.com.br';

async function getToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: 'venus', senha: 'consultacliente' }),
  });
  if (!res.ok) throw new Error(`Auth failed [${res.status}]`);
  const data = await res.json();
  return data.token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const codcli = url.searchParams.get('codcli');
    if (!codcli) {
      return new Response(JSON.stringify({ error: 'codcli is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const token = await getToken();
    const headers = { 'Authorization': `Bearer ${token}` };

    const [headerRes, vendasRes] = await Promise.all([
      fetch(`${API_BASE}/claude/cliente/${codcli}/header`, { headers }),
      fetch(`${API_BASE}/claude/cliente/${codcli}/vendas6m`, { headers }),
    ]);

    const result: Record<string, unknown> = { found: false };

    if (headerRes.ok) {
      const headerData = await headerRes.json();
      result.found = true;
      result.header = headerData;
    } else {
      await headerRes.text();
    }

    if (vendasRes.ok) {
      const vendasData = await vendasRes.json();
      result.vendas = vendasData;
    } else {
      await vendasRes.text();
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
