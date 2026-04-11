import React, { useState, useMemo } from "react";
import { Cliente } from "@/lib/types";
import { useAppData } from "@/contexts/AppDataContext";
import { heatmapColor } from "@/lib/heatmapColors";
import { fmtBRLShort } from "@/lib/format";
import { Pencil, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  clientes: Cliente[];
}

const HeatmapTable: React.FC<Props> = ({ clientes }) => {
  const { mesesCols, overlay, setValorMes } = useAppData();
  const lastMonth = mesesCols[mesesCols.length - 1] || "";
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [filterMes, setFilterMes] = useState("Todos");
  const [filterCondicao, setFilterCondicao] = useState("Todos");

  const commitEdit = (codigo: string) => {
    const val = parseFloat(editValue.replace(",", ".")) || 0;
    setValorMes(codigo, lastMonth, val);
    setEditingCell(null);
  };

  const filtered = useMemo(() => {
    if (filterMes === "Todos" || filterCondicao === "Todos") return clientes;
    return clientes.filter(c => {
      const val = c.meses[filterMes] || 0;
      switch (filterCondicao) {
        case "Com compra": return val > 0;
        case "Sem compra": return val === 0;
        case "Abaixo do TM": return val < c.TM_Mes;
        case "Acima do TM": return val >= c.TM_Mes;
        default: return true;
      }
    });
  }, [clientes, filterMes, filterCondicao]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Mês:</span>
          <Select value={filterMes} onValueChange={setFilterMes}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos os meses</SelectItem>
              {mesesCols.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Condição:</span>
          <Select value={filterCondicao} onValueChange={setFilterCondicao}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Todos", "Com compra", "Sem compra", "Abaixo do TM", "Acima do TM"].map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
                          <button onClick={e => { e.stopPropagation(); commitEdit(c.Codigo); }} className="text-green-600 hover:text-green-800" title="Confirmar">
                            <Check size={12} />
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
