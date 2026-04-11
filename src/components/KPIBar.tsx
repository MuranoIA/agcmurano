import React from "react";
import { fmtBRL } from "@/lib/format";
import { Cliente } from "@/lib/types";

interface KPIBarProps {
  clientes: Cliente[];
}

const KPIBar: React.FC<KPIBarProps> = ({ clientes }) => {
  const total = clientes.length;
  const fatTotal = clientes.reduce((s, c) => s + c.Fat_Total, 0);
  const tmMesAvg = total ? clientes.reduce((s, c) => s + c.TM_Mes, 0) / total : 0;
  const ativos = clientes.filter(c => c.Status === "Ativo").length;
  const risco = clientes.filter(c => c.Status === "Risco").length;
  const inativos = clientes.filter(c => c.Status === "Inativo").length;
  const estaSemana = clientes.filter(c => c.Dias_Para_Acao >= 0 && c.Dias_Para_Acao <= 7).length;

  const cards = [
    { label: "Clientes", value: String(total), cls: "" },
    { label: "Fat. Total", value: fmtBRL(fatTotal), cls: "" },
    { label: "TM/Mês médio", value: fmtBRL(tmMesAvg), cls: "" },
    { label: "Ativos", value: String(ativos), cls: "badge-active" },
    { label: "Risco", value: String(risco), cls: "badge-risk" },
    { label: "Inativos", value: String(inativos), cls: "badge-inactive" },
    { label: "Esta semana", value: String(estaSemana), cls: "text-primary font-bold" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
      {cards.map(c => (
        <div key={c.label} className="bg-card rounded-lg shadow-sm border p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
          <div className={`text-lg font-semibold ${c.cls}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
};

export default KPIBar;
