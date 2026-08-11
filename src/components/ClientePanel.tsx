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

const Secao: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <div>
    <h4 className="font-semibold text-sm mb-2">{titulo}</h4>
    {children}
  </div>
);

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

  // Fechar com ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  const corPct = (v: number) => (v >= 100 ? "text-green-600" : v >= 80 ? "text-yellow-600" : "text-red-600");

  // Grid compacto 4×3 — mantém todas as métricas que o painel já tinha
  const kpis: { label: string; value: string; cls?: string }[] = [
    { label: "TM/Mês", value: fmtBRL(c.TM_Mes) },
    { label: "Objetivo", value: c.Objetivo_R$ ? fmtBRL(c.Objetivo_R$) : "—" },
    { label: "Ciclo Médio", value: `${c.Ciclo_Medio_d}d` },
    { label: "Dias s/ Compra", value: String(c.Dias_Sem_Compra) },
    { label: "Fat. Total", value: fmtBRL(c.Fat_Total) },
    { label: "Nº Pedidos", value: String(c.N_Pedidos) },
    { label: "MCC", value: String(c.MCC) },
    { label: "Meses 1ª Compra", value: String(c.Meses_1a_Compra) },
    { label: "% Real. vs TM", value: `${pctRealizadoTM.toFixed(1)}%`, cls: corPct(pctRealizadoTM) },
    { label: "% Real. vs Obj.", value: `${pctRealizadoObj.toFixed(1)}%`, cls: corPct(pctRealizadoObj) },
    { label: "Positivado", value: positivado ? "✅ Sim" : "❌ Não", cls: positivado ? "text-green-600" : "text-red-600" },
    { label: "Última Compra", value: c.Ultima_Compra || "—" },
  ];

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
    <div
      className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-5xl h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto shadow-2xl sm:rounded-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* ============ SEÇÃO 1: HEADER (fixo) ============ */}
        <div className="sticky top-0 bg-card z-10 border-b px-4 sm:px-6 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 shrink-0 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                {iniciais(c.Nome)}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold flex items-center gap-2 flex-wrap">
                  <span className="truncate">{c.Nome}</span>
                  <TagRCA2 info={rcaInfo[c.Codigo]} />
                </h2>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="text-xs text-muted-foreground font-mono">Cód. {c.Codigo}</span>
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
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar"><X size={20} /></Button>
            </div>
          </div>

          {/* Chips de contato */}
          {cad && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Chip label="CPF/CNPJ" value={fmtCpfCnpj(cad.cpf_cnpj)} />
              <Chip label="Tel" value={fmtTelefone(cad.telefone)} />
              <Chip label="E-mail" value={cad.email} />
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 p-4 sm:p-6">
          {/* ============ SEÇÃO 2: RANKING GERAL (largura total) ============ */}
          <div className="md:col-span-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            {carregando ? (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> Carregando dados do cliente…
              </span>
            ) : ranking && ranking.total_clientes > 0 ? (
              <div className="bg-primary/10 rounded-lg px-3 py-1.5 text-sm">
                🏆 <strong className="text-primary">{fmtNum(ranking.posicao)}º</strong> de{" "}
                {fmtNum(ranking.total_clientes)} clientes ·{" "}
                <strong>{fmtBRL(ranking.faturamento_liquido)}</strong>{" "}
                <span className="text-muted-foreground text-xs">nos últimos 12 meses</span>
              </div>
            ) : null}

            <div className="flex items-center gap-4 ml-auto">
              <div>
                <span className="text-[10px] text-muted-foreground block">Vendedor</span>
                {c.Vendedor ? (
                  <span className="text-sm font-medium">{c.Vendedor}</span>
                ) : (
                  <select className="border rounded px-2 py-1 text-sm bg-card" onChange={e => setVendedor(c.Codigo, e.target.value)} defaultValue="">
                    <option value="" disabled>Atribuir</option>
                    {vendedores.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                )}
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Próxima Ação</span>
                <span className="text-sm font-medium text-accent">{c.Proxima_Acao || "—"}</span>
              </div>
            </div>
          </div>

          {/* ============ COLUNA ESQUERDA ============ */}
          <div className="space-y-5 min-w-0">
            {/* SEÇÃO 3: KPIs compactos */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {kpis.map(k => (
                <div key={k.label} className="bg-muted/50 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-[10px] text-muted-foreground leading-tight">{k.label}</p>
                  <p className={`text-sm font-bold truncate ${k.cls || ""}`} title={k.value}>{k.value}</p>
                </div>
              ))}
            </div>

            {insights.length > 0 && (
              <Secao titulo="Interpretação">
                <div className="space-y-0.5">
                  {insights.map((ins, i) => (
                    <div key={i} className="text-xs">{ins}</div>
                  ))}
                </div>
              </Secao>
            )}

            {/* SEÇÃO 4: Vendedor responsável */}
            {rca1 && (
              <Secao titulo="Vendedor Responsável">
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
              </Secao>
            )}

            {/* SEÇÃO 5: Endereço */}
            {temEndereco && (
              <Secao titulo="Endereço">
                <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 rounded-lg p-3">
                  <div className="col-span-2"><strong>Logradouro:</strong> {cad?.endereco || "—"}</div>
                  <div><strong>Bairro:</strong> {cad?.bairro || "—"}</div>
                  <div><strong>Cidade:</strong> {cad?.cidade || "—"}{cad?.estado ? ` - ${cad.estado}` : ""}</div>
                  <div><strong>CEP:</strong> {fmtCEP(cad?.cep)}</div>
                </div>
              </Secao>
            )}

            {/* SEÇÕES 7 e 8: Rankings */}
            {!carregando && (
              <>
                <ClienteRankings titulo="Ranking por Departamento" linhas={topDepartamentos} medida="valor" />
                <ClienteRankings titulo="Ranking de Produtos" linhas={topProdutos} medida="qtd" mostrarCodigo />
              </>
            )}
          </div>

          {/* ============ COLUNA DIREITA ============ */}
          <div className="space-y-5 min-w-0">
            {/* SEÇÃO 6: Faturamento mensal */}
            <Secao titulo="Faturamento Mensal">
              <div className="grid grid-cols-4 gap-1">
                {mesesCols.map(m => {
                  const val = c.meses[m] || 0;
                  const { bg, fg } = heatmapColor(val, c.TM_Mes);
                  return (
                    <div key={m} className="rounded p-1.5 text-center text-[11px]" style={{ backgroundColor: bg, color: fg }}>
                      <div className="font-medium">{m}</div>
                      <div>{val > 0 ? fmtBRLShort(val) : "—"}</div>
                    </div>
                  );
                })}
              </div>
            </Secao>

            {/* SEÇÃO 9: Últimos pedidos */}
            {!carregando && <ClientePedidos codCliente={codCliente} pedidos={pedidos} />}

            {/* SEÇÃO 10: Histórico de visitas */}
            {clienteVisitas.length > 0 && (
              <Secao titulo="Histórico de Visitas">
                <div className="space-y-2">
                  {clienteVisitas.map((v, i) => (
                    <div key={i} className="text-sm bg-muted/30 rounded p-2">
                      <span className="font-medium">{v.data} {v.hora}</span> — {v.vendedor}
                      {v.teve_venda && " ✅ venda"}
                      {v.observacao && <div className="text-xs text-muted-foreground mt-1">{v.observacao}</div>}
                    </div>
                  ))}
                </div>
              </Secao>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientePanel;
