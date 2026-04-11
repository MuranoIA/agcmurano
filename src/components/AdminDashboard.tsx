import React, { useMemo } from "react";
import { useAppData } from "@/contexts/AppDataContext";
import { VENDEDORES } from "@/lib/types";
import { fmtBRL } from "@/lib/format";
import StatusBadge from "./StatusBadge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const AdminDashboard: React.FC = () => {
  const { clientes, mesesCols, visitas } = useAppData();

  const vendorStats = useMemo(() => {
    return VENDEDORES.map(v => {
      const vClientes = clientes.filter(c => c.Vendedor === v);
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const visitasNoMes = visitas.filter(vis => {
        if (vis.vendedor !== v) return false;
        const parts = vis.data.split("/");
        if (parts.length !== 3) return false;
        return parseInt(parts[1]) === currentMonth && parseInt(parts[2]) === currentYear;
      });
      return {
        nome: v,
        total: vClientes.length,
        fatTotal: vClientes.reduce((s, c) => s + c.Fat_Total, 0),
        ativos: vClientes.filter(c => c.Status === "Ativo").length,
        risco: vClientes.filter(c => c.Status === "Risco").length,
        inativos: vClientes.filter(c => c.Status === "Inativo").length,
        visitasMes: visitasNoMes.length,
        tmMesAvg: vClientes.length > 0 ? vClientes.reduce((s, c) => s + c.TM_Mes, 0) / vClientes.length : 0,
      };
    });
  }, [clientes, visitas]);

  // Chart data: last 6 months faturamento per vendor
  const chartData = useMemo(() => {
    const last6 = mesesCols.slice(-6);
    return last6.map(mes => {
      const entry: Record<string, any> = { mes };
      VENDEDORES.forEach(v => {
        entry[v] = clientes
          .filter(c => c.Vendedor === v)
          .reduce((s, c) => s + (c.meses[mes] || 0), 0);
      });
      return entry;
    });
  }, [clientes, mesesCols]);

  // Alerts
  const alerts = useMemo(() => {
    const now = new Date();
    const fifteenDaysAgo = new Date(now);
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    const riscoSemVisita = clientes.filter(c => {
      if (c.Status !== "Risco") return false;
      const recentVisit = visitas.some(v => {
        if (v.codigo !== c.Codigo) return false;
        const parts = v.data.split("/");
        if (parts.length !== 3) return false;
        const visitDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        return visitDate >= fifteenDaysAgo;
      });
      return !recentVisit;
    });

    const inativosSemContato = clientes.filter(c => {
      if (c.Status !== "Inativo") return false;
      const hasVisit = visitas.some(v => v.codigo === c.Codigo);
      return !hasVisit;
    });

    return { riscoSemVisita, inativosSemContato };
  }, [clientes, visitas]);

  const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--secondary))"];

  return (
    <div className="space-y-4">
      {/* Cards per vendor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {vendorStats.map(vs => (
          <div key={vs.nome} className="bg-card rounded-lg shadow-sm border p-4">
            <h4 className="font-semibold text-sm mb-2">{vs.nome}</h4>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span className="text-muted-foreground">Clientes:</span><span className="font-medium">{vs.total}</span>
              <span className="text-muted-foreground">Fat. Total:</span><span className="font-medium">{fmtBRL(vs.fatTotal)}</span>
              <span className="text-muted-foreground">Ativos:</span><span className="font-medium text-status-active">{vs.ativos}</span>
              <span className="text-muted-foreground">Risco:</span><span className="font-medium text-status-risk">{vs.risco}</span>
              <span className="text-muted-foreground">Inativos:</span><span className="font-medium text-status-inactive">{vs.inativos}</span>
              <span className="text-muted-foreground">Visitas/mês:</span><span className="font-medium">{vs.visitasMes}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-card rounded-lg shadow-sm border p-4">
          <h4 className="font-semibold text-sm mb-3">Faturamento por Vendedor (últimos 6 meses)</h4>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtBRL(v)} />
              <Legend />
              {VENDEDORES.map((v, i) => (
                <Bar key={v} dataKey={v} fill={COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Performance table */}
      <div className="bg-card rounded-lg shadow-sm border p-4">
        <h4 className="font-semibold text-sm mb-3">Tabela Comparativa</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left">Vendedor</th>
                <th className="px-3 py-2 text-right">Ativos</th>
                <th className="px-3 py-2 text-right">Risco</th>
                <th className="px-3 py-2 text-right">Inativos</th>
                <th className="px-3 py-2 text-right">Fat. Total</th>
                <th className="px-3 py-2 text-right">TM/Mês Médio</th>
                <th className="px-3 py-2 text-right">Visitas/Mês</th>
              </tr>
            </thead>
            <tbody>
              {vendorStats.map((vs, i) => (
                <tr key={vs.nome} className={i % 2 ? "bg-muted/10" : ""}>
                  <td className="px-3 py-2 font-medium">{vs.nome}</td>
                  <td className="px-3 py-2 text-right">{vs.ativos}</td>
                  <td className="px-3 py-2 text-right">{vs.risco}</td>
                  <td className="px-3 py-2 text-right">{vs.inativos}</td>
                  <td className="px-3 py-2 text-right">{fmtBRL(vs.fatTotal)}</td>
                  <td className="px-3 py-2 text-right">{fmtBRL(vs.tmMesAvg)}</td>
                  <td className="px-3 py-2 text-right">{vs.visitasMes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts */}
      {(alerts.riscoSemVisita.length > 0 || alerts.inativosSemContato.length > 0) && (
        <div className="bg-card rounded-lg shadow-sm border p-4 space-y-3">
          <h4 className="font-semibold text-sm">⚠️ Alertas</h4>
          {alerts.riscoSemVisita.length > 0 && (
            <div>
              <p className="text-xs font-medium text-status-risk mb-1">Clientes em risco sem visita nos últimos 15 dias ({alerts.riscoSemVisita.length}):</p>
              <div className="flex flex-wrap gap-1">
                {alerts.riscoSemVisita.slice(0, 10).map(c => (
                  <span key={c.Codigo} className="text-xs bg-destructive/10 text-destructive rounded px-2 py-0.5">{c.Nome} ({c.Vendedor || "—"})</span>
                ))}
                {alerts.riscoSemVisita.length > 10 && <span className="text-xs text-muted-foreground">+{alerts.riscoSemVisita.length - 10} mais</span>}
              </div>
            </div>
          )}
          {alerts.inativosSemContato.length > 0 && (
            <div>
              <p className="text-xs font-medium text-status-inactive mb-1">Clientes inativos sem contato ({alerts.inativosSemContato.length}):</p>
              <div className="flex flex-wrap gap-1">
                {alerts.inativosSemContato.slice(0, 10).map(c => (
                  <span key={c.Codigo} className="text-xs bg-muted rounded px-2 py-0.5">{c.Nome} ({c.Vendedor || "—"})</span>
                ))}
                {alerts.inativosSemContato.length > 10 && <span className="text-xs text-muted-foreground">+{alerts.inativosSemContato.length - 10} mais</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
