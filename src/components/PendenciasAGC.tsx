import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertaAGC,
  HistoricoAGC,
  fetchAlertasPendentes,
  fetchHistorico,
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

const corDiasPendente = (dias: number): string => {
  if (dias >= 8) return "bg-red-100 text-red-700";
  if (dias >= 4) return "bg-yellow-100 text-yellow-700";
  return "bg-blue-100 text-blue-700";
};

const fmtDataHora = (iso: string): string => {
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

const PendenciasAGC: React.FC<Props> = ({ isGestor, usuario, onPendenciasChange }) => {
  const [alertas, setAlertas] = useState<AlertaAGC[]>([]);
  const [historico, setHistorico] = useState<HistoricoAGC[]>([]);
  const [loading, setLoading] = useState(true);
  const [limite, setLimite] = useState(50);
  const [actionId, setActionId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [a, h] = await Promise.all([fetchAlertasPendentes(), fetchHistorico(limite)]);
      setAlertas(a);
      setHistorico(h);
      onPendenciasChange?.(a.length);
    } catch (err) {
      toast.error("Erro ao carregar pendências: " + errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [limite, onPendenciasChange]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAprovar = async (alerta: AlertaAGC) => {
    setActionId(alerta.id);
    try {
      await aprovarAlerta(alerta.id, usuario);
      toast.success(`${alerta.nome_cliente} aprovado no AGC.`);
      await loadData();
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
      await loadData();
    } catch (err) {
      toast.error("Erro ao remover: " + errMsg(err));
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Seção 1: Alertas pendentes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-base">
            Alertas pendentes {alertas.length > 0 && <span className="text-muted-foreground">({alertas.length})</span>}
          </h3>
          <Button variant="outline" size="sm" onClick={loadData} title="Atualizar">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={32} /></div>
        ) : alertas.length === 0 ? (
          <div className="bg-card rounded-lg shadow-sm border p-8 text-center text-muted-foreground">
            Nenhuma pendência — tudo em dia! ✅
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Seção 2: Histórico de movimentações */}
      <div>
        <h3 className="font-semibold text-base mb-3">Histórico de movimentações</h3>
        <div className="bg-card rounded-lg shadow-sm border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-3 py-2 whitespace-nowrap">Data/hora</th>
                <th className="px-3 py-2">Cliente</th>
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
                  <td className="px-3 py-2 whitespace-nowrap">
                    {EVENTO_ICON[h.tipo_evento] || "•"} {h.tipo_evento}
                  </td>
                  <td className="px-3 py-2 text-xs max-w-[280px]" title={h.detalhes}>{h.detalhes || "—"}</td>
                  <td className="px-3 py-2 text-xs">{h.usuario || "—"}</td>
                </tr>
              ))}
              {historico.length === 0 && !loading && (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma movimentação registrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {historico.length >= limite && (
          <div className="flex justify-center mt-3">
            <Button variant="outline" size="sm" onClick={() => setLimite(l => l + 50)} disabled={loading}>
              Carregar mais
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendenciasAGC;
