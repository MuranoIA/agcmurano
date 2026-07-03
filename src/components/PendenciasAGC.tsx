import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Download, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertaAGC,
  HistoricoAGC,
  ClienteRejeitadoNoRCA,
  HistoricoFiltros,
  fetchAlertasPendentes,
  fetchRejeitadosNoRCA,
  fetchHistoricoFiltrado,
  fetchVendedoresAGC,
  aprovarAlerta,
  removerAlerta,
  errMsg,
} from "@/lib/alertasService";

interface Props {
  isGestor: boolean;
  usuario: string;
  onPendenciasChange?: (n: number) => void;
}

const TIPO_ALERTA_LABEL: Record<string, string> = {
  novo_rca: "Novo no RCA",
  rca_mudou: "RCA mudou",
  rca_removido: "RCA removido",
};

const EVENTO_ICON: Record<string, string> = {
  novo_rca: "🆕",
  entrou_agc: "✅",
  saiu_agc: "❌",
  rca_mudou: "🔄",
  rca_removido: "⚠️",
};

const EVENTO_LABEL: Record<string, string> = {
  novo_rca: "Novo RCA",
  entrou_agc: "Entrou AGC",
  saiu_agc: "Saiu AGC",
  rca_mudou: "RCA mudou",
  rca_removido: "RCA removido",
};

const TIPO_EVENTO_OPCOES: { value: string; label: string }[] = [
  { value: "novo_rca", label: "Novo RCA 🆕" },
  { value: "entrou_agc", label: "Entrou AGC ✅" },
  { value: "saiu_agc", label: "Saiu AGC ❌" },
  { value: "rca_mudou", label: "RCA mudou 🔄" },
  { value: "rca_removido", label: "RCA removido ⚠️" },
];

const TODOS = "__todos__";
const PAGE_SIZE = 50;

const corDiasPendente = (dias: number): string => {
  if (dias >= 8) return "bg-red-100 text-red-700";
  if (dias >= 4) return "bg-yellow-100 text-yellow-700";
  return "bg-blue-100 text-blue-700";
};

const corEscalacao = (dias: number): string => {
  if (dias >= 8) return "border-red-300 bg-red-50";
  if (dias >= 4) return "border-yellow-300 bg-yellow-50";
  return "border-blue-300 bg-blue-50";
};

