import React from "react";
import { RankingLinha } from "@/lib/clienteDetalheService";
import { fmtBRL, fmtNum } from "@/lib/format";

interface Props {
  titulo: string;
  linhas: RankingLinha[];
  /** "valor" mostra R$ à direita; "qtd" mostra unidades */
  medida: "valor" | "qtd";
  mostrarCodigo?: boolean;
  vazio?: string;
}

const corPosicao = (i: number): string => {
  if (i === 0) return "bg-accent";
  if (i === 1) return "bg-primary";
  return "bg-muted-foreground";
};

const ClienteRankings: React.FC<Props> = ({ titulo, linhas, medida, mostrarCodigo, vazio }) => (
  <div>
    <h4 className="font-semibold text-sm mb-2">{titulo}</h4>
    {linhas.length === 0 ? (
      <p className="text-xs text-muted-foreground">{vazio || "Sem dados de itens para este cliente."}</p>
    ) : (
      <div className="space-y-2">
        {linhas.map((l, i) => (
          <div key={l.chave} className="flex items-center gap-2">
            <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs text-white font-bold ${corPosicao(i)}`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" title={l.nome}>{l.nome}</p>
              {mostrarCodigo && l.codprod != null && (
                <p className="text-[10px] text-muted-foreground">#{l.codprod}</p>
              )}
              <div className="w-full bg-muted rounded-full h-2 mt-0.5">
                <div className="bg-accent h-2 rounded-full" style={{ width: `${Math.min(Math.max(l.pct, 0), 100)}%` }} />
              </div>
            </div>
            <span className="text-xs text-muted-foreground w-24 text-right shrink-0">
              {medida === "valor" ? fmtBRL(l.valor) : `${fmtNum(l.qtd)} un`}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default ClienteRankings;
