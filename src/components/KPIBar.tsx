import React, { useMemo } from "react";
import { fmtBRL } from "@/lib/format";
import { Cliente } from "@/lib/types";
import { VendasForaCarteira } from "@/lib/supabaseService";

interface KPIBarProps {
  clientes: Cliente[];
  mesesNoPeriodo: number;
  /** Vendas para clientes fora do AGC ativo — entram só no card de faturamento */
  vendasFora?: VendasForaCarteira | null;
}

interface Card {
  label: string;
  value: string;
  cls: string;
  hint?: string;
}

const KPIBar: React.FC<KPIBarProps> = ({ clientes, mesesNoPeriodo, vendasFora }) => {
  const total = clientes.length;
  const meses = Math.max(1, mesesNoPeriodo);

  // Fat. Total — período (Cliente.Fat_Total já vem recortado pelo período)
  const fatTotal = useMemo(() => clientes.reduce((s, c) => s + c.Fat_Total, 0), [clientes]);

  // Positivados: clientes com pelo menos 1 venda no período
  const positivados = useMemo(() => clientes.filter(c => c.N_Pedidos > 0).length, [clientes]);

  // TM/Mês médio do período
  const tmMesAvg = useMemo(() => (total > 0 ? fatTotal / meses / total : 0), [fatTotal, meses, total]);

  // TM/Mês Positivados — Fat período ÷ positivados (sem dividir por meses, conforme spec)
  const tmPosAvg = useMemo(() => (positivados > 0 ? fatTotal / positivados : 0), [fatTotal, positivados]);

  // TM_Mes médio histórico (referência)
  const tmMesOrigAvg = useMemo(() => (total > 0 ? clientes.reduce((s, c) => s + c.TM_Mes, 0) / total : 0), [clientes, total]);

  const pctRealizadoTMGeral = useMemo(
    () => (tmMesOrigAvg > 0 ? (tmMesAvg / tmMesOrigAvg) * 100 : 0),
    [tmMesAvg, tmMesOrigAvg],
  );
  const pctRealizadoTMPos = useMemo(
    () => (tmMesOrigAvg > 0 && positivados > 0 ? (fatTotal / meses / positivados / tmMesOrigAvg) * 100 : 0),
    [fatTotal, meses, positivados, tmMesOrigAvg],
  );

  const pctRealizadoObj = useMemo(() => {
    const comObj = clientes.filter(c => c.Objetivo_R$ > 0);
    if (comObj.length === 0) return 0;
    const soma = comObj.reduce((s, c) => s + (c.Fat_Total / (c.Objetivo_R$ * meses)), 0);
    return (soma / comObj.length) * 100;
  }, [clientes, meses]);

  const ativos = clientes.filter(c => c.Status === "Ativo").length;
  const risco = clientes.filter(c => c.Status === "Risco").length;
  const inativos = clientes.filter(c => c.Status === "Inativo").length;

  const acimaTM = useMemo(
    () => clientes.filter(c => c.Fat_Total > 0 && c.Fat_Total / meses >= c.TM_Mes).length,
    [clientes, meses],
  );
  const abaixoTM = useMemo(
    () => clientes.filter(c => c.Fat_Total > 0 && c.Fat_Total / meses < c.TM_Mes).length,
    [clientes, meses],
  );
  const acimaObj = useMemo(
    () => clientes.filter(c => c.Fat_Total > 0 && c.Objetivo_R$ > 0 && c.Fat_Total / meses >= c.Objetivo_R$).length,
    [clientes, meses],
  );
  const abaixoObj = useMemo(
    () => clientes.filter(c => c.Fat_Total > 0 && c.Objetivo_R$ > 0 && c.Fat_Total / meses < c.Objetivo_R$).length,
    [clientes, meses],
  );

  const fmtPct = (v: number) => `${v.toFixed(1)}%`;

  // O faturamento exibido soma as vendas fora da carteira; as métricas derivadas
  // (TM/Mês, % realizado) continuam sobre a carteira, que é a base de comparação.
  const foraValor = vendasFora?.totalValor ?? 0;
  const fatExibido = fatTotal + foraValor;

  const row1: Card[] = [
    { label: "Clientes", value: String(total), cls: "" },
    {
      label: "Fat. Período",
      value: fmtBRL(fatExibido),
      cls: "",
      hint: foraValor > 0 ? `inclui ${fmtBRL(foraValor)} fora da carteira` : undefined,
    },
    { label: "TM/Mês médio", value: fmtBRL(tmMesAvg), cls: "" },
    { label: "Ativos", value: String(ativos), cls: "badge-active" },
    { label: "Risco", value: String(risco), cls: "badge-risk" },
    { label: "Inativos", value: String(inativos), cls: "badge-inactive" },
  ];

  const row2: Card[] = [
    { label: "Positivados", value: String(positivados), cls: "text-primary font-bold" },
    { label: "TM/Mês Posit.", value: fmtBRL(tmPosAvg), cls: "" },
    { label: "% Real. vs TM", value: fmtPct(pctRealizadoTMGeral), cls: pctRealizadoTMGeral >= 100 ? "text-green-600" : "text-yellow-600" },
    { label: "% Real. vs TM Pos.", value: fmtPct(pctRealizadoTMPos), cls: pctRealizadoTMPos >= 100 ? "text-green-600" : "text-yellow-600" },
    { label: "% Real. vs Obj.", value: fmtPct(pctRealizadoObj), cls: pctRealizadoObj >= 100 ? "text-green-600" : "text-yellow-600" },
    { label: "≥ TM", value: String(acimaTM), cls: "text-green-600 font-bold" },
    { label: "< TM", value: String(abaixoTM), cls: "text-yellow-600 font-bold" },
    { label: "≥ Obj.", value: String(acimaObj), cls: "text-green-600 font-bold" },
    { label: "< Obj.", value: String(abaixoObj), cls: "text-yellow-600 font-bold" },
  ];

  const renderRow = (cards: Card[], cols: string) => (
    <div className={`grid ${cols} gap-3`}>
      {cards.map(c => (
        <div key={c.label} className="bg-card rounded-lg shadow-sm border p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
          <div className={`text-lg font-semibold ${c.cls}`}>{c.value}</div>
          {c.hint && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{c.hint}</div>}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-3 mb-4">
      {renderRow(row1, "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6")}
      {renderRow(row2, "grid-cols-3 sm:grid-cols-5 lg:grid-cols-9")}
    </div>
  );
};

export default KPIBar;
