import React, { useState, useMemo } from "react";
import { useAppData } from "@/contexts/AppDataContext";
import { VENDEDORES, Visita } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Download, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { downloadFile, exportCSV } from "@/lib/format";

const RegistroVisitas: React.FC = () => {
  const { clientes, visitas, addVisita, removeVisita } = useAppData();

  const [search, setSearch] = useState("");
  const [selectedCodigo, setSelectedCodigo] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState(() => new Date().toTimeString().slice(0, 5));
  const [teveVenda, setTeveVenda] = useState(false);
  const [obs, setObs] = useState("");

  const [filtroVendedor, setFiltroVendedor] = useState("Todos");
  const [filtroDataIni, setFiltroDataIni] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  const suggestions = useMemo(() => {
    if (!search || search.length < 2) return [];
    const term = search.toLowerCase();
    return clientes.filter(c => c.Nome.toLowerCase().includes(term) || c.Codigo.includes(term)).slice(0, 8);
  }, [search, clientes]);

  const selectCliente = (codigo: string) => {
    setSelectedCodigo(codigo);
    const c = clientes.find(cl => cl.Codigo === codigo);
    if (c) {
      setSearch(c.Nome);
      if (c.Vendedor) setVendedor(c.Vendedor);
    }
  };

  const registrar = async () => {
    if (!selectedCodigo) { toast.error("Selecione um cliente"); return; }
    if (!vendedor) { toast.error("Selecione um vendedor"); return; }
    const c = clientes.find(cl => cl.Codigo === selectedCodigo);
    const [y, m, d] = data.split("-");
    const visita: Visita = {
      codigo: selectedCodigo,
      nome: c?.Nome || "",
      vendedor,
      data: `${d}/${m}/${y}`,
      hora,
      teve_venda: teveVenda,
      observacao: obs,
    };
    await addVisita(visita);
    setSearch(""); setSelectedCodigo(""); setVendedor(""); setObs(""); setTeveVenda(false);
    toast.success("Visita registrada!");
  };

  const handleRemove = async (id: string) => {
    if (confirm("Remover este registro de visita?")) {
      await removeVisita(id);
    }
  };

  const filteredVisitas = useMemo(() => {
    let list = [...visitas];
    if (filtroVendedor !== "Todos") list = list.filter(v => v.vendedor === filtroVendedor);
    if (filtroDataIni) {
      const [y, m, d] = filtroDataIni.split("-");
      const ini = `${d}/${m}/${y}`;
      list = list.filter(v => v.data >= ini);
    }
    if (filtroDataFim) {
      const [y, m, d] = filtroDataFim.split("-");
      const fim = `${d}/${m}/${y}`;
      list = list.filter(v => v.data <= fim);
    }
    return list;
  }, [visitas, filtroVendedor, filtroDataIni, filtroDataFim]);

  const exportarHistorico = () => {
    const headers = ["Data", "Hora", "Cliente", "Vendedor", "Houve Venda", "Observacao"];
    const rows = filteredVisitas.map(v => [v.data, v.hora, v.nome, v.vendedor, v.teve_venda ? "Sim" : "Não", v.observacao]);
    downloadFile(exportCSV(headers, rows), "historico_visitas.csv");
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg shadow-sm border p-6">
        <h3 className="font-semibold mb-4">Registrar Visita</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="relative">
            <Label>Cliente</Label>
            <Input placeholder="Buscar nome ou código" value={search} onChange={e => { setSearch(e.target.value); setSelectedCodigo(""); }} />
            {suggestions.length > 0 && !selectedCodigo && (
              <div className="absolute z-30 mt-1 w-full bg-card border rounded shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map(c => (
                  <div key={c.Codigo} className="px-3 py-2 hover:bg-muted cursor-pointer text-sm" onClick={() => selectCliente(c.Codigo)}>
                    {c.Codigo} — {c.Nome}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label>Vendedor</Label>
            <select className="w-full border rounded px-3 py-2 text-sm bg-card" value={vendedor} onChange={e => setVendedor(e.target.value)}>
              <option value="">Selecionar</option>
              {VENDEDORES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>
          <div>
            <Label>Hora</Label>
            <Input type="time" value={hora} onChange={e => setHora(e.target.value)} />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={teveVenda} onCheckedChange={setTeveVenda} />
              <Label>Houve venda?</Label>
            </div>
          </div>
          <div className="md:col-span-2 lg:col-span-1">
            <Label>Observação</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional" rows={2} />
          </div>
        </div>
        <Button className="mt-4" onClick={registrar}>
          <CheckCircle size={16} className="mr-1" /> Registrar visita
        </Button>
      </div>

      <div className="bg-card rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Histórico de Visitas ({filteredVisitas.length})</h3>
          <Button variant="outline" size="sm" onClick={exportarHistorico}>
            <Download size={14} className="mr-1" /> Exportar histórico
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 mb-4">
          <select className="border rounded px-2 py-1 text-sm bg-card" value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}>
            <option value="Todos">Todos vendedores</option>
            {VENDEDORES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <Input type="date" className="w-40" placeholder="De" value={filtroDataIni} onChange={e => setFiltroDataIni(e.target.value)} />
          <Input type="date" className="w-40" placeholder="Até" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Hora</th>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Vendedor</th>
                <th className="px-3 py-2 text-center">Venda?</th>
                <th className="px-3 py-2 text-left">Observação</th>
                <th className="px-3 py-2 text-center">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredVisitas.map((v) => (
                <tr key={v.id || `${v.data}-${v.hora}-${v.codigo}`} className="border-b hover:bg-muted/20">
                  <td className="px-3 py-2">{v.data}</td>
                  <td className="px-3 py-2">{v.hora}</td>
                  <td className="px-3 py-2">{v.nome}</td>
                  <td className="px-3 py-2">{v.vendedor}</td>
                  <td className="px-3 py-2 text-center">{v.teve_venda ? "✅" : "—"}</td>
                  <td className="px-3 py-2 text-xs max-w-[200px] truncate">{v.observacao}</td>
                  <td className="px-3 py-2 text-center">
                    {v.id && (
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(v.id!)}>
                        <Trash2 size={14} className="text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredVisitas.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma visita registrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RegistroVisitas;
