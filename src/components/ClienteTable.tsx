import React, { useState, useMemo } from "react";
import { Cliente } from "@/lib/types";
import { useAppData } from "@/contexts/AppDataContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { fmtBRL, fmtBRLShort } from "@/lib/format";
import StatusBadge from "./StatusBadge";
import TagRCA2 from "./TagRCA2";
import ModalCadastrarLocalizacao from "./ModalCadastrarLocalizacao";
import { ArrowUpDown } from "lucide-react";

interface Props {
  clientes: Cliente[];
  onSelect: (c: Cliente) => void;
}

type SortKey = keyof Cliente | "lastMonth";

const ClienteTable: React.FC<Props> = ({ clientes, onSelect }) => {
  const { mesesCols, setVendedor, rcaInfo, clientesComLocalizacao } = useAppData();
  const { vendedores } = useEmpresa();
  const lastMonth = mesesCols[mesesCols.length - 1] || "";
  const [sortKey, setSortKey] = useState<SortKey>("Fat_Total");
  const [sortAsc, setSortAsc] = useState(false);
  const [cadastroLoc, setCadastroLoc] = useState<Cliente | null>(null);

  const sorted = useMemo(() => {
    return [...clientes].sort((a, b) => {
      let va: any, vb: any;
      if (sortKey === "lastMonth") {
        va = a.meses[lastMonth] || 0; vb = b.meses[lastMonth] || 0;
      } else {
        va = a[sortKey]; vb = b[sortKey];
      }
      if (typeof va === "string") return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? va - vb : vb - va;
    });
  }, [clientes, sortKey, sortAsc, lastMonth]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const headers: { key: SortKey; label: string; w?: string }[] = [
    { key: "Codigo", label: "Cod.", w: "w-20" },
    { key: "Nome", label: "Nome", w: "w-48" },
    { key: "Vendedor", label: "RCA", w: "w-28" },
    { key: "Status", label: "Status", w: "w-24" },
    { key: "Ciclo_Medio_d", label: "Ciclo", w: "w-20" },
    { key: "TM_Mes", label: "TM/Mês", w: "w-28" },
    { key: "Objetivo_R$", label: "Objetivo", w: "w-28" },
    { key: "lastMonth", label: lastMonth, w: "w-28" },
    { key: "MCC", label: "MCC", w: "w-16" },
    { key: "Dias_Sem_Compra", label: "DSC", w: "w-20" },
    { key: "Proxima_Acao", label: "Próx. Ação", w: "w-36" },
    { key: "Fat_Total", label: "Fat. Total", w: "w-28" },
  ];

  const handleVendedorChange = (codigo: string, v: string) => {
    setVendedor(codigo, v);
  };

  const temLocalizacao = (codigo: string) => clientesComLocalizacao.has(Number(codigo));

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            {headers.map(h => (
              <th key={h.key} className={`px-3 py-2 text-left font-medium text-muted-foreground cursor-pointer select-none ${h.w || ""}`} onClick={() => toggleSort(h.key)}>
                <span className="flex items-center gap-1">{h.label} <ArrowUpDown size={12} /></span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, i) => (
            <tr key={c.Codigo} className={`cursor-pointer hover:bg-muted/30 ${i % 2 ? "bg-muted/10" : ""}`} onClick={() => onSelect(c)}>
              <td className="px-3 py-2 font-mono text-xs">{c.Codigo}</td>
              <td className="px-3 py-2 font-medium max-w-[200px]">
                <div className="min-w-0">
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="truncate text-sm">{c.Nome}</span>
                    <TagRCA2 info={rcaInfo[c.Codigo]} />
                    {temLocalizacao(c.Codigo) && (
                      <span className="shrink-0 text-[9px] text-green-600" title="Localização cadastrada">📍</span>
                    )}
                  </span>
                  {!temLocalizacao(c.Codigo) && (
                    <div>
                      <button
                        onClick={e => { e.stopPropagation(); setCadastroLoc(c); }}
                        className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full hover:bg-amber-200 cursor-pointer"
                        title="Cadastrar as coordenadas deste cliente"
                      >
                        📍 Cadastrar localização
                      </button>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                {c.Vendedor ? (
                  <span className="text-sm">{c.Vendedor}</span>
                ) : (
                  <select className="border rounded px-1 py-0.5 text-xs bg-card" onChange={e => handleVendedorChange(c.Codigo, e.target.value)} defaultValue="">
                    <option value="" disabled>Atribuir</option>
                    {vendedores.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                )}
              </td>
              <td className="px-3 py-2"><StatusBadge status={c.Status} /></td>
              <td className="px-3 py-2 text-right">{c.Ciclo_Medio_d}</td>
              <td className="px-3 py-2 text-right">{fmtBRL(c.TM_Mes)}</td>
              <td className="px-3 py-2 text-right">{c.Objetivo_R$ ? fmtBRL(c.Objetivo_R$) : "—"}</td>
              <td className="px-3 py-2 text-right">{fmtBRLShort(c.meses[lastMonth] || 0)}</td>
              <td className="px-3 py-2 text-center">{c.MCC}</td>
              <td className="px-3 py-2 text-right">{c.Dias_Sem_Compra}</td>
              <td className="px-3 py-2 text-xs">
                <span className={c.Status === "Inativo" ? "text-status-inactive" : c.Status === "Risco" ? "text-status-risk" : "text-status-active"}>
                  {c.Proxima_Acao}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-medium">{fmtBRL(c.Fat_Total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {cadastroLoc && (
        <ModalCadastrarLocalizacao
          open
          onOpenChange={aberto => { if (!aberto) setCadastroLoc(null); }}
          codCliente={Number(cadastroLoc.Codigo)}
          nomeCliente={cadastroLoc.Nome}
        />
      )}
    </div>
  );
};

export default ClienteTable;