const fmtDataHora = (iso: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const hojeISO = () => new Date().toISOString().slice(0, 10);

const csvEscape = (v: unknown): string => {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const PendenciasAGC: React.FC<Props> = ({ isGestor, usuario, onPendenciasChange }) => {
  const [alertas, setAlertas] = useState<AlertaAGC[]>([]);
  const [rejeitados, setRejeitados] = useState<ClienteRejeitadoNoRCA[]>([]);
  const [historico, setHistorico] = useState<HistoricoAGC[]>([]);
  const [total, setTotal] = useState(0);
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLog, setLoadingLog] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  // Filtros
  const [fVendedor, setFVendedor] = useState<string>(TODOS);
  const [fDataInicio, setFDataInicio] = useState<string>("2026-07-01");
  const [fDataFim, setFDataFim] = useState<string>(hojeISO());
  const [fTipoEvento, setFTipoEvento] = useState<string>(TODOS);
  const [page, setPage] = useState(0);

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildFiltros = useCallback((): HistoricoFiltros => ({
    vendedor: fVendedor === TODOS ? undefined : fVendedor,
    dataInicio: fDataInicio || undefined,
    dataFim: fDataFim || undefined,
    tipoEvento: fTipoEvento === TODOS ? undefined : fTipoEvento,
  }), [fVendedor, fDataInicio, fDataFim, fTipoEvento]);

  const loadLog = useCallback(async (pg: number) => {
    setLoadingLog(true);
    try {
      const { dados, total: t } = await fetchHistoricoFiltrado(buildFiltros(), PAGE_SIZE, pg * PAGE_SIZE);
      setHistorico(dados);
      setTotal(t);
    } catch (err) {
      toast.error("Erro ao carregar log: " + errMsg(err));
    } finally {
      setLoadingLog(false);
    }
  }, [buildFiltros]);

  const loadAlertas = useCallback(async () => {
    setLoading(true);
    try {
      const [a, r] = await Promise.all([fetchAlertasPendentes(), fetchRejeitadosNoRCA()]);
      setAlertas(a);
      setRejeitados(r);
      onPendenciasChange?.(a.length);
    } catch (err) {
      toast.error("Erro ao carregar alertas: " + errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [onPendenciasChange]);

  // Carga inicial
  useEffect(() => {
    loadAlertas();
    fetchVendedoresAGC().then(setVendedores).catch(() => {});
  }, [loadAlertas]);

  // Carrega o log sempre que a página muda
  useEffect(() => { loadLog(page); }, [page, loadLog]);

  const handleFiltrar = () => {
    if (page === 0) loadLog(0);
    else setPage(0);
  };

  const refreshTudo = () => {
    loadAlertas();
    loadLog(page);
  };

  const handleAprovar = async (alerta: AlertaAGC) => {
    setActionId(alerta.id);
    try {
      await aprovarAlerta(alerta.id, usuario);
      toast.success(`${alerta.nome_cliente} aprovado no AGC.`);
      await loadAlertas();
      await loadLog(page);
    } catch (err) {
      toast.error("Erro ao aprovar: " + errMsg(err));
    } finally {
      setActionId(null);
    }
  };

  const handleRemover = async (alerta: AlertaAGC) => {
    const ok = window.confirm(
      `Você precisa remover esse cliente do RCA no Winthor.\n\n` +
      `Cliente: ${alerta.nome_cliente} (${alerta.cod_cliente})\n` +
      `Vendedor: ${capitalize(alerta.vendedor_rca)}\n\n` +
      `Confirmar a remoção do AGC?`,
    );
    if (!ok) return;
    setActionId(alerta.id);
    try {
      await removerAlerta(alerta.id, usuario, alerta.cod_cliente);
      toast.success(`${alerta.nome_cliente} removido do AGC. Lembre de tirar do RCA no Winthor.`);
      await loadAlertas();
      await loadLog(page);
    } catch (err) {
      toast.error("Erro ao remover: " + errMsg(err));
    } finally {
      setActionId(null);
    }
  };

  const exportarCSV = () => {
    if (historico.length === 0) {
      toast.info("Nada para exportar nesta página.");
      return;
    }
    const header = ["Data/hora", "Cod. Cliente", "Cliente", "Vendedor", "Evento", "Detalhes", "Usuário"];
    const linhas = historico.map(h => [
      fmtDataHora(h.created_at),
      h.cod_cliente,
      h.nome_cliente || "",
      h.vendedor_rca ? capitalize(h.vendedor_rca) : "",
      EVENTO_LABEL[h.tipo_evento] || h.tipo_evento,
      h.detalhes || "",
      h.usuario || "",
    ]);
    const csv = [header, ...linhas].map(row => row.map(csvEscape).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `movimentacoes_agc_${fDataInicio}_a_${fDataFim}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* ===================== COLUNA ESQUERDA: ALERTAS ===================== */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">Alertas</h3>
          <Button variant="outline" size="sm" onClick={refreshTudo} title="Atualizar">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>

        {/* Seção A: Alertas pendentes */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            Pendentes de aprovação {alertas.length > 0 && `(${alertas.length})`}
          </h4>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={28} /></div>
          ) : alertas.length === 0 ? (
            <div className="bg-card rounded-lg shadow-sm border p-6 text-center text-muted-foreground text-sm">
              Nenhuma pendência — tudo em dia! ✅
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {alertas.map(a => (
                <div key={a.id} className="bg-card rounded-lg shadow-sm border p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate" title={a.nome_cliente}>{a.nome_cliente}</div>
                      <div className="text-xs text-muted-foreground">Cód. {a.cod_cliente}</div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${corDiasPendente(a.dias_pendente ?? 0)}`}>
                      {a.dias_pendente ?? 0} {(a.dias_pendente ?? 0) === 1 ? "dia" : "dias"}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Vendedor:</span> {capitalize(a.vendedor_rca)}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      {TIPO_ALERTA_LABEL[a.tipo_alerta] || a.tipo_alerta}
                    </span>
                  </div>
                  {a.detalhes && (
                    <div className="text-xs text-muted-foreground line-clamp-2" title={a.detalhes}>{a.detalhes}</div>
                  )}
                  {isGestor && (
                    <div className="flex gap-2 mt-1">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        disabled={actionId === a.id}
                        onClick={() => handleAprovar(a)}
                      >
                        {actionId === a.id ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} className="mr-1" /> Aprovar</>}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        disabled={actionId === a.id}
                        onClick={() => handleRemover(a)}
                      >
                        <X size={14} className="mr-1" /> Remover
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seção B: Clientes rejeitados ainda no RCA */}
        <div>
          <h4 className="text-sm font-medium mb-2">⚠️ Aguardando remoção do RCA no Winthor</h4>
          {loading ? null : rejeitados.length === 0 ? (
            <div className="bg-card rounded-lg shadow-sm border p-6 text-center text-muted-foreground text-sm">
              Todos os clientes rejeitados já foram removidos do RCA ✅
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {rejeitados.map(r => (
                <div key={r.cod_cliente} className={`rounded-lg shadow-sm border p-4 flex flex-col gap-1.5 ${corEscalacao(r.dias_desde_rejeicao)}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate" title={r.nome_cliente}>{r.nome_cliente}</div>
                      <div className="text-xs text-muted-foreground">Cód. {r.cod_cliente}</div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${corDiasPendente(r.dias_desde_rejeicao)}`}>
                      {r.dias_desde_rejeicao} {r.dias_desde_rejeicao === 1 ? "dia" : "dias"}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Vendedor (RCA):</span> {capitalize(r.vendedor_rca)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Rejeitado por {capitalize(r.rejeitado_por)}
                    {r.dias_desde_rejeicao > 0 ? ` há ${r.dias_desde_rejeicao} ${r.dias_desde_rejeicao === 1 ? "dia" : "dias"}` : " hoje"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===================== COLUNA DIREITA: LOG ===================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">Log de movimentações</h3>
          <Button variant="outline" size="sm" onClick={exportarCSV} title="Exportar CSV">
            <Download size={14} className="mr-1" /> CSV
          </Button>
        </div>

        {/* Filtros */}
        <div className="bg-card rounded-lg shadow-sm border p-3 flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Vendedor</label>
            <Select value={fVendedor} onValueChange={setFVendedor}>
              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {vendedores.map(v => (
                  <SelectItem key={v} value={v}>{capitalize(v)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Data início</label>
            <Input type="date" value={fDataInicio} onChange={e => setFDataInicio(e.target.value)} className="h-8 w-[140px] text-xs" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Data fim</label>
            <Input type="date" value={fDataFim} onChange={e => setFDataFim(e.target.value)} className="h-8 w-[140px] text-xs" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Evento</label>
            <Select value={fTipoEvento} onValueChange={setFTipoEvento}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {TIPO_EVENTO_OPCOES.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="h-8" onClick={handleFiltrar} disabled={loadingLog}>
            {loadingLog ? <Loader2 size={14} className="animate-spin" /> : "🔍 Filtrar"}
          </Button>
        </div>

        {/* Tabela */}
        <div className="bg-card rounded-lg shadow-sm border overflow-x-auto relative">
          {loadingLog && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10">
              <Loader2 className="animate-spin text-primary" size={28} />
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-3 py-2 whitespace-nowrap">Data/hora</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Vendedor</th>
                <th className="px-3 py-2">Evento</th>
                <th className="px-3 py-2">Detalhes</th>
                <th className="px-3 py-2">Usuário</th>
              </tr>
            </thead>
            <tbody>
              {historico.map(h => (
                <tr key={h.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{fmtDataHora(h.created_at)}</td>
                  <td className="px-3 py-2">
                    {h.nome_cliente} <span className="text-muted-foreground">({h.cod_cliente})</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{h.vendedor_rca ? capitalize(h.vendedor_rca) : "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {EVENTO_ICON[h.tipo_evento] || "•"} {EVENTO_LABEL[h.tipo_evento] || h.tipo_evento}
                  </td>
                  <td className="px-3 py-2 text-xs max-w-[240px]" title={h.detalhes}>{h.detalhes || "—"}</td>
                  <td className="px-3 py-2 text-xs">{h.usuario || "—"}</td>
                </tr>
              ))}
              {historico.length === 0 && !loadingLog && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma movimentação encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">{total} registro{total === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || loadingLog}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-xs whitespace-nowrap">Página {page + 1} de {totalPaginas}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPaginas || loadingLog}
              onClick={() => setPage(p => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendenciasAGC;
