import React from "react";
import { AgendaVisita, Prioridade, StatusVisita } from "@/lib/agendaService";
import { fmtBRL } from "@/lib/format";
import { CheckCircle2, MessageSquare, GripVertical, Trash2 } from "lucide-react";

interface Props {
  visita: AgendaVisita;
  nome: string;
  diasSemCompra?: number;
  editable: boolean;
  onRealizar: () => void;
  onDetalhes: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDelete?: () => void;
}

const PRIORIDADE_CONFIG: Record<Prioridade, { dot: string; border: string; label: string }> = {
  urgente: { dot: "🔴", border: "border-l-red-500", label: "URGENTE" },
  alta: { dot: "🟡", border: "border-l-yellow-500", label: "ALTA" },
  normal: { dot: "🟢", border: "border-l-green-500", label: "NORMAL" },
  baixa: { dot: "🔵", border: "border-l-blue-500", label: "BAIXA" },
};

const STATUS_CONFIG: Record<StatusVisita, { bg: string; label: string; icon?: string }> = {
  agendada: { bg: "bg-card", label: "Agendada" },
  realizada: { bg: "bg-green-50 dark:bg-green-950/30", label: "Realizada", icon: "✅" },
  reagendada: { bg: "bg-yellow-50 dark:bg-yellow-950/30", label: "Reagendada", icon: "🔄" },
  cancelada: { bg: "bg-muted opacity-70", label: "Cancelada", icon: "✖️" },
};

const VisitaCard: React.FC<Props> = ({ visita, nome, diasSemCompra, editable, onRealizar, onDetalhes, onDragStart, onDelete }) => {
  const prio = PRIORIDADE_CONFIG[visita.prioridade] ?? PRIORIDADE_CONFIG.normal;
  const st = STATUS_CONFIG[visita.status] ?? STATUS_CONFIG.agendada;
  const cancelada = visita.status === "cancelada";
  const realizada = visita.status === "realizada";

  return (
    <div
      draggable={editable && !cancelada}
      onDragStart={onDragStart}
      className={`group border border-l-4 ${prio.border} ${st.bg} rounded-md shadow-sm p-2 text-xs transition hover:shadow-md ${
        editable && !cancelada ? "cursor-grab active:cursor-grabbing" : ""
      } ${cancelada ? "line-through" : ""}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold tracking-wide text-[10px] flex items-center gap-1">
          {prio.dot} {prio.label}
        </span>
        {editable && !cancelada && (
          <GripVertical size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100" />
        )}
      </div>

      <button onClick={onDetalhes} className="block text-left w-full mt-1">
        <div className="font-medium truncate flex items-center gap-1" title={nome}>
          <span className="truncate">{nome}</span>
          {visita.prospeccao ? (
            <span className="shrink-0 text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              FORA DO AGC
            </span>
          ) : (
            <span className="text-muted-foreground">({visita.cod_cliente})</span>
          )}
        </div>
        {typeof diasSemCompra === "number" && diasSemCompra > 0 && (
          <div className="text-muted-foreground">{diasSemCompra}d sem compra</div>
        )}
      </button>

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-muted-foreground">
          {st.icon ? `${st.icon} ` : "☐ "}
          {st.label}
        </span>
        {realizada && visita.vendeu && visita.valor_venda > 0 && (
          <span className="font-semibold text-green-700 dark:text-green-400">{fmtBRL(visita.valor_venda)}</span>
        )}
      </div>

      {realizada && visita.vendeu && (
        <div className="mt-1">
          {visita.venda_confirmada ? (
            <span className="text-[10px] font-medium text-green-700 dark:text-green-400">✅ Confirmada</span>
          ) : (
            <span className="text-[10px] font-medium text-amber-600">⏳ Pendente confirmação</span>
          )}
        </div>
      )}

      {editable && !cancelada && !realizada && (
        <div className="flex gap-1 mt-1.5">
          <button
            onClick={onRealizar}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded bg-primary text-primary-foreground py-1 text-[11px] hover:opacity-90"
          >
            <CheckCircle2 size={12} /> Realizar
          </button>
          <button
            onClick={onDetalhes}
            className="inline-flex items-center justify-center rounded border px-2 py-1 text-[11px] hover:bg-muted"
            title="Observação / detalhes"
          >
            <MessageSquare size={12} />
          </button>
          {onDelete && (
            <button
              onClick={e => { e.stopPropagation(); if (confirm(`Excluir visita de ${nome}?`)) onDelete(); }}
              className="inline-flex items-center justify-center rounded border px-2 py-1 text-red-400 hover:bg-red-100 hover:text-red-600"
              title="Excluir visita"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}

      {realizada && editable && (
        <button
          onClick={onDetalhes}
          className="w-full mt-1.5 inline-flex items-center justify-center gap-1 rounded border py-1 text-[11px] hover:bg-muted"
        >
          <MessageSquare size={12} /> Ver / editar
        </button>
      )}
    </div>
  );
};

export default VisitaCard;
