import React, { useMemo } from "react";
import { fmtBRL } from "@/lib/format";
import { Cliente } from "@/lib/types";

interface KPIBarProps {
  clientes: Cliente[];
  mesesCols?: string[];
}

const KPIBar: React.FC<KPIBarProps> = ({ clientes, mesesCols }) => {
  const total = clientes.length;

  // Fat_Total is ALWAYS the full total, never filtered by period
  const fatTotal = useMemo(() => {
    return clientes.reduce((s, c) => s + c.Fat_Total, 0);
  }, [clientes]);

  // Period-filtered total for comparative metrics only
  const fatPeriodo = useMemo(() => {
    if (!mesesCols || mesesCols.length === 0) return fatTotal;
    return clientes.reduce((s, c) => {
      return s + mesesCols.reduce((ms, m) => ms + (c.meses[m] || 0), 0);
    }, 0);
  }, [clientes, mesesCols, fatTotal]);

  const tmMesAvg = useMemo(() => {
    if (!mesesCols || mesesCols.length === 0 || total === 0)
      return total ? clientes.reduce((s, c) => s + c.TM_Mes, 0) / total : 0;
    return total ? fatPeriodo / mesesCols.length / total : 0;
  }, [clientes, mesesCols, fatPeriodo, total]);

  // Positivados: clientes com valor > 0 em algum mês do período
  const positivados = useMemo(() => {
    if (!mesesCols || mesesCols.length === 0) return clientes.filter(c => c.Fat_Total > 0).length;
    return clientes.filter(c => mesesCols.some(m => (c.meses[m] || 0) > 0)).length;
  }, [clientes, mesesCols]);

  // Quantidade de meses no período selecionado
  const qtdMeses = useMemo(() => {
    if (!mesesCols || mesesCols.length === 0) return 1;
    return mesesCols.length;
  }, [mesesCols]);

  // TM/Mês Positivados: Fat período ÷ meses ÷ quantidade de positivados
  const tmPosAvg = useMemo(() => {
    return positivados > 0 ? fatPeriodo / qtdMeses / positivados : 0;
  }, [fatPeriodo, positivados, qtdMeses]);

  // TM_Mes médio original (para % realizado)
  const tmMesOrigAvg = useMemo(() => {
    return total > 0 ? clientes.reduce((s, c) => s + c.TM_Mes, 0) / total : 0;
  }, [clientes, total]);

  // % Realizado vs TM Geral (fat período ÷ meses ÷ clientes vs TM médio)
  const pctRealizadoTMGeral = useMemo(() => {
    return tmMesOrigAvg > 0 ? (tmMesAvg / tmMesOrigAvg) * 100 : 0;
  }, [tmMesAvg, tmMesOrigAvg]);

  // % Realizado vs TM Positivados
  const pctRealizadoTMPos = useMemo(() => {
    return tmMesOrigAvg > 0 ? (tmPosAvg / tmMesOrigAvg) * 100 : 0;
  }, [tmPosAvg, tmMesOrigAvg]);

  // % Realizado vs Objetivo: fat período ÷ (Objetivo × meses)
  const pctRealizadoObj = useMemo(() => {
    const comObj = clientes.filter(c => c.Objetivo_R$ > 0);
    if (comObj.length === 0) return 0;
    const soma = comObj.reduce((s, c) => {
      const fatCliente = mesesCols && mesesCols.length > 0
        ? mesesCols.reduce((ms, m) => ms + (c.meses[m] || 0), 0)
        : c.Fat_Total;
      return s + (fatCliente / (c.Objetivo_R$ * qtdMeses));
    }, 0);
    return (soma / comObj.length) * 100;
  }, [clientes, mesesCols, qtdMeses]);

  const ativos = clientes.filter(c => c.Status === "Ativo").length;
  const risco = clientes.filter(c => c.Status === "Risco").length;
  const inativos = clientes.filter(c => c.Status === "Inativo").length;
  const estaSemana = clientes.filter(c => c.Status === "Ativo" && c.Dias_Para_Acao >= 0 && c.Dias_Para_Acao <= 7).length;

  const fmtPct = (v: number) => `${v.toFixed(1)}%`;

  const row1 = [
    { label: "Clientes", value: String(total), cls: "" },
    { label: "Fat. Total", value: fmtBRL(fatTotal), cls: "" },
    { label: "TM/Mês médio", value: fmtBRL(tmMesAvg), cls: "" },
    { label: "Ativos", value: String(ativos), cls: "badge-active" },
    { label: "Risco", value: String(risco), cls: "badge-risk" },
    { label: "Inativos", value: String(inativos), cls: "badge-inactive" },
    
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
      {renderRow(row2, "grid-cols-3 sm:grid-cols-5 lg:grid-cols-9")}
    </div>
  );
};

export default KPIBar;
