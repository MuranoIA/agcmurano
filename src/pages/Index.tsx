import React, { useState, useMemo, useCallback, useEffect } from "react";
import { AppDataProvider, useAppData } from "@/contexts/AppDataContext";
import { EmpresaProvider, useEmpresa } from "@/contexts/EmpresaContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useAuth } from "@/contexts/AuthContext";

import AppHeader from "@/components/AppHeader";
import KPIBar from "@/components/KPIBar";
import Filters from "@/components/Filters";
import PeriodFilter from "@/components/PeriodFilter";
import ClienteTable from "@/components/ClienteTable";
import HeatmapTable from "@/components/HeatmapTable";
import AgendaVisitasV2 from "@/components/AgendaVisitasV2";
import RelatorioVisitas from "@/components/RelatorioVisitas";
import RankingTable from "@/components/RankingTable";
import VisaoGeral from "@/components/VisaoGeral";
import ClientePanel from "@/components/ClientePanel";
import ConsultaClientes, { ClienteBusca, nomeRCA } from "@/components/ConsultaClientes";
import NovoClienteModal from "@/components/NovoClienteModal";
import PendenciasAGC from "@/components/PendenciasAGC";
import InadimplenciaAGC from "@/components/InadimplenciaAGC";
import ConfigMetas from "@/components/ConfigMetas";
import TendenciaMeta from "@/components/TendenciaMeta";
import { countAlertasPendentes } from "@/lib/alertasService";
import { countInadimplencia } from "@/lib/inadimplenciaService";
import { VendasForaCarteira, fetchVendasForaDaCarteira } from "@/lib/supabaseService";
import { Cliente } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadFile, exportCSV, fmtBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";


