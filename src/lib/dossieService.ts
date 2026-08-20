import { externalSupabase } from "@/integrations/supabase/externalClient";
import { ClienteDetalhe, rankingDepartamentos, rankingProdutos } from "@/lib/clienteDetalheService";

// ---- TIPOS ----

export interface ContextoCliente {
  cod_cliente: number;
  notas: string | null;
  instagram_pessoal: string | null;
  instagram_profissional: string | null;
  atualizado_por: string | null;
  atualizado_em: string | null;
}

export interface VisitaObservacao {
  id: number;
  data_visita: string;
  observacao: string;
  resultado: string | null;
  vendeu: boolean;
}

/** Números que alimentam o prompt — calculados a partir do detalhe já carregado no painel. */
export interface ResumoDossie {
  totalPedidos: number;
  fatTotal: number;
  ticketMedio: number;
  cicloMedio: number;
  ultimaCompra: string | null;
  diasSemCompra: number | null;
  topDepts: string;
  topProds: string;
}

// ---- CONTEXTO (editável pelo vendedor/gestor) ----

export async function fetchContextoCliente(codCliente: number): Promise<ContextoCliente | null> {
  const { data, error } = await externalSupabase
    .from("contexto_cliente")
    .select("cod_cliente, notas, instagram_pessoal, instagram_profissional, atualizado_por, atualizado_em")
    .eq("cod_cliente", codCliente)
    .maybeSingle();
  if (error) throw error;
  return (data as ContextoCliente) ?? null;
}

export async function salvarContextoCliente(input: {
  codCliente: number;
  notas: string;
  instagramPessoal: string;
  instagramProfissional: string;
  usuario: string | null;
}): Promise<void> {
  const { error } = await externalSupabase.from("contexto_cliente").upsert({
    cod_cliente: input.codCliente,
    notas: input.notas.trim() || null,
    instagram_pessoal: input.instagramPessoal.trim() || null,
    instagram_profissional: input.instagramProfissional.trim() || null,
    atualizado_por: input.usuario,
    atualizado_em: new Date().toISOString(),
  });
  if (error) throw error;
}

// ---- NOTAS DE VISITA (readonly — vêm da agenda) ----

export async function fetchVisitasComObservacao(codCliente: number, limite = 10): Promise<VisitaObservacao[]> {
  const { data, error } = await externalSupabase
    .from("agenda_gc")
    .select("id, data_visita, observacao, resultado, vendeu")
    .eq("cod_cliente", codCliente)
    .not("observacao", "is", null)
    .neq("observacao", "")
    .order("data_visita", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data || []).map(v => ({
    id: Number(v.id),
    data_visita: v.data_visita,
    observacao: v.observacao || "",
    resultado: v.resultado,
    vendeu: !!v.vendeu,
  }));
}

// ---- AGREGAÇÃO PARA O PROMPT ----

const MS_DIA = 86_400_000;

/** Só venda faturada entra nas métricas — devolução e bonificação distorcem ticket e ciclo. */
const ehVendaFaturada = (tipo: string | null, posicao: string | null): boolean =>
  (tipo || "").toUpperCase() === "VENDA" && (posicao || "").toUpperCase().startsWith("F -");

export function resumirCliente(detalhe: ClienteDetalhe): ResumoDossie {
  const vendas = detalhe.pedidos
    .filter(p => ehVendaFaturada(p.tipo, p.posicao))
    .map(p => ({ pedido: p.pedido, data: (p.data_fat || p.data_emissao || "").split("T")[0], valor: p.vlr_atendido }))
    .filter(p => p.data);

  const totalPedidos = new Set(vendas.map(p => p.pedido)).size;
  const fatTotal = vendas.reduce((s, p) => s + p.valor, 0);
  const ticketMedio = totalPedidos > 0 ? fatTotal / totalPedidos : 0;

  const datas = [...new Set(vendas.map(p => p.data))].sort();
  const ultimaCompra = datas.length ? datas[datas.length - 1] : null;

  let cicloMedio = 0;
  if (datas.length >= 2) {
    const primeira = new Date(datas[0] + "T00:00:00").getTime();
    const ultima = new Date(datas[datas.length - 1] + "T00:00:00").getTime();
    cicloMedio = Math.round((ultima - primeira) / MS_DIA / (datas.length - 1));
  }

  const diasSemCompra = ultimaCompra
    ? Math.max(0, Math.floor((Date.now() - new Date(ultimaCompra + "T00:00:00").getTime()) / MS_DIA))
    : null;

  const topDepts = rankingDepartamentos(detalhe.itens, 5)
    .map(d => `${d.nome}: R$ ${d.valor.toFixed(0)}`)
    .join(", ");
  const topProds = rankingProdutos(detalhe.itens, 6)
    .map(p => `${p.nome} (${Math.round(p.qtd)}un)`)
    .join(", ");

  return { totalPedidos, fatTotal, ticketMedio, cicloMedio, ultimaCompra, diasSemCompra, topDepts, topProds };
}

