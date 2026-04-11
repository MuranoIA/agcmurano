import React, { useState, useMemo } from "react";
import { Cliente, VENDEDORES } from "@/lib/types";
import { fmtBRL } from "@/lib/format";
import StatusBadge from "./StatusBadge";
import { Button } from "@/components/ui/button";

interface Props {
  clientes: Cliente[];
}

const RankingTab: React.FC<Props> = ({ clientes }) => {
  const [vendedor, setVendedor] = useState("Todos");
  const [status, setStatus] = useState("Todos");

  const filtered = useMemo(() => {
    let list = clientes;
    if (vendedor !== "Todos") list = list.filter(c => c.Vendedor === vendedor);
    if (status !== "Todos") list = list.filter(c => c.Status === status);
    return [...list].sort((a, b) => b.Fat_Total - a.Fat_Total);
  }, [clientes, vendedor, status]);

  const top1 = filtered[0];
  const maiorTM = filtered.length > 0 ? filtered.reduce((best, c) => c.TM_Mes > best.TM_Mes ? c : best, filtered[0]) : null;
  const maisPedidos = filtered.length > 0 ? filtered.reduce((best, c) => c.N_Pedidos > best.N_Pedidos ? c : best, filtered[0]) : null;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card rounded-lg shadow-sm border p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">🥇 1º Colocado</div>
          <div className="text-sm font-semibold truncate">{top1?.Nome || "—"}</div>
          <div className="text-xs text-muted-foreground">{top1 ? fmtBRL(top1.Fat_Total) : ""}</div>
        </div>
        <div className="bg-card rounded-lg shadow-sm border p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">Maior TM/Mês</div>
          <div className="text-sm font-semibold truncate">{maiorTM?.Nome || "—"}</div>
          <div className="text-xs text-muted-foreground">{maiorTM ? fmtBRL(maiorTM.TM_Mes) : ""}</div>
        </div>
        <div className="bg-card rounded-lg shadow-sm border p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">Mais Pedidos</div>
          <div className="text-sm font-semibold truncate">{maisPedidos?.Nome || "—"}</div>
          <div className="text-xs text-muted-foreground">{maisPedidos ? `${maisPedidos.N_Pedidos} pedidos` : ""}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          {["Todos", ...VENDEDORES].map(v => (
            <Button key={v} size="sm" variant={vendedor === v ? "default" : "outline"} onClick={() => setVendedor(v)} className="text-xs">{v}</Button>
          ))}
        </div>
        <div className="flex gap-1">
          {["Todos", "Ativo", "Risco", "Inativo"].map(s => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)} className="text-xs">{s}</Button>
          ))}
        </div>
      </div>

      {/* Ranking table */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-3 py-2 text-center w-12">#</th>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left w-24">Vendedor</th>
              <th className="px-3 py-2 text-center w-20">Status</th>
              <th className="px-3 py-2 text-right w-28">Fat. Total</th>
              <th className="px-3 py-2 text-right w-24">TM/Mês</th>
              <th className="px-3 py-2 text-right w-20">Pedidos</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.Codigo} className={`${i % 2 ? "bg-muted/10" : ""} ${i < 3 ? "font-semibold" : ""}`}>
                <td className="px-3 py-2 text-center">{i + 1}º</td>
                <td className="px-3 py-2 truncate max-w-[250px]">{c.Nome}</td>
                <td className="px-3 py-2">{c.Vendedor || "—"}</td>
                <td className="px-3 py-2 text-center"><StatusBadge status={c.Status} /></td>
                <td className="px-3 py-2 text-right">{fmtBRL(c.Fat_Total)}</td>
                <td className="px-3 py-2 text-right">{fmtBRL(c.TM_Mes)}</td>
                <td className="px-3 py-2 text-right">{c.N_Pedidos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RankingTab;
