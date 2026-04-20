import React from "react";
import { Cliente } from "@/lib/types";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { fmtBRL } from "@/lib/format";
import StatusBadge from "./StatusBadge";
import { AlertTriangle, Users, XCircle } from "lucide-react";

interface Props {
  clientes: Cliente[];
  mesesCols?: string[];
}

const VisaoGeral: React.FC<Props> = ({ clientes, mesesCols }) => {
  const vendedorStats = VENDEDORES.map(v => {
    const list = clientes.filter(c => c.Vendedor === v);
    const fatTotal = mesesCols && mesesCols.length > 0
      ? list.reduce((s, c) => s + mesesCols.reduce((ms, m) => ms + (c.meses[m] || 0), 0), 0)
      : list.reduce((s, c) => s + c.Fat_Total, 0);
    const tmMesAvg = mesesCols && mesesCols.length > 0 && list.length
      ? fatTotal / mesesCols.length / list.length
      : list.length ? list.reduce((s, c) => s + c.TM_Mes, 0) / list.length : 0;
    return {
      nome: v,
      total: list.length,
      fatTotal,
      ativos: list.filter(c => c.Status === "Ativo").length,
      risco: list.filter(c => c.Status === "Risco").length,
      inativos: list.filter(c => c.Status === "Inativo").length,
      tmMesAvg,
    };
  });

  const alertasRisco = clientes.filter(c => c.Status === "Risco" && c.Dias_Sem_Compra > 30);
  const alertasInativos = clientes.filter(c => c.Status === "Inativo");

  return (
    <div className="space-y-6">
      {/* Cards por vendedor */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {vendedorStats.map(v => (
          <div key={v.nome} className="bg-card rounded-lg shadow-sm border p-4">
            <div className="text-sm font-semibold mb-2">{v.nome}</div>
            <div className="grid grid-cols-2 gap-y-1 text-xs">
              <span className="text-muted-foreground">Clientes</span>
              <span className="text-right font-medium">{v.total}</span>
              <span className="text-muted-foreground">Fat. Total</span>
              <span className="text-right font-medium">{fmtBRL(v.fatTotal)}</span>
              <span className="text-muted-foreground">Ativos</span>
              <span className="text-right font-medium text-green-600">{v.ativos}</span>
              <span className="text-muted-foreground">Risco</span>
              <span className="text-right font-medium text-yellow-600">{v.risco}</span>
              <span className="text-muted-foreground">Inativos</span>
              <span className="text-right font-medium text-red-600">{v.inativos}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabela comparativa */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Vendedor</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Clientes</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Ativos</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Risco</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Inativos</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Fat. Total</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">TM/Mês médio</th>
            </tr>
          </thead>
          <tbody>
            {vendedorStats.map((v, i) => (
              <tr key={v.nome} className={i % 2 ? "bg-muted/10" : ""}>
                <td className="px-3 py-2 font-medium">{v.nome}</td>
                <td className="px-3 py-2 text-right">{v.total}</td>
                <td className="px-3 py-2 text-right text-green-600">{v.ativos}</td>
                <td className="px-3 py-2 text-right text-yellow-600">{v.risco}</td>
                <td className="px-3 py-2 text-right text-red-600">{v.inativos}</td>
                <td className="px-3 py-2 text-right font-medium">{fmtBRL(v.fatTotal)}</td>
                <td className="px-3 py-2 text-right">{fmtBRL(v.tmMesAvg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risco */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-yellow-600" />
            <span className="text-sm font-semibold">Clientes em Risco (sem compra há +30 dias)</span>
            <span className="text-xs text-muted-foreground">({alertasRisco.length})</span>
          </div>
          {alertasRisco.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum alerta</p>
          ) : (
            <div className="max-h-52 overflow-y-auto space-y-1">
              {alertasRisco.map(c => (
                <div key={c.Codigo} className="flex items-center justify-between text-xs border-b py-1.5 last:border-0">
                  <div>
                    <span className="font-medium">{c.Nome}</span>
                    <span className="text-muted-foreground ml-2">({c.Vendedor || "—"})</span>
                  </div>
                  <span className="text-yellow-600 font-medium">{c.Dias_Sem_Compra}d sem compra</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inativos */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <XCircle size={16} className="text-red-600" />
            <span className="text-sm font-semibold">Clientes Inativos</span>
            <span className="text-xs text-muted-foreground">({alertasInativos.length})</span>
          </div>
          {alertasInativos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum alerta</p>
          ) : (
            <div className="max-h-52 overflow-y-auto space-y-1">
              {alertasInativos.map(c => (
                <div key={c.Codigo} className="flex items-center justify-between text-xs border-b py-1.5 last:border-0">
                  <div>
                    <span className="font-medium">{c.Nome}</span>
                    <span className="text-muted-foreground ml-2">({c.Vendedor || "—"})</span>
                  </div>
                  <span className="text-red-600 font-medium">{c.Dias_Sem_Compra}d sem compra</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisaoGeral;