/** "2026-08-19" -> "19/08/2026" (sem passar por Date, que desloca o dia no fuso). */
export function dataBR(iso: string | null): string {
  if (!iso) return "nunca";
  const [a, m, d] = iso.split("T")[0].split("-");
  return d ? `${d}/${m}/${a}` : iso;
}

export function montarPromptDossie(params: {
  detalhe: ClienteDetalhe;
  resumo: ResumoDossie;
  nomeCliente: string;
  notas: string;
  visitas: VisitaObservacao[];
}): string {
  const { detalhe, resumo, nomeCliente, notas, visitas } = params;
  const cad = detalhe.cliente;
  const rank = detalhe.ranking;

  const linhas = [
    `- Nome: ${cad?.cliente || nomeCliente}`,
    `- Cidade: ${cad?.cidade || "N/A"} - ${cad?.bairro || "N/A"}`,
    `- Última compra: ${dataBR(resumo.ultimaCompra)}${resumo.diasSemCompra != null ? ` (${resumo.diasSemCompra} dias atrás)` : ""}`,
    `- Total de pedidos: ${resumo.totalPedidos}`,
    `- Faturamento total: R$ ${resumo.fatTotal.toFixed(2)}`,
    `- Ticket médio: R$ ${resumo.ticketMedio.toFixed(2)}`,
    `- Ciclo de compra: ${resumo.cicloMedio > 0 ? `${resumo.cicloMedio} dias` : "N/A"}`,
    `- Ranking: ${rank?.posicao ? `${rank.posicao}º de ${rank.total_clientes} clientes` : "N/A"}`,
    `- Top departamentos: ${resumo.topDepts || "N/A"}`,
    `- Top produtos: ${resumo.topProds || "N/A"}`,
  ].join("\n");

  const blocoNotas = notas.trim() ? `\n\nCONTEXTO DO VENDEDOR:\n${notas.trim()}` : "";
  const blocoVisitas = visitas.length
    ? `\n\nNOTAS DAS ÚLTIMAS VISITAS:\n${visitas
        .map(v => `- ${dataBR(v.data_visita)}: ${v.observacao}${v.vendeu ? " (vendeu)" : ""}`)
        .join("\n")}`
    : "";

  return `Você é um consultor de vendas especialista em cosméticos profissionais (B2B, distribuidora para salões de beleza). Gere um dossiê de vendas PRÁTICO e DIRETO para o vendedor usar na próxima visita.

DADOS DO CLIENTE:
${linhas}${blocoNotas}${blocoVisitas}

GERE UM DOSSIÊ COM EXATAMENTE ESTAS SEÇÕES (use emojis como marcadores):

📋 ABORDAGEM
Como iniciar a conversa, melhor horário, tom ideal. Se tiver contexto do vendedor, use.

🎯 OPORTUNIDADE
Janela de compra baseada no ciclo, status atual, potencial de crescimento.

📦 SUGESTÃO DE PEDIDO
Lista de 3-5 produtos com quantidade sugerida baseada no histórico. Valor estimado do pedido.

💬 SCRIPT DE ABORDAGEM
Mensagem pronta (WhatsApp ou presencial) personalizada com o nome do cliente e produtos relevantes. Curta, natural, persuasiva.

⚠️ ATENÇÃO
Pontos de cuidado (objeções prováveis, preferências, histórico de problemas).

Seja direto, prático e use linguagem natural de vendedor. Não use markdown com # ou **. Use apenas emojis como marcadores de seção.`;
}

// ---- CHAMADA À IA ----

const ANTHROPIC_DIRETO = "https://api.anthropic.com/v1/messages";
/** Aponta para um proxy próprio quando VITE_ANTHROPIC_API_URL existe; sem isso vai direto na API. */
const ENDPOINT_IA = (import.meta.env.VITE_ANTHROPIC_API_URL as string | undefined) || ANTHROPIC_DIRETO;
const CHAVE_IA = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

export const MODELO_DOSSIE = "claude-sonnet-4-6";

export async function gerarDossieIA(prompt: string): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // Chamada direta do browser exige a versão da API e o opt-in explícito da Anthropic.
  if (ENDPOINT_IA === ANTHROPIC_DIRETO) {
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
    if (CHAVE_IA) headers["x-api-key"] = CHAVE_IA;
  }

  const res = await fetch(ENDPOINT_IA, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: MODELO_DOSSIE,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || `Falha na API da IA [${res.status}]`);

  const texto: string = (data?.content || [])
    .filter((item: { type?: string }) => item.type === "text")
    .map((item: { text?: string }) => item.text || "")
    .join("\n")
    .trim();

  if (!texto) throw new Error("A IA não retornou conteúdo.");
  return texto;
}
