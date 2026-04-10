import React, { useState, useMemo, useCallback } from "react";
import { AppDataProvider, useAppData } from "@/contexts/AppDataContext";
import UploadScreen from "@/components/UploadScreen";
import AppHeader from "@/components/AppHeader";
import KPIBar from "@/components/KPIBar";
import Filters from "@/components/Filters";
import ClienteTable from "@/components/ClienteTable";
import HeatmapTable from "@/components/HeatmapTable";
import AgendaVisitas from "@/components/AgendaVisitas";
import RegistroVisitas from "@/components/RegistroVisitas";
import ClientePanel from "@/components/ClientePanel";
import { Cliente } from "@/lib/types";
import { isStorageAvailable } from "@/lib/overlayStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadFile, exportCSV } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const Dashboard: React.FC = () => {
  const { clientes, mesesCols, csvLoaded, loadCSV } = useAppData();
  const [vendedor, setVendedor] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const filtered = useMemo(() => {
    let list = clientes;
    if (vendedor === "Sem vendedor") list = list.filter(c => !c.Vendedor);
    else if (vendedor !== "Todos") list = list.filter(c => c.Vendedor === vendedor);
    if (status !== "Todos") list = list.filter(c => c.Status === status);
    if (busca) {
      const term = busca.toLowerCase();
      list = list.filter(c => c.Nome.toLowerCase().includes(term) || c.Codigo.includes(term));
    }
    return list;
  }, [clientes, vendedor, status, busca]);

  const handleNewUpload = useCallback(() => setShowUpload(true), []);

  const exportAll = () => {
    const headers = ["Codigo", "Nome", "Vendedor", "Status", "TM_Mes", "Objetivo_R$", "Ciclo_Medio_d", "MCC", "Dias_Sem_Compra", "Proxima_Acao", "Fat_Total", ...mesesCols];
    const rows = filtered.map(c => [
      c.Codigo, c.Nome, c.Vendedor, c.Status, String(c.TM_Mes), String(c.Objetivo_R$),
      String(c.Ciclo_Medio_d), String(c.MCC), String(c.Dias_Sem_Compra), c.Proxima_Acao,
      String(c.Fat_Total), ...mesesCols.map(m => String(c.meses[m] || 0))
    ]);
    downloadFile(exportCSV(headers, rows), "grandes_contas_export.csv");
  };

  if (!csvLoaded || showUpload) {
    return <UploadScreen onFileLoad={(text) => { loadCSV(text); setShowUpload(false); }} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader onNewUpload={handleNewUpload} />
      {!isStorageAvailable() && (
        <div className="bg-accent/10 text-accent text-center text-sm py-2">
          ⚠️ Salvamento local indisponível — use exportar overlay para não perder edições
        </div>
      )}
      <div className="container px-4 py-4">
        <KPIBar />
        <Filters vendedor={vendedor} setVendedor={setVendedor} status={status} setStatus={setStatus} busca={busca} setBusca={setBusca} />

        <Tabs defaultValue="clientes" className="mt-2">
          <div className="flex items-center justify-between mb-3">
            <TabsList>
              <TabsTrigger value="clientes">Lista de Clientes</TabsTrigger>
              <TabsTrigger value="heatmap">Heatmap Mensal</TabsTrigger>
              <TabsTrigger value="agenda">Agenda de Visitas</TabsTrigger>
              <TabsTrigger value="registro">Registro de Visitas</TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" onClick={exportAll}>
              <Download size={14} className="mr-1" /> Exportar CSV
            </Button>
          </div>

          <TabsContent value="clientes">
            <ClienteTable clientes={filtered} onSelect={setSelectedCliente} />
          </TabsContent>
          <TabsContent value="heatmap">
            <HeatmapTable clientes={filtered} />
          </TabsContent>
          <TabsContent value="agenda">
            <AgendaVisitas clientes={filtered} />
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
    </div>
  );
};

const Index = () => (
  <AppDataProvider>
    <Dashboard />
  </AppDataProvider>
);

export default Index;
