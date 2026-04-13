const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE = 'https://apiconsultacliente.muranoprofessional.com.br';

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      // Wait 2s, 4s before retrying
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
}

async function getToken(): Promise<string> {
  const res = await fetchWithRetry(`${API_BASE}/auth/login`, {
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
    const url = new URL(req.url);
    const dataInicio = url.searchParams.get('data_inicio');
    const dataFim = url.searchParams.get('data_fim');

    const token = await getToken();

    let apiUrl = `${API_BASE}/claude/faturamento`;
    if (dataInicio && dataFim) {
      apiUrl += `?data_inicio=${dataInicio}&data_fim=${dataFim}`;
    }

    const res = await fetchWithRetry(apiUrl, {
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
