import React from "react";
import { Cliente } from "@/lib/types";
import { fmtBRL } from "@/lib/format";
import { downloadFile, exportCSV } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import StatusBadge from "./StatusBadge";

interface Props {
  clientes: Cliente[];
}

interface Section {
  emoji: string;
  title: string;
  filter: (c: Cliente) => boolean;
  color: string;
}

const sections: Section[] = [
  { emoji: "🔴", title: "Reativação Crítica", filter: c => c.Status === "Inativo", color: "border-l-status-inactive" },
  { emoji: "🟠", title: "Contato Urgente", filter: c => c.Status === "Risco", color: "border-l-status-risk" },
  { emoji: "🟡", title: "Visitar Esta Semana", filter: c => c.Status === "Ativo" && c.Dias_Para_Acao >= 0 && c.Dias_Para_Acao <= 7, color: "border-l-yellow-500" },
  { emoji: "🟢", title: "Próximos 30 dias", filter: c => c.Status === "Ativo" && c.Dias_Para_Acao > 7 && c.Dias_Para_Acao <= 30, color: "border-l-status-active" },
];

const exportSection = (title: string, items: Cliente[]) => {
  const headers = ["Codigo", "Nome", "Vendedor", "Ciclo_Medio_d", "Dias_Sem_Compra", "TM_Mes", "Proxima_Acao"];
  const rows = items.map(c => [c.Codigo, c.Nome, c.Vendedor, String(c.Ciclo_Medio_d), String(c.Dias_Sem_Compra), String(c.TM_Mes), c.Proxima_Acao]);
  downloadFile(exportCSV(headers, rows), `agenda_${title.replace(/ /g, "_")}.csv`);
};

const AgendaVisitas: React.FC<Props> = ({ clientes }) => {
  return (
    <div className="space-y-3">
      {sections.map(sec => {
        const items = clientes.filter(sec.filter);
        if (items.length === 0) return null;
        return (
          <div key={sec.title} className={`border-l-4 ${sec.color} bg-card rounded-lg shadow-sm px-3 py-2`}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sm">{sec.emoji} {sec.title} ({items.length})</h3>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => exportSection(sec.title, items)}>
                <Download size={12} className="mr-1" /> Exportar
              </Button>
            </div>
            <div>
              {items.map(c => (
                <div key={c.Codigo} className="flex items-center gap-3 text-xs py-1 border-b last:border-0">
                  <span className="font-medium w-44 truncate">{c.Nome}</span>
                  <span className="text-muted-foreground w-16">{c.Vendedor || "—"}</span>
                  <span className="w-14">Ciclo: {c.Ciclo_Medio_d}d</span>
                  <span className="w-16">Dias s/C: {c.Dias_Sem_Compra}</span>
                  <span className="w-24">{fmtBRL(c.TM_Mes)}</span>
                  <StatusBadge status={c.Status} />
                  <span className="text-xs flex-1 truncate">{c.Proxima_Acao}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AgendaVisitas;
