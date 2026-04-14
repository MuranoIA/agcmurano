import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE = 'https://apiconsultacliente.muranoprofessional.com.br';
const MESES_NOMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
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
  if (!res.ok) throw new Error(`Auth failed [${res.status}]: ${await res.text()}`);
  const data = await res.json();
  return data.token;
}

function buildMonthRanges(): { start: string; end: string; label: string }[] {
  const now = new Date();
  const months: { start: string; end: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const end = `${y}-${String(m + 1).padStart(2, '0')}-${lastDay}`;
    const label = `${MESES_NOMES[m]}/${String(y).slice(2)}`;
    months.push({ start, end, label });
  }
  return months;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode');

    const token = await getToken();
    console.log('Token obtained, fetching faturamento...');

    // Legacy single-month mode
    if (mode !== 'all') {
      const dataInicio = url.searchParams.get('data_inicio');
      const dataFim = url.searchParams.get('data_fim');
      let apiUrl = `${API_BASE}/claude/faturamento`;
      if (dataInicio && dataFim) apiUrl += `?data_inicio=${dataInicio}&data_fim=${dataFim}`;
      const res = await fetchWithRetry(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error(`API failed [${res.status}]: ${await res.text()}`);
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Consolidated mode
    const months = buildMonthRanges();
    const totals: Record<string, Record<string, number>> = {};
    const clientNames: Record<string, string> = {};
    const errors: string[] = [];

    for (const mo of months) {
      try {
        const apiUrl = `${API_BASE}/claude/faturamento?data_inicio=${mo.start}&data_fim=${mo.end}`;
        const res = await fetchWithRetry(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) {
          errors.push(`${mo.label}: HTTP ${res.status}`);
          await res.text();
          continue;
        }
        const items = await res.json();
        if (!Array.isArray(items)) continue;

        for (const item of items) {
          if (item.tipo === 'VENDA' && item.codigo_cliente) {
            const code = String(item.codigo_cliente);
            if (!totals[code]) totals[code] = {};
            totals[code][mo.label] = (totals[code][mo.label] || 0) + (Number(item.valor) || 0);
            // Capture client name
            if (item.cliente && !clientNames[code]) {
              clientNames[code] = String(item.cliente);
            }
          }
        }
        console.log(`✅ ${mo.label}: ${items.length} registros`);
      } catch (err) {
        errors.push(`${mo.label}: ${err instanceof Error ? err.message : 'unknown'}`);
        console.warn(`⚠️ ${mo.label} falhou:`, err);
      }
    }

    // Auto-create missing clients in Supabase
    let newClients = 0;
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get existing client codes
      const allCodes = Object.keys(totals);
      const existingCodes = new Set<string>();
      
      // Paginate to get all existing codes
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await supabase
          .from('clientes')
          .select('codigo')
          .range(from, from + pageSize - 1);
        if (!data || data.length === 0) break;
        data.forEach((r: { codigo: string }) => existingCodes.add(r.codigo));
        if (data.length < pageSize) break;
        from += pageSize;
      }

      // Find missing codes
      const missingCodes = allCodes.filter(c => !existingCodes.has(c));
      
      if (missingCodes.length > 0) {
        console.log(`📝 Creating ${missingCodes.length} new clients...`);
        
        // Build client records
        const newRecords = missingCodes.map(code => {
          const meses = totals[code] || {};
          const fatTotal = Object.values(meses).reduce((s, v) => s + v, 0);
          const mcc = Object.values(meses).filter(v => v > 0).length;
          const tmMes = mcc > 0 ? fatTotal / mcc : 0;
          
          return {
            codigo: code,
            nome: clientNames[code] || `Cliente ${code}`,
            meses: meses,
            fat_total: Math.round(fatTotal * 100) / 100,
            mcc: mcc,
            tm_mes: Math.round(tmMes * 100) / 100,
            objetivo_rs: Math.round(tmMes * 1.10 * 100) / 100,
            n_pedidos: mcc,
            ciclo_medio_d: mcc > 0 ? Math.round(30 * (12 / mcc) * 100) / 100 : 0,
            status: 'Novo',
          };
        });

        // Insert in batches of 50
        for (let i = 0; i < newRecords.length; i += 50) {
          const batch = newRecords.slice(i, i + 50);
          const { error } = await supabase.from('clientes').insert(batch);
          if (error) {
            console.warn(`⚠️ Batch insert error:`, error.message);
          } else {
            newClients += batch.length;
          }
        }
        console.log(`✅ ${newClients} new clients created`);
      }
    } catch (err) {
      console.warn('⚠️ Auto-create clients failed:', err);
    }

    console.log(`Done: ${Object.keys(totals).length} clientes, ${months.length} meses, ${errors.length} erros, ${newClients} novos`);

    return new Response(JSON.stringify({ 
      totals, 
      months: months.length, 
      errors, 
      newClients,
      clientNames 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
