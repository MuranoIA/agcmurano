import React, { useEffect, useMemo, useState } from "react";
import { Cliente } from "@/lib/types";
import { useAppData } from "@/contexts/AppDataContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { fmtBRL, fmtBRLShort, fmtCEP, fmtCpfCnpj, fmtNum, fmtTelefone, iniciais } from "@/lib/format";
import { heatmapColor } from "@/lib/heatmapColors";
import StatusBadge from "./StatusBadge";
import TagRCA2 from "./TagRCA2";
import ClienteRankings from "./ClienteRankings";
import ClientePedidos from "./ClientePedidos";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ClienteDetalhe,
  fetchClienteCompleto,
  rankingDepartamentos,
  rankingProdutos,
} from "@/lib/clienteDetalheService";

interface Props {
  cliente: Cliente;
  onClose: () => void;
}

const CORES_FAMILIA: Record<string, string> = {
  BRONZE: "bg-amber-100 text-amber-800 border-amber-300",
  PRATA: "bg-slate-100 text-slate-700 border-slate-300",
  OURO: "bg-yellow-100 text-yellow-800 border-yellow-400",
  DIAMANTE: "bg-cyan-100 text-cyan-800 border-cyan-300",
};

/** "27 - ANNE KAROLINE" -> { codigo: "27", nome: "Anne Karoline" } */
function parseRCA(raw?: string | null): { codigo: string; nome: string } | null {
  const s = (raw || "").trim();
  if (!s) return null;
  const [codigo, ...resto] = s.split(" ");
  const nome = resto.join(" ").replace(/^-\s*/, "").trim();
  if (!nome && (!codigo || codigo === "0")) return null;
  const titulo = nome.toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase());
  return { codigo: codigo.trim(), nome: titulo || `RCA ${codigo}` };
}

const Chip: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
  if (!value || value === "—") return null;
  return (
    <span className="text-xs bg-muted/60 rounded-full px-2.5 py-1 whitespace-nowrap">
      <span className="text-muted-foreground">{label}:</span> {value}
    </span>
  );
};

