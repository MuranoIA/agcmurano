import React from "react";
import { Cliente } from "@/lib/types";
import { useAppData } from "@/contexts/AppDataContext";
import { getOverlay, setVendedor } from "@/lib/overlayStore";
import { VENDEDORES } from "@/lib/types";
import { fmtBRL, fmtBRLShort } from "@/lib/format";
import { heatmapColor } from "@/lib/heatmapColors";
import StatusBadge from "./StatusBadge";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  cliente: Cliente;
  onClose: () => void;
}

const ClientePanel: React.FC<Props> = ({ cliente: c, onClose }) => {
  const { mesesCols, refreshFromOverlay } = useAppData();
  const overlay = getOverlay();

  const lastMonth = mesesCols[mesesCols.length - 1] || "";
  const last3 = mesesCols.slice(-3);
  const last3vals = last3.map(m => c.meses[m] || 0);

  const insights: string[] = [];
  if (c.MCC === c.Meses_1a_Compra && c.MCC > 0) insights.push("✅ Presente em todos os meses — cliente âncora");
  if (c.Meses_1a_Compra > 0 && c.MCC < c.Meses_1a_Compra * 0.6) insights.push("⚠️ Comprando em menos de 60% dos meses disponíveis");
  if (last3vals.length === 3 && last3vals.every(v => v < c.TM_Mes && v > 0)) insights.push("📉 Queda nos últimos 3 meses");
  if (last3vals.length === 3 && last3vals.every(v => v >= c.TM_Mes)) insights.push("📈 Crescimento consistente nos últimos 3 meses");
  if (c.Ciclo_Medio_d > 0 && c.Dias_Sem_Compra > c.Ciclo_Medio_d * 2) insights.push("🚨 Muito além do ciclo — acionar imediatamente");
  if (c.Dias_Para_Acao <= 3 && c.Status === "Ativo") insights.push("🔔 Janela de compra se abre em breve");
  if (c.Objetivo_R$ > 0 && (c.meses[lastMonth] || 0) < c.Objetivo_R$) insights.push("🎯 Abaixo do objetivo no último mês");
  if (c.Objetivo_R$ > 0 && (c.meses[lastMonth] || 0) >= c.Objetivo_R$) insights.push("🎯 Atingiu o objetivo no último mês");

  const visitas = overlay.visitas.filter(v => v.codigo === c.Codigo);

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card z-10 border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{c.Nome}</h2>
            <span className="text-sm text-muted-foreground font-mono">{c.Codigo}</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={c.Status} large />
            <Button variant="ghost" size="sm" onClick={onClose}><X size={20} /></Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Vendedor + Próxima ação */}
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-muted-foreground">Vendedor</span>
              {c.Vendedor ? (
                <div className="font-medium">{c.Vendedor}</div>
              ) : (
                <select className="border rounded px-2 py-1 text-sm bg-card" onChange={e => { setVendedor(c.Codigo, e.target.value); refreshFromOverlay(); }} defaultValue="">
                  <option value="" disabled>Atribuir</option>
                  {VENDEDORES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
            </div>
            <div className="flex-1">
              <span className="text-xs text-muted-foreground">Próxima Ação</span>
              <div className="font-medium text-accent">{c.Proxima_Acao}</div>
            </div>
          </div>

          {/* Grid indicadores */}
          <div className="grid grid-cols-3 gap-3">
            {[
              ["TM/Mês", fmtBRL(c.TM_Mes)],
              ["Objetivo", c.Objetivo_R$ ? fmtBRL(c.Objetivo_R$) : "—"],
              ["Ciclo Médio", `${c.Ciclo_Medio_d}d`],
              ["MCC", String(c.MCC)],
              ["Meses 1ª Compra", String(c.Meses_1a_Compra)],
              ["Dias s/ Compra", String(c.Dias_Sem_Compra)],
              ["Última Compra", c.Ultima_Compra],
              ["Fat. Total", fmtBRL(c.Fat_Total)],
              ["Nº Pedidos", String(c.N_Pedidos)],
            ].map(([label, val]) => (
              <div key={label} className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="font-semibold text-sm">{val}</div>
              </div>
            ))}
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div className="space-y-1">
              <h4 className="font-semibold text-sm mb-2">Interpretação</h4>
              {insights.map((ins, i) => (
                <div key={i} className="text-sm py-1">{ins}</div>
              ))}
            </div>
          )}

          {/* Mini heatmap */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Faturamento Mensal</h4>
            <div className="grid grid-cols-4 gap-1">
              {mesesCols.map(m => {
                const val = c.meses[m] || 0;
                const { bg, fg } = heatmapColor(val, c.TM_Mes);
                return (
                  <div key={m} className="rounded p-2 text-center text-xs" style={{ backgroundColor: bg, color: fg }}>
                    <div className="font-medium">{m}</div>
                    <div>{val > 0 ? fmtBRLShort(val) : "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Visitas */}
          {visitas.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Histórico de Visitas</h4>
              <div className="space-y-2">
                {visitas.map((v, i) => (
                  <div key={i} className="text-sm bg-muted/30 rounded p-2">
                    <span className="font-medium">{v.data} {v.hora}</span> — {v.vendedor}
                    {v.teve_venda && " ✅ venda"}
                    {v.observacao && <div className="text-xs text-muted-foreground mt-1">{v.observacao}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientePanel;
