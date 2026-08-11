import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { fmtBRL, fmtNum } from "@/lib/format";
import {
  PedidoCliente,
  ProdutoPedido,
  agruparPedidosPorMes,
  errMsgCliente,
  fetchProdutosPedido,
  isDevolucao,
} from "@/lib/clienteDetalheService";

interface Props {
  codCliente: number;
  pedidos: PedidoCliente[];
}

const corPosicao = (posicao: string | null, tipo: string | null): string => {
  const t = (tipo || "").toUpperCase();
  if (t.startsWith("BONIFICA")) return "bg-primary/10 text-primary";
  const p = (posicao || "").toUpperCase();
  if (p.startsWith("DEV")) return "bg-red-100 text-red-700";
  if (p.startsWith("F")) return "bg-green-100 text-green-700";
  if (p.startsWith("L")) return "bg-blue-100 text-blue-700";
  if (p.startsWith("B")) return "bg-yellow-100 text-yellow-700";
  return "bg-muted text-muted-foreground";
};

const rotuloPosicao = (posicao: string | null, tipo: string | null): string => {
  const t = (tipo || "").toUpperCase();
  if (t.startsWith("BONIFICA")) return "Bonificação";
  return posicao || tipo || "—";
};

const fmtData = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
};

const ClientePedidos: React.FC<Props> = ({ codCliente, pedidos }) => {
  const grupos = useMemo(() => agruparPedidosPorMes(pedidos), [pedidos]);
  // Primeiro mês já aberto
  const [mesesAbertos, setMesesAbertos] = useState<Record<string, boolean>>(() =>
    grupos.length > 0 ? { [grupos[0].chave]: true } : {},
  );
  // Aberto/fechado por LINHA (id), pois o mesmo nº de pedido pode ter venda + devolução
  const [linhasAbertas, setLinhasAbertas] = useState<Record<number, boolean>>({});
  // Cache dos itens por NÚMERO de pedido — as duas linhas compartilham os mesmos itens
  const [itensPorPedido, setItensPorPedido] = useState<Record<number, ProdutoPedido[]>>({});
  const [carregando, setCarregando] = useState<Record<number, boolean>>({});
  const [erros, setErros] = useState<Record<number, string>>({});

  const toggleMes = (chave: string) =>
    setMesesAbertos(prev => ({ ...prev, [chave]: !prev[chave] }));

  const togglePedido = async (id: number, pedido: number) => {
    const abrindo = !linhasAbertas[id];
    setLinhasAbertas(prev => ({ ...prev, [id]: abrindo }));
    // Lazy load: só busca os itens na primeira abertura
    if (!abrindo || itensPorPedido[pedido] || carregando[pedido]) return;
    setCarregando(prev => ({ ...prev, [pedido]: true }));
    try {
      const itens = await fetchProdutosPedido(codCliente, pedido);
      setItensPorPedido(prev => ({ ...prev, [pedido]: itens }));
      setErros(prev => { const p = { ...prev }; delete p[pedido]; return p; });
    } catch (err) {
      setErros(prev => ({ ...prev, [pedido]: errMsgCliente(err) }));
    } finally {
      setCarregando(prev => ({ ...prev, [pedido]: false }));
    }
  };

  if (pedidos.length === 0) {
    return (
      <div>
        <h4 className="font-semibold text-sm mb-2">Últimos Pedidos</h4>
        <p className="text-xs text-muted-foreground">Nenhum pedido encontrado para este cliente.</p>
      </div>
    );
  }

  return (
    <div>
      <h4 className="font-semibold text-sm mb-2">
        Últimos Pedidos
        <span className="text-xs font-normal text-muted-foreground ml-2">
          ({pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"})
        </span>
      </h4>

      <div className="space-y-2">
        {grupos.map(grupo => {
          const aberto = !!mesesAbertos[grupo.chave];
          return (
            <div key={grupo.chave} className="rounded border overflow-hidden">
              {/* Nível 1 — mês */}
              <button
                onClick={() => toggleMes(grupo.chave)}
                className="w-full bg-primary/10 px-3 py-2 flex justify-between items-center gap-2 text-left hover:bg-primary/15 transition-colors"
              >
                <span className="text-sm font-semibold text-primary">{grupo.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-card px-2 py-0.5 rounded-full whitespace-nowrap">
                    {grupo.pedidos.length} ped
                  </span>
                  <span className="text-sm font-bold whitespace-nowrap">{fmtBRL(grupo.total)}</span>
                  {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </button>

              {aberto && (
                <div>
                  {grupo.pedidos.map(p => {
                    const expandido = !!linhasAbertas[p.id];
                    const itens = itensPorPedido[p.pedido];
                    const dev = isDevolucao(p);
                    return (
                      <div key={p.id} className="border-b last:border-0">
                        {/* Nível 2 — pedido */}
                        <button
                          onClick={() => togglePedido(p.id, p.pedido)}
                          className="w-full flex justify-between items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
                        >
                          <div className="min-w-0">
                            <span className="text-xs text-muted-foreground">#{p.pedido}</span>
                            <span className="text-xs ml-2">{fmtData(p.data_fat || p.data_emissao)}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${corPosicao(p.posicao, p.tipo)}`}>
                              {rotuloPosicao(p.posicao, p.tipo)}
                            </span>
                            <span className={`text-sm font-semibold ${dev ? "text-red-600" : ""}`}>
                              {dev ? "-" : ""}{fmtBRL(p.vlr_atendido)}
                            </span>
                            {expandido ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </div>
                        </button>

                        {/* Nível 3 — produtos do pedido */}
                        {expandido && (
                          <div className="bg-muted/20 px-3 py-2">
                            {carregando[p.pedido] ? (
                              <div className="flex justify-center py-3">
                                <Loader2 className="animate-spin text-primary" size={16} />
                              </div>
                            ) : erros[p.pedido] ? (
                              <p className="text-xs text-red-600">Erro ao carregar itens: {erros[p.pedido]}</p>
                            ) : !itens || itens.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Sem itens registrados para este pedido.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-muted-foreground text-left">
                                      <th className="py-1 pr-2 font-medium">Cód.</th>
                                      <th className="py-1 pr-2 font-medium">Produto</th>
                                      <th className="py-1 pr-2 font-medium text-right">Qtd</th>
                                      <th className="py-1 font-medium text-right">Valor</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {itens.map((it, i) => (
                                      <tr key={`${it.codprod}-${i}`} className="border-t border-border/50">
                                        <td className="py-1 pr-2 font-mono text-[10px]">{it.codprod ?? "—"}</td>
                                        <td className="py-1 pr-2 max-w-[220px] truncate" title={it.produto || ""}>
                                          {it.produto || "—"}
                                        </td>
                                        <td className="py-1 pr-2 text-right">{fmtNum(it.quantidade)}</td>
                                        <td className="py-1 text-right">{fmtBRL(it.vlr_item)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClientePedidos;
