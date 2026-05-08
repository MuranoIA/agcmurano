import React, { useState, useMemo } from "react";
import { Cliente } from "@/lib/types";
import { useAppData } from "@/contexts/AppDataContext";
import { heatmapColor } from "@/lib/heatmapColors";
import { fmtBRLShort } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  clientes: Cliente[];
  mesesCols?: string[];
}

const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmtMesCol = (d: Date) => `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;

const HeatmapTable: React.FC<Props> = ({ clientes, mesesCols: mesesColsProp }) => {
  const ctx = useAppData();
  const [filterMes, setFilterMes] = useState("Todos");
  const [filterCondicao, setFilterCondicao] = useState("Todos");

  // Build months strictly from the De/Até period
  const mesesCols = useMemo(() => {
    if (mesesColsProp && mesesColsProp.length > 0) return mesesColsProp;
    const from = ctx.periodFrom;
    const to = ctx.periodTo;
    if (!from || !to) return ctx.mesesCols;
    const cols: string[] = [];
    const cur = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cur <= end) {
      cols.push(fmtMesCol(cur));
      cur.setMonth(cur.getMonth() + 1);
    }
    return cols;
  }, [mesesColsProp, ctx.periodFrom, ctx.periodTo, ctx.mesesCols]);

  // Period-scoped values (c.meses already filtered by the period in AppDataContext)
  const valOf = (c: Cliente, m: string) => c.meses[m] || 0;

  const filtered = useMemo(() => {
    if (filterMes === "Todos" || filterCondicao === "Todos") return clientes;
    return clientes.filter(c => {
      const val = valOf(c, filterMes);
      switch (filterCondicao) {
        case "Com compra":
        case "Positivados": return val > 0;
        case "Sem compra":
        case "Não positivados": return val === 0;
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
              {["Todos", "Positivados", "Não positivados", "Abaixo do TM", "Acima do TM"].map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div
        className="overflow-auto rounded-lg border bg-card max-h-[70vh] relative"
        style={{ contain: "paint" }}
      >
        <table className="text-xs border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 bg-muted px-3 py-2 text-left min-w-[80px] border-b border-r">Código</th>
              <th className="sticky left-[80px] top-0 z-30 bg-muted px-3 py-2 text-left min-w-[180px] border-b border-r">Nome</th>
              <th className="sticky left-[260px] top-0 z-30 bg-muted px-3 py-2 text-right min-w-[90px] border-b border-r">TM/Mês</th>
              {mesesCols.map(m => (
                <th
                  key={m}
                  className={`sticky top-0 z-20 px-2 py-2 text-center min-w-[80px] font-medium border-b ${
                    filterMes === m ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const rowBg = i % 2 ? "bg-muted/5" : "bg-card";
              return (
                <tr key={c.Codigo}>
                  <td className={`sticky left-0 z-10 ${rowBg} px-3 py-1.5 font-mono border-r border-b`}>{c.Codigo}</td>
                  <td className={`sticky left-[80px] z-10 ${rowBg} px-3 py-1.5 font-medium truncate max-w-[180px] border-r border-b`}>{c.Nome}</td>
                  <td className={`sticky left-[260px] z-10 ${rowBg} px-3 py-1.5 text-right border-r border-b`}>{fmtBRLShort(c.TM_Mes)}</td>
                  {mesesCols.map(m => {
                    const val = valOf(c, m);
                    const { bg, fg } = heatmapColor(val, c.TM_Mes);
                    return (
                      <td
                        key={m}
                        className="px-1 py-1.5 text-center border-b"
                        style={{ backgroundColor: bg, color: fg }}
                      >
                        {val !== 0 ? fmtBRLShort(val) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky left-0 bottom-0 z-20 bg-muted px-3 py-2 border-r border-t-2 font-semibold" colSpan={2}>
                Total ({filtered.length} clientes)
              </td>
              <td className="sticky left-[260px] bottom-0 z-20 bg-muted px-3 py-2 text-right border-r border-t-2 font-semibold">
                {fmtBRLShort(filtered.reduce((s, c) => s + (c.TM_Mes || 0), 0) / (filtered.length || 1))}
              </td>
              {mesesCols.map(m => {
                const total = filtered.reduce((s, c) => s + valOf(c, m), 0);
                return (
                  <td key={m} className="sticky bottom-0 z-10 bg-muted px-1 py-2 text-center font-semibold border-t-2">
                    {total !== 0 ? fmtBRLShort(total) : "—"}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default HeatmapTable;
