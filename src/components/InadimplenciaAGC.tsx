import React, { useState, useEffect, useMemo } from "react";
import { BoletoVencido, LIMITE_RPC, fetchInadimplencia } from "@/lib/inadimplenciaService";
import { fmtBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

interface Props {
  /** Vendedor do AGC; vazio/indefinido = carteira inteira */
  vendedorFiltro?: string;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("pt-BR");
}

const InadimplenciaAGC: React.FC<Props> = ({ vendedorFiltro }) => {
  const [boletos, setBoletos] = useState<BoletoVencido[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let cancelado = false;
    const carregar = async () => {
      setLoading(true);
      setErro(false);
      setProgresso({ feitos: 0, total: 0 });
      try {
        const data = await fetchInadimplencia(vendedorFiltro, {
          force: recarga > 0,
          onProgress: (feitos, total) => { if (!cancelado) setProgresso({ feitos, total }); },
        });
        if (!cancelado) setBoletos(data);
      } catch (err) {
        console.error("Erro ao carregar inadimplência:", err);
        if (!cancelado) { setBoletos([]); setErro(true); }
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    carregar();
    return () => { cancelado = true; };
  }, [vendedorFiltro, recarga]);

  const totalAtraso = useMemo(() => boletos.reduce((s, b) => s + b.valor, 0), [boletos]);
  const clientesAtingidos = useMemo(() => new Set(boletos.map(b => b.cod_cliente)).size, [boletos]);

  if (loading) {
    const pct = progresso.total > 0 ? Math.round((progresso.feitos / progresso.total) * 100) : 0;
    return (
      <div className="text-center py-12">
        <Loader2 className="animate-spin mx-auto mb-2 text-primary" size={28} />
        <p className="text-sm text-muted-foreground">Consultando pagamentos...</p>
        <p className="text-xs text-muted-foreground/70">
          {progresso.total > 0
            ? `${progresso.feitos} de ${progresso.total} clientes (${pct}%)`
            : "Isso pode levar alguns segundos"}
        </p>
        {progresso.total > 0 && (
          <div className="max-w-xs mx-auto mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    );
  }

  if (erro) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-sm text-muted-foreground">Não foi possível carregar a inadimplência</p>
        <Button size="sm" variant="outline" onClick={() => setRecarga(r => r + 1)}>
          <RefreshCw size={14} className="mr-1" /> Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <p className="text-xs text-red-600">Boletos vencidos</p>
          <p className="text-2xl font-bold text-red-700">{boletos.length}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <p className="text-xs text-red-600">Total em atraso</p>
          <p className="text-2xl font-bold text-red-700">{fmtBRL(totalAtraso)}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <p className="text-xs text-red-600">Clientes</p>
          <p className="text-2xl font-bold text-red-700">{clientesAtingidos}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          Considera as {LIMITE_RPC} cobranças de vencimento mais recente por cliente —
          quem tem histórico maior pode ter vencidos além dessas. Resultado em cache por 5 min.
        </p>
        <Button size="sm" variant="outline" className="text-xs h-7 shrink-0 ml-2" onClick={() => setRecarga(r => r + 1)}>
          <RefreshCw size={12} className="mr-1" /> Atualizar
        </Button>
      </div>

      {boletos.length === 0 ? (
        <div className="text-center py-12 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">🎉 Nenhum boleto vencido na carteira</p>
        </div>
      ) : (
        boletos.map(b => (
          <div key={b.id} className="border-l-4 border-l-red-500 bg-red-50 rounded-lg p-3">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{b.cliente}</p>
                <p className="text-xs text-gray-500">
                  Cód. {b.cod_cliente}
                  {b.vendedor && <span className="ml-2">· {b.vendedor}</span>}
                </p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {b.nf && <span className="text-xs text-gray-500">NF {b.nf}</span>}
                  {b.pedido && <span className="text-xs text-gray-500">Pedido {b.pedido}</span>}
                  {b.forma && <span className="text-xs text-gray-400 uppercase">{b.forma}</span>}
                </div>
                <p className="text-xs text-red-600 font-bold mt-1">
                  Venceu {formatDate(b.vencimento)} ({b.dias_atraso}d em atraso)
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-red-700">{fmtBRL(b.valor)}</p>
                {b.link_cobranca && (
                  <a
                    href={b.link_cobranca}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 underline mt-1 inline-block"
                  >
                    🔗 Boleto
                  </a>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default InadimplenciaAGC;
