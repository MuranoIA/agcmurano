import React, { useState, useEffect } from "react";
import { externalSupabase } from "@/integrations/supabase/externalClient";
import { Loader2 } from "lucide-react";

interface Pagamento {
  id: string;
  cliente: string;
  cpf_cnpj: string;
  nf: string;
  pedido: number | null;
  forma: string;
  valor: number;
  emissao: string;
  vencimento: string;
  parcelas: number;
  filial: string;
  status: string;
  link_cobranca: string | null;
}

interface Props {
  cpfCnpj?: string | null;
  nomeCliente?: string | null;
}

const STATUS_MAP: Record<string, { label: string; cor: string; bg: string; border: string }> = {
  paid:      { label: "Pago",      cor: "text-green-700",  bg: "bg-green-50",  border: "border-l-green-500" },
  pending:   { label: "Pendente",  cor: "text-yellow-700", bg: "bg-yellow-50", border: "border-l-yellow-500" },
  overdue:   { label: "Atrasado",  cor: "text-red-700",    bg: "bg-red-50",    border: "border-l-red-500" },
  cancelled: { label: "Cancelado", cor: "text-gray-500",   bg: "bg-gray-50",   border: "border-l-gray-300" },
};

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("pt-BR");
}

function diasAtraso(vencimento: string): number {
  if (!vencimento) return 0;
  const venc = new Date(vencimento);
  if (isNaN(venc.getTime())) return 0;
  const diff = Math.floor((Date.now() - venc.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

/** A RPC buscar_pagamentos devolve no máximo 50 linhas, ordenadas por vencimento desc. */
const LIMITE_RPC = 50;

const normalizar = (s?: string | null) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();

const PagamentosCliente: React.FC<Props> = ({ cpfCnpj, nomeCliente }) => {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [truncado, setTruncado] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    const buscar = async () => {
      setLoading(true);
      setErro(false);
      // O documento é exato na RPC; o nome é ILIKE parcial e pode trazer homônimos
      const porDocumento = !!(cpfCnpj && cpfCnpj.trim());
      const termo = porDocumento ? cpfCnpj!.trim() : (nomeCliente || "").trim();
      if (!termo) {
        if (!cancelado) { setPagamentos([]); setLoading(false); }
        return;
      }
      try {
        const { data, error } = await externalSupabase.rpc("buscar_pagamentos", { termo });
        if (error) throw error;
        const linhasCruas = (data || []) as Pagamento[];
        // A RPC corta em 50 registros (mais recentes por vencimento)
        if (!cancelado) setTruncado(linhasCruas.length >= LIMITE_RPC);
        let linhas = linhasCruas;

        // Sem documento, a busca por nome é parcial: mantém só o nome idêntico
        // pra não exibir a situação financeira de outro cliente neste painel.
        if (!porDocumento) {
          const alvo = normalizar(nomeCliente);
          linhas = linhas.filter(p => normalizar(p.cliente) === alvo);
        }

        // A RPC faz LEFT JOIN em faturamento: uma NF em mais de um pedido
        // repete a mesma cobrança. Sem isso os totais contam em dobro.
        const vistos = new Set<string>();
        linhas = linhas.filter(p => (vistos.has(p.id) ? false : (vistos.add(p.id), true)));

        if (!cancelado) setPagamentos(linhas);
      } catch (err) {
        console.error("Erro ao buscar pagamentos:", err);
        if (!cancelado) { setPagamentos([]); setErro(true); }
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    buscar();
    return () => { cancelado = true; };
  }, [cpfCnpj, nomeCliente]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin mr-2" size={16} />
        <span className="text-sm text-muted-foreground">Carregando pagamentos...</span>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Não foi possível carregar os pagamentos</p>
      </div>
    );
  }

  if (pagamentos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Nenhum registro de pagamento encontrado</p>
      </div>
    );
  }

  // Agrupar por status pra facilitar leitura
  const atrasados = pagamentos.filter(p => p.status === "overdue");
  const pendentes = pagamentos.filter(p => p.status === "pending");
  const pagos = pagamentos.filter(p => p.status === "paid");
  const cancelados = pagamentos.filter(p => p.status === "cancelled");
  const ordenados = [...atrasados, ...pendentes, ...pagos, ...cancelados];

  // Resumo no topo
  const totalAtrasado = atrasados.reduce((s, p) => s + Number(p.valor || 0), 0);
  const totalPendente = pendentes.reduce((s, p) => s + Number(p.valor || 0), 0);

  return (
    <div className="space-y-3">
      {/* Resumo financeiro */}
      <div className="grid grid-cols-3 gap-2">
        {atrasados.length > 0 && (
          <div className="bg-red-50 rounded-lg p-2 text-center">
            <p className="text-xs text-red-600">Atrasado</p>
            <p className="text-sm font-bold text-red-700">{formatBRL(totalAtrasado)}</p>
            <p className="text-[10px] text-red-500">{atrasados.length} cobrança(s)</p>
          </div>
        )}
        {pendentes.length > 0 && (
          <div className="bg-yellow-50 rounded-lg p-2 text-center">
            <p className="text-xs text-yellow-600">Pendente</p>
            <p className="text-sm font-bold text-yellow-700">{formatBRL(totalPendente)}</p>
            <p className="text-[10px] text-yellow-500">{pendentes.length} cobrança(s)</p>
          </div>
        )}
        <div className="bg-green-50 rounded-lg p-2 text-center">
          <p className="text-xs text-green-600">Pagos</p>
          <p className="text-sm font-bold text-green-700">{pagos.length}</p>
          <p className="text-[10px] text-green-500">cobranças</p>
        </div>
      </div>

      {truncado && (
        <p className="text-[10px] text-muted-foreground text-center">
          Mostrando as {LIMITE_RPC} cobranças de vencimento mais recente — os totais acima
          consideram apenas estas.
        </p>
      )}

      {/* Lista de cobranças */}
      {ordenados.map(p => {
        const st = STATUS_MAP[p.status] || STATUS_MAP.cancelled;
        const aberto = expandido === p.id;
        const atraso = p.status === "overdue" ? diasAtraso(p.vencimento) : 0;

        return (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            aria-expanded={aberto}
            onClick={() => setExpandido(aberto ? null : p.id)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setExpandido(aberto ? null : p.id);
              }
            }}
            className={`border-l-4 ${st.border} rounded-lg p-3 cursor-pointer hover:shadow-sm transition-shadow ${st.bg}`}
          >
            {/* Linha principal */}
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {p.nf && <span className="text-xs text-gray-500">NF {p.nf}</span>}
                  {p.pedido && (
                    <span className="text-[10px] bg-white border rounded-full px-2 py-0.5 text-gray-600">
                      Pedido {p.pedido}
                    </span>
                  )}
                  {p.forma && <span className="text-[10px] uppercase text-gray-400">{p.forma}</span>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">Venc. {formatDate(p.vencimento)}</span>
                  {atraso > 0 && (
                    <span className="text-[10px] font-bold text-red-600">{atraso}d em atraso</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <p className="text-sm font-bold text-gray-900">{formatBRL(p.valor)}</p>
                <span className={`text-[10px] font-bold ${st.cor}`}>{st.label}</span>
              </div>
            </div>

            {/* Detalhes expandidos */}
            {aberto && (
              <div className="mt-3 pt-3 border-t border-white/50 space-y-1">
                {p.cpf_cnpj && (
                  <p className="text-xs text-gray-600"><strong>CPF/CNPJ:</strong> {p.cpf_cnpj}</p>
                )}
                <p className="text-xs text-gray-600"><strong>Emissão:</strong> {formatDate(p.emissao)}</p>
                <p className="text-xs text-gray-600">
                  <strong>Vencimento:</strong>{" "}
                  <span className={atraso > 0 ? "text-red-600 font-bold" : ""}>
                    {formatDate(p.vencimento)}
                    {atraso > 0 && ` (${atraso} dias em atraso)`}
                  </span>
                </p>
                {p.parcelas > 1 && (
                  <p className="text-xs text-gray-600"><strong>Parcelas:</strong> {p.parcelas}</p>
                )}
                {p.filial && (
                  <p className="text-xs text-gray-600"><strong>Filial:</strong> {p.filial}</p>
                )}
                {p.link_cobranca && (
                  <a
                    href={p.link_cobranca}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 underline hover:text-blue-800"
                  >
                    🔗 Abrir boleto / PIX
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PagamentosCliente;
