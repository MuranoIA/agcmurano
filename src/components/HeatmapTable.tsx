import React, { useState, useMemo } from "react";
import { Cliente } from "@/lib/types";
import { useAppData } from "@/contexts/AppDataContext";
import { heatmapColor } from "@/lib/heatmapColors";
import { fmtBRLShort } from "@/lib/format";
import { Pencil, Check } from "lucide-react";

interface Props {
  clientes: Cliente[];
}

type HeatmapFilter = "Todos" | "Com compra" | "Sem compra" | "Abaixo do TM" | "Acima do TM";
const FILTER_OPTIONS: HeatmapFilter[] = ["Todos", "Com compra", "Sem compra", "Abaixo do TM", "Acima do TM"];

const HeatmapTable: React.FC<Props> = ({ clientes }) => {
  const { mesesCols, overlay, setValorMes } = useAppData();
  const lastMonth = mesesCols[mesesCols.length - 1] || "";
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [monthFilters, setMonthFilters] = useState<Record<string, HeatmapFilter>>({});

  const commitEdit = (codigo: string) => {
    const val = parseFloat(editValue.replace(",", ".")) || 0;
    setValorMes(codigo, lastMonth, val);
    setEditingCell(null);
  };

  const filtered = useMemo(() => {
    const activeFilters = Object.entries(monthFilters).filter(([, v]) => v !== "Todos");
    if (activeFilters.length === 0) return clientes;
    return clientes.filter(c => {
      return activeFilters.every(([mes, filter]) => {
        const val = c.meses[mes] || 0;
        switch (filter) {
          case "Com compra": return val > 0;
          case "Sem compra": return val === 0;
          case "Abaixo do TM": return val > 0 && val < c.TM_Mes;
          case "Acima do TM": return val >= c.TM_Mes;
          default: return true;
        }
      });
    });
  }, [clientes, monthFilters]);

  return (
    <div className="space-y-2">
      {/* Month filters */}
      <div className="flex flex-wrap gap-2 items-center text-xs">
        <span className="text-muted-foreground font-medium">Filtros:</span>
        {mesesCols.map(m => (
          <select
            key={m}
            className="border rounded px-1.5 py-1 text-xs bg-card"
            value={monthFilters[m] || "Todos"}
            onChange={e => setMonthFilters(prev => ({ ...prev, [m]: e.target.value as HeatmapFilter }))}
          >
            {FILTER_OPTIONS.map(o => (
              <option key={o} value={o}>{m}: {o}</option>
            ))}
          </select>
        ))}
        {Object.values(monthFilters).some(v => v !== "Todos") && (
          <button className="text-xs text-primary underline" onClick={() => setMonthFilters({})}>Limpar filtros</button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-20 bg-muted/50 px-3 py-2 text-left min-w-[80px]">Código</th>
              <th className="sticky left-[80px] z-20 bg-muted/50 px-3 py-2 text-left min-w-[180px]">Nome</th>
              <th className="sticky left-[260px] z-20 bg-muted/50 px-3 py-2 text-right min-w-[90px]">TM/Mês</th>
              {mesesCols.map(m => (
                <th key={m} className="px-2 py-2 text-center min-w-[80px] font-medium">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.Codigo} className={i % 2 ? "bg-muted/5" : ""}>
                <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-mono border-r">{c.Codigo}</td>
                <td className="sticky left-[80px] z-10 bg-card px-3 py-1.5 font-medium truncate max-w-[180px] border-r">{c.Nome}</td>
                <td className="sticky left-[260px] z-10 bg-card px-3 py-1.5 text-right border-r">{fmtBRLShort(c.TM_Mes)}</td>
                {mesesCols.map(m => {
                  const val = c.meses[m] || 0;
                  const { bg, fg } = heatmapColor(val, c.TM_Mes);
                  const isLast = m === lastMonth;
                  const isEdited = !!overlay.valores_mes[c.Codigo]?.[m];
                  const cellKey = `${c.Codigo}-${m}`;
                  return (
                    <td
                      key={m}
                      className="px-1 py-1.5 text-center cursor-pointer"
                      style={{ backgroundColor: bg, color: fg }}
                      onClick={() => {
                        if (isLast) {
                          setEditingCell(cellKey);
                          setEditValue(String(val || ""));
                        }
                      }}
                    >
                      {editingCell === cellKey ? (
                        <span className="flex items-center justify-center gap-0.5">
                          <input
                            autoFocus
                            className="w-14 text-center text-xs border rounded bg-card text-foreground"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => commitEdit(c.Codigo)}
                            onKeyDown={e => e.key === "Enter" && commitEdit(c.Codigo)}
                          />
                          <button
                            className="p-0.5 rounded hover:bg-primary/20"
                            onMouseDown={e => { e.preventDefault(); commitEdit(c.Codigo); }}
                          >
                            <Check size={12} className="text-primary" />
                          </button>
                        </span>
                      ) : val > 0 ? (
                        <span className="flex items-center justify-center gap-0.5">
                          {fmtBRLShort(val)}
                          {isEdited && <Pencil size={8} />}
                        </span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HeatmapTable;