/** Date -> "YYYY-MM-DD" no fuso local (faturamento.datafat é date, não timestamp) */
const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const Dashboard: React.FC = () => {
  const appData = useAppData();
  const { role, user, vendorName } = useAuth();
  const { permissions } = usePermissions();
  const isVendedorRestrito = permissions?.role === "vendedor";
  const isGestor = permissions?.role === "gestor" || role === "admin";
  const { hasInterior, vendedoresInterior } = useEmpresa();
  const clientes = appData?.clientes ?? [];
  const mesesCols = appData?.mesesCols ?? [];
  const csvLoaded = appData?.csvLoaded ?? false;
  const loading = appData?.loading ?? true;
  const periodFrom = appData?.periodFrom;
  const periodTo = appData?.periodTo;
  const setPeriodFrom = appData?.setPeriodFrom ?? (() => {});
  const setPeriodTo = appData?.setPeriodTo ?? (() => {});
  const resetPeriod = appData?.resetPeriod ?? (() => {});
  const mesesNoPeriodo = appData?.mesesNoPeriodo ?? 1;
  const somenteVendasProprias = appData?.somenteVendasProprias ?? false;
  const setSomenteVendasProprias = appData?.setSomenteVendasProprias ?? (() => {});
  const posicoesAtivas = appData?.posicoesAtivas ?? {};
  const setPosicoesAtivas = appData?.setPosicoesAtivas ?? (() => {});
  const [vendedor, setVendedor] = useState("Todos");
  const [regiao, setRegiao] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(role === "admin" ? "visao" : "clientes");
  const [pendenciasCount, setPendenciasCount] = useState(0);
  const [showConfigMetas, setShowConfigMetas] = useState(false);
  const [metasVersion, setMetasVersion] = useState(0);
  const [inadimplenciaCount, setInadimplenciaCount] = useState(0);
  const [vendasFora, setVendasFora] = useState<VendasForaCarteira | null>(null);

  /**
   * Vendedor efetivo: quem tem acesso restrito enxerga apenas a própria carteira,
   * independentemente do botão de filtro. Vazio = "Todos".
   */
  const vendedorEfetivo = useMemo(() => {
    const restrito = permissions?.vendedor_filtro?.trim() || (role === "vendedor" ? vendorName : "") || "";
    if (restrito) return restrito;
    return vendedor !== "Todos" ? vendedor : "";
  }, [permissions?.vendedor_filtro, role, vendorName, vendedor]);

  // Contagem de pendências (badge) — só pra gestores, atualiza a cada 60s
  useEffect(() => {
    if (!isGestor) return;
    let cancelled = false;
    const refresh = () => {
      countAlertasPendentes().then(n => { if (!cancelled) setPendenciasCount(n); });
    };
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isGestor]);

  // Contagem de boletos vencidos (badge) — o serviço cacheia por 5 min, então
  // o intervalo apenas renova o cache expirado.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      countInadimplencia(vendedorEfetivo || undefined)
        .then(n => { if (!cancelled) setInadimplenciaCount(n); })
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 300000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [vendedorEfetivo]);

  // Reset filters/tab when empresa changes (avoid stuck state on hidden tab or invalid vendor)
  useEffect(() => {
    if (!hasInterior && activeTab === "interior") {
      setActiveTab(role === "admin" ? "visao" : "clientes");
    }
    setVendedor("Todos");
    setIntVendedor("Todos");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInterior]);

  // Interior filters
  const [intVendedor, setIntVendedor] = useState("Todos");
  const [intStatus, setIntStatus] = useState("Todos");
  const [intBusca, setIntBusca] = useState("");

  const isInterior = (c: Cliente) => c.Segmento === "interior" || c.Vendedor.toLowerCase().includes("interior");
  const clientesCapital = useMemo(() => clientes.filter(c => !isInterior(c)), [clientes]);
  const clientesInterior = useMemo(() => clientes.filter(c => isInterior(c)), [clientes]);

  const filtered = useMemo(() => {
    let list = clientesCapital;
    if (regiao !== "Todos") list = list.filter(c => c.Segmento === regiao.toLowerCase());
    if (vendedor !== "Todos") list = list.filter(c => c.Vendedor === vendedor);
    if (status !== "Todos") list = list.filter(c => c.Status === status);
    if (busca) {
      const term = busca.toLowerCase();
      list = list.filter(c => c.Nome.toLowerCase().includes(term) || c.Codigo.includes(term));
    }
    return list;
  }, [clientesCapital, regiao, vendedor, status, busca]);

  const filteredInterior = useMemo(() => {
    let list = clientesInterior;
    if (intVendedor !== "Todos") list = list.filter(c => c.Vendedor === intVendedor);
    if (intStatus !== "Todos") list = list.filter(c => c.Status === intStatus);
    if (intBusca) {
      const term = intBusca.toLowerCase();
      list = list.filter(c => c.Nome.toLowerCase().includes(term) || c.Codigo.includes(term));
    }
    return list;
  }, [clientesInterior, intVendedor, intStatus, intBusca]);

  /**
   * Vendas fora da carteira só fazem sentido com um vendedor definido e sem os
   * demais filtros ativos — status/busca/região recortam a carteira, e o total
   * de fora dela não tem como acompanhar esse recorte.
   */
  const posicoesSelecionadas = useMemo(
    () => Object.entries(posicoesAtivas).filter(([, ativo]) => ativo).map(([p]) => p),
    [posicoesAtivas],
  );
  const podeMostrarFora = !!vendedorEfetivo && status === "Todos" && !busca && regiao === "Todos";

  useEffect(() => {
    if (!podeMostrarFora || !periodFrom || !periodTo) { setVendasFora(null); return; }
    let cancelled = false;
    fetchVendasForaDaCarteira(vendedorEfetivo, ymd(periodFrom), ymd(periodTo), posicoesSelecionadas)
      .then(r => { if (!cancelled) setVendasFora(r); })
      .catch(err => {
        console.error("Erro ao buscar vendas fora da carteira:", err);
        if (!cancelled) setVendasFora(null);
      });
    return () => { cancelled = true; };
  }, [podeMostrarFora, vendedorEfetivo, periodFrom, periodTo, posicoesSelecionadas]);

  const handleNewUpload = useCallback(() => {}, []);

  /**
   * Consulta abre o mesmo painel de detalhe. Se o cliente já está na base do AGC,
   * usa o registro real (com métricas); senão monta um mínimo — o painel busca
   * cadastro, ranking, itens e pedidos direto do banco pelo código.
   */
  const abrirClienteDaConsulta = useCallback((codcli: number, c: ClienteBusca) => {
    const doAGC = clientes.find(x => x.Codigo === String(codcli));
    if (doAGC) { setSelectedCliente(doAGC); return; }
    setSelectedCliente({
      Codigo: String(codcli),
      Nome: c.cliente || `Cliente ${codcli}`,
      Vendedor: nomeRCA(c.rca_vendedor) || "",
      Objetivo_R$: 0,
      TM_Mes: 0,
      TM_Pedido: 0,
      Ciclo_Medio_d: 0,
      MCC: 0,
      Meses_1a_Compra: 0,
      Dias_Sem_Compra: 0,
      Status: c.ativo ? "Ativo" : "Inativo",
      Dias_Para_Acao: 0,
      Proxima_Acao: "",
      N_Pedidos: 0,
      Fat_Total: 0,
      Primeira_Compra: "",
      Ultima_Compra: "",
      Segmento: "",
      meses: {},
    });
  }, [clientes]);

  const exportAll = () => {
    const headers = ["Codigo", "Nome", "Vendedor", "Status", "TM_Mes", "Objetivo_R$", "Ciclo_Medio_d", "MCC", "Dias_Sem_Compra", "Proxima_Acao", "Fat_Total", ...mesesCols];
    const rows = filtered.map(c => [
      c.Codigo, c.Nome, c.Vendedor, c.Status, String(c.TM_Mes), String(c.Objetivo_R$),
      String(c.Ciclo_Medio_d), String(c.MCC), String(c.Dias_Sem_Compra), c.Proxima_Acao,
      String(c.Fat_Total), ...mesesCols.map(m => String(c.meses[m] || 0))
    ]);
    downloadFile(exportCSV(headers, rows), "grandes_contas_export.csv");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!csvLoaded && role === "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Nenhum dado carregado no banco de dados.</p>
      </div>
    );
  }

  if (!csvLoaded && role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Nenhum dado carregado. Aguarde o administrador importar o CSV.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader onNewUpload={handleNewUpload} isGestor={isGestor} onOpenConfig={() => setShowConfigMetas(true)} />
      <div className="container px-4 py-4">
        {activeTab !== "interior" && activeTab !== "consulta" && (
          <>
            {somenteVendasProprias && (
              <div className="mb-3 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-xs text-green-700 flex items-center gap-2">
                <span>✅ Exibindo apenas vendas próprias do vendedor</span>
                <button onClick={() => setSomenteVendasProprias(false)} className="underline">Mostrar todas</button>
              </div>
            )}
            {activeTab !== "inadimplencia" && (
              <>
                <KPIBar clientes={filtered} mesesNoPeriodo={mesesNoPeriodo} vendasFora={vendasFora} />
                <TendenciaMeta
                  clientes={filtered}
                  periodFrom={periodFrom}
                  periodTo={periodTo}
                  isGestor={isGestor}
                  refreshKey={metasVersion}
                />
              </>
            )}
            <Filters vendedor={vendedor} setVendedor={setVendedor} regiao={regiao} setRegiao={setRegiao} status={status} setStatus={setStatus} busca={busca} setBusca={setBusca} somenteVendasProprias={somenteVendasProprias} setSomenteVendasProprias={setSomenteVendasProprias} posicoesAtivas={posicoesAtivas} setPosicoesAtivas={setPosicoesAtivas} />
            {activeTab !== "inadimplencia" && (
              <PeriodFilter from={periodFrom} to={periodTo} onFromChange={setPeriodFrom} onToChange={setPeriodTo} onReset={resetPeriod} />
            )}
          </>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <div className="flex items-center justify-between mb-3">
            <TabsList>
              {role === "admin" && <TabsTrigger value="visao">Visão Geral</TabsTrigger>}
              <TabsTrigger value="clientes">Lista de Clientes</TabsTrigger>
              <TabsTrigger value="heatmap">Heatmap Mensal</TabsTrigger>
              <TabsTrigger value="agenda">Agenda de Visitas</TabsTrigger>
              <TabsTrigger value="ranking">Ranking</TabsTrigger>
              <TabsTrigger value="consulta">Consulta</TabsTrigger>
              <TabsTrigger value="inadimplencia">
                Inadimplência
                {inadimplenciaCount > 0 && (
                  <span className="ml-1.5 text-[10px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full leading-none">
                    {inadimplenciaCount}
                  </span>
                )}
              </TabsTrigger>
              {!isVendedorRestrito && <TabsTrigger value="registro">Relatório de Visitas</TabsTrigger>}
              {isGestor && (
                <TabsTrigger value="pendencias">
                  Pendências
                  {pendenciasCount > 0 && (
                    <span className="ml-1.5 text-[10px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full leading-none">
                      {pendenciasCount}
                    </span>
                  )}
                </TabsTrigger>
              )}
              {hasInterior && <TabsTrigger value="interior">Interior</TabsTrigger>}
            </TabsList>
            <Button variant="outline" size="sm" onClick={exportAll}>
              <Download size={14} className="mr-1" /> Exportar CSV
            </Button>
          </div>

          {role === "admin" && (
            <TabsContent value="visao">
              <VisaoGeral clientes={filtered} mesesNoPeriodo={mesesNoPeriodo} vendasFora={vendasFora} />
            </TabsContent>
          )}

          <TabsContent value="clientes">
            {role === "admin" && (
              <div className="mb-3">
                <Button size="sm" onClick={() => setShowNovoCliente(true)}>
                  <Plus size={14} className="mr-1" /> Novo cliente
                </Button>
              </div>
            )}
            <ClienteTable clientes={filtered} onSelect={setSelectedCliente} vendasFora={vendasFora} />
          </TabsContent>
          <TabsContent value="heatmap">
            <HeatmapTable clientes={filtered} mesesCols={mesesCols} />
          </TabsContent>
          <TabsContent value="agenda">
            <AgendaVisitasV2 />
          </TabsContent>
          <TabsContent value="ranking">
            <RankingTable clientes={filtered} />
          </TabsContent>
          <TabsContent value="consulta">
            <ConsultaClientes onSelectCliente={abrirClienteDaConsulta} />
          </TabsContent>
          <TabsContent value="inadimplencia">
            <InadimplenciaAGC vendedorFiltro={vendedorEfetivo || undefined} />
          </TabsContent>
          {!isVendedorRestrito && (
            <TabsContent value="registro">
              <RelatorioVisitas />
            </TabsContent>
          )}
          {isGestor && (
            <TabsContent value="pendencias">
              <PendenciasAGC
                isGestor={isGestor}
                usuario={user?.email ?? permissions?.nome ?? "gestor"}
                onPendenciasChange={setPendenciasCount}
              />
            </TabsContent>
          )}
          <TabsContent value="interior">
            <div className="space-y-4">
              {/* KPIs Interior */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "Total", value: String(filteredInterior.length), cls: "" },
                  { label: "Fat. Total", value: fmtBRL(filteredInterior.reduce((s, c) => s + c.Fat_Total, 0)), cls: "" },
                  { label: "Ativos", value: String(filteredInterior.filter(c => c.Status === "Ativo").length), cls: "badge-active" },
                  { label: "Risco", value: String(filteredInterior.filter(c => c.Status === "Risco").length), cls: "badge-risk" },
                  { label: "Inativos", value: String(filteredInterior.filter(c => c.Status === "Inativo").length), cls: "badge-inactive" },
                ].map(c => (
                  <div key={c.label} className="bg-card rounded-lg shadow-sm border p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
                    <div className={`text-lg font-semibold ${c.cls}`}>{c.value}</div>
                  </div>
                ))}
              </div>
              {/* Filters Interior */}
              <div className="flex flex-wrap items-center gap-2">
                {!isVendedorRestrito && (
                  <>
                    <span className="text-xs text-muted-foreground font-medium">Vendedor:</span>
                    {["Todos", ...vendedoresInterior].map(v => (
                      <Button key={v} size="sm" variant={intVendedor === v ? "default" : "outline"} onClick={() => setIntVendedor(v)} className="text-xs h-7">
                        {v}
                      </Button>
                    ))}
                  </>
                )}
                <span className={`text-xs text-muted-foreground font-medium ${!isVendedorRestrito ? "ml-4" : ""}`}>Status:</span>
                {["Todos", "Ativo", "Risco", "Inativo"].map(s => (
                  <Button key={s} size="sm" variant={intStatus === s ? "default" : "outline"} onClick={() => setIntStatus(s)} className="text-xs h-7">
                    {s}
                  </Button>
                ))}
              </div>
              <div className="max-w-xs">
                <Input
                  placeholder="Buscar por nome ou código..."
                  value={intBusca}
                  onChange={e => setIntBusca(e.target.value)}
                  className="text-sm"
                />
              </div>
              <ClienteTable clientes={filteredInterior} onSelect={setSelectedCliente} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {selectedCliente && (
        <ClientePanel
          cliente={selectedCliente}
          onClose={() => setSelectedCliente(null)}
        />
      )}

      <NovoClienteModal open={showNovoCliente} onOpenChange={setShowNovoCliente} />

      {isGestor && (
        <ConfigMetas
          open={showConfigMetas}
          onOpenChange={setShowConfigMetas}
          usuario={user?.email ?? permissions?.nome ?? "gestor"}
          onSaved={() => setMetasVersion(v => v + 1)}
        />
      )}
    </div>
  );
};

const PermissionsGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { permissions, loading, error } = usePermissions();
  const { signOut, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!permissions) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border rounded-lg shadow-sm p-6 text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Acesso não autorizado</h1>
          <p className="text-sm text-muted-foreground">
            O e-mail <strong>{user?.email}</strong> não possui permissão para acessar este aplicativo.
            Entre em contato com o administrador.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button variant="outline" size="sm" onClick={signOut}>Sair</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const Index = () => (
  <PermissionsGate>
    <EmpresaProvider>
      <AppDataProvider>
        <Dashboard />
      </AppDataProvider>
    </EmpresaProvider>
  </PermissionsGate>
);

export default Index;
