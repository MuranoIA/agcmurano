import React, { useMemo } from "react";
import { fmtBRL } from "@/lib/format";
import { Cliente } from "@/lib/types";

interface KPIBarProps {
  clientes: Cliente[];
  mesesCols?: string[];
}

const KPIBar: React.FC<KPIBarProps> = ({ clientes, mesesCols }) => {
  const total = clientes.length;

  const fatTotal = useMemo(() => {
    if (!mesesCols || mesesCols.length === 0) return clientes.reduce((s, c) => s + c.Fat_Total, 0);
    return clientes.reduce((s, c) => {
      return s + mesesCols.reduce((ms, m) => ms + (c.meses[m] || 0), 0);
    }, 0);
  }, [clientes, mesesCols]);

  const tmMesAvg = useMemo(() => {
    if (!mesesCols || mesesCols.length === 0 || total === 0)
      return total ? clientes.reduce((s, c) => s + c.TM_Mes, 0) / total : 0;
    return total ? fatTotal / mesesCols.length / total : 0;
  }, [clientes, mesesCols, fatTotal, total]);

  // Positivados: clientes com valor > 0 em algum mês do período
  const positivados = useMemo(() => {
    if (!mesesCols || mesesCols.length === 0) return clientes.filter(c => c.Fat_Total > 0).length;
    return clientes.filter(c => mesesCols.some(m => (c.meses[m] || 0) > 0)).length;
  }, [clientes, mesesCols]);

  // TM/Mês Positivados: Fat.Total ÷ quantidade de positivados
  const tmPosAvg = useMemo(() => {
    return positivados > 0 ? fatTotal / positivados : 0;
  }, [fatTotal, positivados]);

  // TM_Mes médio original (para % realizado)
  const tmMesOrigAvg = useMemo(() => {
    return total > 0 ? clientes.reduce((s, c) => s + c.TM_Mes, 0) / total : 0;
  }, [clientes, total]);

  // % Realizado vs TM Geral
  const pctRealizadoTMGeral = useMemo(() => {
    return tmMesOrigAvg > 0 ? (tmMesAvg / tmMesOrigAvg) * 100 : 0;
  }, [tmMesAvg, tmMesOrigAvg]);

  // % Realizado vs TM Positivados
  const pctRealizadoTMPos = useMemo(() => {
    return tmMesOrigAvg > 0 ? (tmPosAvg / tmMesOrigAvg) * 100 : 0;
  }, [tmPosAvg, tmMesOrigAvg]);

  // % Realizado vs Objetivo: média do (Abr/26 ÷ Objetivo_R$) × 100
  const pctRealizadoObj = useMemo(() => {
    const comObj = clientes.filter(c => c.Objetivo_R$ > 0);
    if (comObj.length === 0) return 0;
    const soma = comObj.reduce((s, c) => {
      const abr = c.meses["Abr/26"] || 0;
      return s + (abr / c.Objetivo_R$);
    }, 0);
    return (soma / comObj.length) * 100;
  }, [clientes]);

  const ativos = clientes.filter(c => c.Status === "Ativo").length;
  const risco = clientes.filter(c => c.Status === "Risco").length;
  const inativos = clientes.filter(c => c.Status === "Inativo").length;
  const estaSemana = clientes.filter(c => c.Dias_Para_Acao >= 0 && c.Dias_Para_Acao <= 7).length;

  const fmtPct = (v: number) => `${v.toFixed(1)}%`;

  const row1 = [
    { label: "Clientes", value: String(total), cls: "" },
    { label: "Fat. Total", value: fmtBRL(fatTotal), cls: "" },
    { label: "TM/Mês médio", value: fmtBRL(tmMesAvg), cls: "" },
    { label: "Ativos", value: String(ativos), cls: "badge-active" },
    { label: "Risco", value: String(risco), cls: "badge-risk" },
    { label: "Inativos", value: String(inativos), cls: "badge-inactive" },
    { label: "Esta semana", value: String(estaSemana), cls: "text-primary font-bold" },
  ];

  // Clientes positivados acima/abaixo do TM
  const acimaTM = useMemo(() => {
    return clientes.filter(c => {
      const fat = mesesCols && mesesCols.length > 0
        ? mesesCols.reduce((s, m) => s + (c.meses[m] || 0), 0) / mesesCols.length
        : c.Fat_Total;
      return fat > 0 && fat >= c.TM_Mes;
    }).length;
  }, [clientes, mesesCols]);

  const abaixoTM = useMemo(() => {
    return clientes.filter(c => {
      const fat = mesesCols && mesesCols.length > 0
        ? mesesCols.reduce((s, m) => s + (c.meses[m] || 0), 0) / mesesCols.length
        : c.Fat_Total;
      return fat > 0 && fat < c.TM_Mes;
    }).length;
  }, [clientes, mesesCols]);

  // Clientes positivados acima/abaixo do Objetivo
  const acimaObj = useMemo(() => {
    return clientes.filter(c => {
      const fat = mesesCols && mesesCols.length > 0
        ? mesesCols.reduce((s, m) => s + (c.meses[m] || 0), 0) / mesesCols.length
        : c.Fat_Total;
      return fat > 0 && c.Objetivo_R$ > 0 && fat >= c.Objetivo_R$;
    }).length;
  }, [clientes, mesesCols]);

  const abaixoObj = useMemo(() => {
    return clientes.filter(c => {
      const fat = mesesCols && mesesCols.length > 0
        ? mesesCols.reduce((s, m) => s + (c.meses[m] || 0), 0) / mesesCols.length
        : c.Fat_Total;
      return fat > 0 && c.Objetivo_R$ > 0 && fat < c.Objetivo_R$;
    }).length;
  }, [clientes, mesesCols]);

  const row2 = [
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

  const renderRow = (cards: typeof row1, cols: string) => (
    <div className={`grid ${cols} gap-3`}>
      {cards.map(c => (
        <div key={c.label} className="bg-card rounded-lg shadow-sm border p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
          <div className={`text-lg font-semibold ${c.cls}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-3 mb-4">
      {renderRow(row1, "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7")}
      {renderRow(row2, "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5")}
    </div>
  );
};

export default KPIBar;
