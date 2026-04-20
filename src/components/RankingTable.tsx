import React, { useState, useMemo } from "react";
import { Cliente } from "@/lib/types";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { fmtBRL } from "@/lib/format";
import StatusBadge from "./StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, TrendingUp, ShoppingCart } from "lucide-react";

interface Props {
  clientes: Cliente[];
}

const RankingTable: React.FC<Props> = ({ clientes }) => {
  const { vendedores: vendedoresList } = useEmpresa();
  const [vendedor, setVendedor] = useState("Todos");
  const [status, setStatus] = useState("Todos");

  const filtered = useMemo(() => {
    let list = clientes;
    if (vendedor !== "Todos") list = list.filter(c => c.Vendedor === vendedor);
    if (status !== "Todos") list = list.filter(c => c.Status === status);
    return [...list].sort((a, b) => b.Fat_Total - a.Fat_Total);
  }, [clientes, vendedor, status]);

  const topFat = filtered[0] || null;
  const topTM = filtered.length ? [...filtered].sort((a, b) => b.TM_Mes - a.TM_Mes)[0] : null;
  const topPedidos = filtered.length ? [...filtered].sort((a, b) => b.N_Pedidos - a.N_Pedidos)[0] : null;

  const cards = [
    { icon: Trophy, label: "Maior Faturamento", name: topFat?.Nome || "—", value: topFat ? fmtBRL(topFat.Fat_Total) : "—", color: "text-yellow-600" },
    { icon: TrendingUp, label: "Maior TM/Mês", name: topTM?.Nome || "—", value: topTM ? fmtBRL(topTM.TM_Mes) : "—", color: "text-primary" },
    { icon: ShoppingCart, label: "Mais Pedidos", name: topPedidos?.Nome || "—", value: topPedidos ? String(topPedidos.N_Pedidos) : "—", color: "text-green-600" },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Vendedor:</span>
          <Select value={vendedor} onValueChange={setVendedor}>
            <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {vendedoresList.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Todos", "Ativo", "Risco", "Inativo"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {cards.map(c => (
          <div key={c.label} className="bg-card rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 mb-1">
              <c.icon size={16} className={c.color} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
            <div className="text-sm font-semibold truncate">{c.name}</div>
            <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-3 py-2 text-center w-16 font-medium text-muted-foreground">#</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nome</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Vendedor</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">TM/Mês</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Fat. Total</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">N. Pedidos</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.Codigo} className={i % 2 ? "bg-muted/10" : ""}>
                <td className="px-3 py-2 text-center font-bold text-muted-foreground">{i + 1}º</td>
                <td className="px-3 py-2 font-medium truncate max-w-[200px]">{c.Nome}</td>
                <td className="px-3 py-2">{c.Vendedor || "—"}</td>
                <td className="px-3 py-2"><StatusBadge status={c.Status} /></td>
                <td className="px-3 py-2 text-right">{fmtBRL(c.TM_Mes)}</td>
                <td className="px-3 py-2 text-right font-medium">{fmtBRL(c.Fat_Total)}</td>
                <td className="px-3 py-2 text-right">{c.N_Pedidos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RankingTable;