const ClientePanel: React.FC<Props> = ({ cliente: c, onClose }) => {
  const { mesesCols, visitas, setVendedor, rcaInfo } = useAppData();
  const { vendedores } = useEmpresa();

  const [detalhe, setDetalhe] = useState<ClienteDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);

  const codCliente = Number(c.Codigo);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setDetalhe(null);
    if (!Number.isFinite(codCliente)) {
      setCarregando(false);
      return;
    }
    fetchClienteCompleto(codCliente)
      .then(d => { if (!cancelado) setDetalhe(d); })
      .catch(err => { if (!cancelado) console.error("Erro ao carregar detalhes do cliente:", err); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [codCliente]);

  const cad = detalhe?.cliente ?? null;
  const ranking = detalhe?.ranking ?? null;
  const itens = detalhe?.itens ?? [];
  const pedidos = detalhe?.pedidos ?? [];

  const topDepartamentos = useMemo(() => rankingDepartamentos(itens), [itens]);
  const topProdutos = useMemo(() => rankingProdutos(itens), [itens]);

  const rca1 = parseRCA(cad?.rca_vendedor);
  const rca2 = parseRCA(cad?.rca2_vendedor);

  const lastMonth = mesesCols[mesesCols.length - 1] || "";
  const last3 = mesesCols.slice(-3);
  const last3vals = last3.map(m => c.meses[m] || 0);

  // Positivado no período (tem valor > 0 em algum mês)
  const positivado = mesesCols.some(m => (c.meses[m] || 0) > 0);
  const abrVal = c.meses["Abr/26"] || 0;
  const pctRealizadoTM = c.TM_Mes > 0 ? (abrVal / c.TM_Mes) * 100 : 0;
  const pctRealizadoObj = c.Objetivo_R$ > 0 ? (abrVal / c.Objetivo_R$) * 100 : 0;

  const insights: string[] = [];
  if (c.MCC === c.Meses_1a_Compra && c.MCC > 0) insights.push("✅ Presente em todos os meses — cliente âncora");
  if (c.Meses_1a_Compra > 0 && c.MCC < c.Meses_1a_Compra * 0.6) insights.push("⚠️ Comprando em menos de 60% dos meses disponíveis");
  if (last3vals.length === 3 && last3vals.every(v => v < c.TM_Mes && v > 0)) insights.push("📉 Queda nos últimos 3 meses");
  if (last3vals.length === 3 && last3vals.every(v => v >= c.TM_Mes)) insights.push("📈 Crescimento consistente nos últimos 3 meses");
  if (c.Ciclo_Medio_d > 0 && c.Dias_Sem_Compra > c.Ciclo_Medio_d * 2) insights.push("🚨 Muito além do ciclo — acionar imediatamente");
  if (c.Dias_Para_Acao <= 3 && c.Status === "Ativo") insights.push("🔔 Janela de compra se abre em breve");
  if (c.Objetivo_R$ > 0 && (c.meses[lastMonth] || 0) < c.Objetivo_R$) insights.push("🎯 Abaixo do objetivo no último mês");
  if (c.Objetivo_R$ > 0 && (c.meses[lastMonth] || 0) >= c.Objetivo_R$) insights.push("🎯 Atingiu o objetivo no último mês");

  const clienteVisitas = visitas.filter(v => v.codigo === c.Codigo);

  const familia = cad?.familia?.trim().toUpperCase();
  const temEndereco = !!(cad?.endereco || cad?.bairro || cad?.cidade || cad?.cep);

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* ============ SEÇÃO 1: HEADER ============ */}
        <div className="sticky top-0 bg-card z-10 border-b px-4 sm:px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 shrink-0 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                {iniciais(c.Nome)}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold flex items-center gap-2 flex-wrap">
                  <span className="truncate">{c.Nome}</span>
                  <TagRCA2 info={rcaInfo[c.Codigo]} />
                </h2>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="text-sm text-muted-foreground font-mono">{c.Codigo}</span>
                  {cad && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      cad.ativo === false
                        ? "bg-red-100 text-red-700 border-red-300"
                        : "bg-green-100 text-green-700 border-green-300"
                    }`}>
                      {cad.ativo === false ? "Inativo" : "Ativo"}
                    </span>
                  )}
                  {familia && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      CORES_FAMILIA[familia] || "bg-muted text-muted-foreground border-border"
                    }`}>
                      {familia}
                    </span>
                  )}
                  {cad?.ramo && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {cad.ramo}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={c.Status} large />
              <Button variant="ghost" size="sm" onClick={onClose}><X size={20} /></Button>
            </div>
          </div>

          {/* Chips de contato */}
          {cad && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              <Chip label="CPF/CNPJ" value={fmtCpfCnpj(cad.cpf_cnpj)} />
              <Chip label="Tel" value={fmtTelefone(cad.telefone)} />
              <Chip label="E-mail" value={cad.email} />
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* ============ SEÇÃO 2: RANKING GERAL ============ */}
          {carregando ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Carregando dados do cliente…
            </div>
          ) : ranking && ranking.total_clientes > 0 ? (
            <div className="bg-primary/10 rounded-lg px-3 py-2 text-sm">
              🏆 <strong className="text-primary">{fmtNum(ranking.posicao)}º</strong> de{" "}
              {fmtNum(ranking.total_clientes)} clientes ·{" "}
              <strong>{fmtBRL(ranking.faturamento_liquido)}</strong>{" "}
              <span className="text-muted-foreground text-xs">nos últimos 12 meses</span>
            </div>
          ) : null}

          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-muted-foreground">Vendedor</span>
              {c.Vendedor ? (
                <div className="font-medium">{c.Vendedor}</div>
              ) : (
                <select className="border rounded px-2 py-1 text-sm bg-card" onChange={e => setVendedor(c.Codigo, e.target.value)} defaultValue="">
                  <option value="" disabled>Atribuir</option>
                  {vendedores.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
            </div>
            <div className="flex-1">
              <span className="text-xs text-muted-foreground">Próxima Ação</span>
              <div className="font-medium text-accent">{c.Proxima_Acao}</div>
            </div>
          </div>

          {/* ============ SEÇÃO 3: KPIs ============ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              ["TM/Mês", fmtBRL(c.TM_Mes)],
              ["Objetivo", c.Objetivo_R$ ? fmtBRL(c.Objetivo_R$) : "—"],
              ["Ciclo Médio", `${c.Ciclo_Medio_d}d`],
              ["MCC", String(c.MCC)],
              ["Meses 1ª Compra", String(c.Meses_1a_Compra)],
              ["Dias s/ Compra", String(c.Dias_Sem_Compra)],
              ["Última Compra", c.Ultima_Compra],
              ["Fat. Total", fmtBRL(c.Fat_Total)],
              ["Nº Pedidos", String(c.N_Pedidos)],
              ["Positivado", positivado ? "✅ Sim" : "❌ Não"],
              ["% Real. vs TM", `${pctRealizadoTM.toFixed(1)}%`],
              ["% Real. vs Obj.", `${pctRealizadoObj.toFixed(1)}%`],
            ].map(([label, val]) => (
              <div key={label} className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="font-semibold text-sm">{val}</div>
              </div>
            ))}
          </div>

          {insights.length > 0 && (
            <div className="space-y-1">
              <h4 className="font-semibold text-sm mb-2">Interpretação</h4>
              {insights.map((ins, i) => (
                <div key={i} className="text-sm py-1">{ins}</div>
              ))}
            </div>
          )}

          {/* ============ SEÇÃO 4: VENDEDOR RESPONSÁVEL ============ */}
          {rca1 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Vendedor Responsável</h4>
              <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                  {iniciais(rca1.nome)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{rca1.nome}</p>
                  <p className="text-xs text-muted-foreground">RCA {rca1.codigo}</p>
                </div>
                {rca2 && (
                  <div className="ml-auto text-right min-w-0">
                    <p className="text-xs text-muted-foreground">2º Vendedor</p>
                    <p className="text-sm truncate">{rca2.nome}</p>
                    <p className="text-[10px] text-muted-foreground">RCA {rca2.codigo}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ SEÇÃO 5: ENDEREÇO ============ */}
          {temEndereco && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Endereço</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm bg-muted/30 rounded-lg p-3">
                <div className="sm:col-span-2"><strong>Logradouro:</strong> {cad?.endereco || "—"}</div>
                <div><strong>Bairro:</strong> {cad?.bairro || "—"}</div>
                <div><strong>Cidade:</strong> {cad?.cidade || "—"}{cad?.estado ? ` - ${cad.estado}` : ""}</div>
                <div><strong>CEP:</strong> {fmtCEP(cad?.cep)}</div>
              </div>
            </div>
          )}

          {/* ============ SEÇÃO 6: FATURAMENTO MENSAL ============ */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Faturamento Mensal</h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
              {mesesCols.map(m => {
                const val = c.meses[m] || 0;
                const { bg, fg } = heatmapColor(val, c.TM_Mes);
                return (
                  <div key={m} className="rounded p-2 text-center text-xs" style={{ backgroundColor: bg, color: fg }}>
                    <div className="font-medium">{m}</div>
                    <div>{val > 0 ? fmtBRLShort(val) : "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ============ SEÇÕES 7 e 8: RANKINGS ============ */}
          {!carregando && (
            <>
              <ClienteRankings titulo="Ranking por Departamento" linhas={topDepartamentos} medida="valor" />
              <ClienteRankings titulo="Ranking de Produtos" linhas={topProdutos} medida="qtd" mostrarCodigo />
            </>
          )}

          {/* ============ SEÇÃO 9: ÚLTIMOS PEDIDOS ============ */}
          {!carregando && <ClientePedidos codCliente={codCliente} pedidos={pedidos} />}

          {/* ============ SEÇÃO 10: HISTÓRICO DE VISITAS ============ */}
          {clienteVisitas.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Histórico de Visitas</h4>
              <div className="space-y-2">
                {clienteVisitas.map((v, i) => (
                  <div key={i} className="text-sm bg-muted/30 rounded p-2">
                    <span className="font-medium">{v.data} {v.hora}</span> — {v.vendedor}
                    {v.teve_venda && " ✅ venda"}
                    {v.observacao && <div className="text-xs text-muted-foreground mt-1">{v.observacao}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientePanel;
