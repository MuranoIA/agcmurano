import React, { useState, useMemo, useCallback } from "react";
import { AppDataProvider, useAppData } from "@/contexts/AppDataContext";
import { useAuth } from "@/contexts/AuthContext";

import AppHeader from "@/components/AppHeader";
import KPIBar from "@/components/KPIBar";
import Filters from "@/components/Filters";
import PeriodFilter from "@/components/PeriodFilter";
import ClienteTable from "@/components/ClienteTable";
import HeatmapTable from "@/components/HeatmapTable";
import AgendaVisitas from "@/components/AgendaVisitas";
import RegistroVisitas from "@/components/RegistroVisitas";
import RankingTable from "@/components/RankingTable";
import VisaoGeral from "@/components/VisaoGeral";
import ClientePanel from "@/components/ClientePanel";
import NovoClienteModal from "@/components/NovoClienteModal";
import { Cliente } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadFile, exportCSV } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Plus } from "lucide-react";
import { parseMesCol } from "@/lib/parseMesCol";

const Dashboard: React.FC = () => {
  const { clientes, mesesCols, csvLoaded, loading } = useAppData();
  const { role } = useAuth();
  const [vendedor, setVendedor] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [periodFrom, setPeriodFrom] = useState<Date | undefined>(undefined);
  const [periodTo, setPeriodTo] = useState<Date | undefined>(undefined);

  const clientesCapital = useMemo(() => clientes.filter(c => c.Segmento !== "interior"), [clientes]);
  const clientesInterior = useMemo(() => clientes.filter(c => c.Segmento === "interior"), [clientes]);

  const filtered = useMemo(() => {
    let list = clientesCapital;
    if (vendedor !== "Todos") list = list.filter(c => c.Vendedor === vendedor);
    if (status !== "Todos") list = list.filter(c => c.Status === status);
    if (busca) {
      const term = busca.toLowerCase();
      list = list.filter(c => c.Nome.toLowerCase().includes(term) || c.Codigo.includes(term));
    }
    return list;
  }, [clientesCapital, vendedor, status, busca]);

  const [intVendedor, setIntVendedor] = useState("Todos");
  const [intStatus, setIntStatus] = useState("Todos");
  const [intBusca, setIntBusca] = useState("");

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

  const filteredMesesCols = useMemo(() => {
    if (!periodFrom && !periodTo) return mesesCols;
    return mesesCols.filter(m => {
      const d = parseMesCol(m);
      if (!d) return true;
      if (periodFrom && d < periodFrom) return false;
      if (periodTo && d > periodTo) return false;
      return true;
    });
  }, [mesesCols, periodFrom, periodTo]);

  const handleNewUpload = useCallback(() => {}, []);

  const handleResetPeriod = useCallback(() => {
    setPeriodFrom(undefined);
    setPeriodTo(undefined);
  }, []);

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
      <AppHeader onNewUpload={handleNewUpload} />
      <div className="container px-4 py-4">
        <KPIBar clientes={filtered} mesesCols={filteredMesesCols} />
        <Filters vendedor={vendedor} setVendedor={setVendedor} status={status} setStatus={setStatus} busca={busca} setBusca={setBusca} />
        <PeriodFilter from={periodFrom} to={periodTo} onFromChange={setPeriodFrom} onToChange={setPeriodTo} onReset={handleResetPeriod} />

        <Tabs defaultValue={role === "admin" ? "visao" : "clientes"} className="mt-2">
          <div className="flex items-center justify-between mb-3">
            <TabsList>
              {role === "admin" && <TabsTrigger value="visao">Visão Geral</TabsTrigger>}
              <TabsTrigger value="clientes">Lista de Clientes</TabsTrigger>
              <TabsTrigger value="heatmap">Heatmap Mensal</TabsTrigger>
              <TabsTrigger value="agenda">Agenda de Visitas</TabsTrigger>
              <TabsTrigger value="ranking">Ranking</TabsTrigger>
              <TabsTrigger value="registro">Registro de Visitas</TabsTrigger>
              <TabsTrigger value="interior">Interior</TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" onClick={exportAll}>
              <Download size={14} className="mr-1" /> Exportar CSV
            </Button>
          </div>

          {role === "admin" && (
            <TabsContent value="visao">
              <VisaoGeral clientes={filtered} mesesCols={filteredMesesCols} />
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
            <ClienteTable clientes={filtered} onSelect={setSelectedCliente} />
          </TabsContent>
          <TabsContent value="heatmap">
            <HeatmapTable clientes={filtered} mesesCols={filteredMesesCols} />
          </TabsContent>
          <TabsContent value="agenda">
            <AgendaVisitas clientes={filtered} />
          </TabsContent>
          <TabsContent value="ranking">
            <RankingTable clientes={filtered} />
          </TabsContent>
          <TabsContent value="registro">
            <RegistroVisitas />
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
    </div>
  );
};

const Index = () => (
  <AppDataProvider>
    <Dashboard />
  </AppDataProvider>
);

export default Index;
