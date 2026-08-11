import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Cliente } from "@/lib/types";
import { fmtBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DiaUtil,
  calcularTendencia,
  errMsgMeta,
  fetchDiasUteis,
  fetchMetas,
  gerarDiasMes,
  parseDiaLocal,
  toMesRef,
} from "@/lib/metasService";

interface Props {
  clientes: Cliente[];
  periodFrom?: Date;
  periodTo?: Date;
  isGestor: boolean;
  /** muda quando as metas/dias são alterados na configuração */
  refreshKey?: number;
}

const corPct = (pct: number): string =>
  pct >= 100 ? "text-green-600" : pct >= 80 ? "text-yellow-600" : "text-red-600";

const corBarra = (pct: number): string =>
  pct >= 100 ? "bg-green-500" : pct >= 80 ? "bg-yellow-500" : "bg-red-500";

const TendenciaMeta: React.FC<Props> = ({ clientes, periodFrom, periodTo, isGestor, refreshKey }) => {
  const [dias, setDias] = useState<DiaUtil[]>([]);
  const [metas, setMetas] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);

  const hoje = useMemo(() => new Date(), []);
  const mesRef = useMemo(() => toMesRef(periodTo ?? hoje), [periodTo, hoje]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [d, m] = await Promise.all([fetchDiasUteis(mesRef), fetchMetas(mesRef)]);
      setDias(d);
      const mapa: Record<string, number> = {};
      m.forEach(x => { mapa[x.vendedor.trim().toLowerCase()] = x.meta_valor; });
      setMetas(mapa);
    } catch (err) {
      console.error("Erro ao carregar metas/dias úteis:", err);
      setDias([]);
      setMetas({});
    } finally {
      setLoading(false);
    }
  }, [mesRef]);

  useEffect(() => { carregar(); }, [carregar, refreshKey]);

  const fatAtual = useMemo(() => clientes.reduce((s, c) => s + c.Fat_Total, 0), [clientes]);

  // Meta = soma das metas dos vendedores presentes na visão filtrada
  const meta = useMemo(() => {
    const presentes = new Set(clientes.map(c => c.Vendedor.trim().toLowerCase()).filter(Boolean));
    let soma = 0;
    presentes.forEach(v => { soma += metas[v] || 0; });
    return soma;
  }, [clientes, metas]);

  const totalDiasUteis = useMemo(() => dias.filter(d => d.dia_util).length, [dias]);

  // Data de corte: hoje, ou o fim do período se ele já terminou
  const diasUteisPassados = useMemo(() => {
    const corte = periodTo && periodTo < hoje ? periodTo : hoje;
    return dias.filter(d => d.dia_util && parseDiaLocal(d.dia) <= corte).length;
  }, [dias, periodTo, hoje]);

  const tendencia = calcularTendencia(fatAtual, diasUteisPassados, totalDiasUteis);
  const pctMeta = meta > 0 ? (tendencia / meta) * 100 : 0;

  // Aviso quando o período selecionado não é um mês só (a tendência perde sentido)
  const periodoForaDoMes = useMemo(() => {
    if (!periodFrom || !periodTo) return false;
    return toMesRef(periodFrom) !== toMesRef(periodTo);
  }, [periodFrom, periodTo]);

  const handleGerar = async () => {
    setGerando(true);
    try {
      await gerarDiasMes(mesRef);
      toast.success("Calendário gerado.");
      await carregar();
    } catch (err) {
      toast.error("Erro ao gerar calendário: " + errMsgMeta(err));
    } finally {
      setGerando(false);
    }
  };

  if (loading) return null;

  // Sem calendário do mês: nada a projetar
  if (totalDiasUteis === 0) {
    return (
      <div className="bg-card rounded-lg shadow-sm border p-3 mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Sem dias úteis cadastrados para {mesRef} — a tendência não pode ser calculada.
        </span>
        {isGestor && (
          <Button size="sm" variant="outline" onClick={handleGerar} disabled={gerando}>
            {gerando ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            Gerar calendário
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-sm border p-3 mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">FAT. ATUAL</p>
          <p className="text-lg font-semibold">{fmtBRL(fatAtual)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">DIAS ÚTEIS</p>
          <p className="text-lg font-semibold">{diasUteisPassados}<span className="text-muted-foreground text-sm">/{totalDiasUteis}</span></p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">TENDÊNCIA</p>
          <p className="text-lg font-semibold">{fmtBRL(tendencia)}</p>
          {meta > 0 && (
            <p className={`text-xs font-bold ${corPct(pctMeta)}`}>{pctMeta.toFixed(0)}% da meta</p>
          )}
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">META</p>
          <p className="text-lg font-semibold">{meta > 0 ? fmtBRL(meta) : "—"}</p>
        </div>
      </div>

      {meta > 0 && (
        <div className="mt-3">
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${corBarra(pctMeta)}`}
              style={{ width: `${Math.min(Math.max(pctMeta, 0), 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>R$ 0</span>
            <span>Meta: {fmtBRL(meta)}</span>
          </div>
        </div>
      )}

      {periodoForaDoMes && (
        <p className="text-xs text-yellow-600 mt-2">
          ⚠️ O período selecionado cobre mais de um mês — a tendência usa o calendário de {mesRef}.
        </p>
      )}
    </div>
  );
};

export default TendenciaMeta;
