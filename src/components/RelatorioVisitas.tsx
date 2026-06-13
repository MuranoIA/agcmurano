import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, downloadFile, exportCSV } from "@/lib/format";
import {
  AgendaVisita,
  StatusVisita,
  fetchAgenda,
  fetchNomesClientes,
  errMsg,
  parseISODate,
  getTerca,
  toISODate,
} from "@/lib/agendaService";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const STATUS_LABEL: Record<StatusVisita, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  reagendada: "Reagendada",
  cancelada: "Cancelada",
};

const fmtDataBR = (iso: string) => {
  const d = parseISODate(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${MESES[d.getMonth()]}`;
};

const RelatorioVisitas: React.FC = () => {
  const [ref, setRef] = useState<Date>(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [agenda, setAgenda] = useState<AgendaVisita[]>([]);
  const [nomes, setNomes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [fVendedor, setFVendedor] = useState("Todos");
  const [fSemana, setFSemana] = useState("Todas");

  const mesRef = useMemo(() => `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`, [ref]);
  const mesLabel = `${MESES[ref.getMonth()]}/${ref.getFullYear()}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [a, n] = await Promise.all([fetchAgenda(mesRef), fetchNomesClientes()]);
      setAgenda(a);
      setNomes(n);
    } catch (err) {
      toast.error("Erro ao carregar relatório: " + errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [mesRef]);

  useEffect(() => { loadData(); }, [loadData]);

  const navMes = (delta: number) => setRef(new Date(ref.getFullYear(), ref.getMonth() + delta, 1));
  const nomeDe = (cod: number) => nomes[cod] || `Cliente ${cod}`;
  const nomeVisita = (v: AgendaVisita) => (v.prospeccao && v.nome_prospeccao ? v.nome_prospeccao : nomeDe(v.cod_cliente));

  const vendedoresList = useMemo(
    () => [...new Set(agenda.map(v => v.vendedor))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [agenda],
  );

  // Semanas (terças) presentes no mês
  const semanas = useMemo(() => {
    const set = new Map<string, string>();
    agenda.forEach(v => {
      const terca = getTerca(parseISODate(v.data_visita));
      const key = toISODate(terca);
      const fim = new Date(terca); fim.setDate(fim.getDate() + 3);
      set.set(key, `${String(terca.getDate()).padStart(2, "0")}–${String(fim.getDate()).padStart(2, "0")}/${MESES[terca.getMonth()]}`);
    });
    return [...set.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [agenda]);

  const filtrada = useMemo(() => {
    let list = [...agenda];
    if (fVendedor !== "Todos") list = list.filter(v => v.vendedor === fVendedor);
    if (fSemana !== "Todas") list = list.filter(v => toISODate(getTerca(parseISODate(v.data_visita))) === fSemana);
    return list.sort((a, b) =>
      a.data_visita.localeCompare(b.data_visita) ||
      a.vendedor.localeCompare(b.vendedor) ||
      a.ordem - b.ordem,
    );
  }, [agenda, fVendedor, fSemana]);

  // Resumo por vendedor (sobre o conjunto filtrado por semana, mas ignora filtro de vendedor)
  const resumo = useMemo(() => {
    const base = fSemana === "Todas"
      ? agenda
      : agenda.filter(v => toISODate(getTerca(parseISODate(v.data_visita))) === fSemana);
    const map = new Map<string, { agendadas: number; realizadas: number; vendas: number; valor: number }>();
    base.forEach(v => {
      const r = map.get(v.vendedor) || { agendadas: 0, realizadas: 0, vendas: 0, valor: 0 };
      r.agendadas += 1;
      if (v.status === "realizada") {
        r.realizadas += 1;
        if (v.vendeu) { r.vendas += 1; r.valor += Number(v.valor_venda) || 0; }
      }
      map.set(v.vendedor, r);
    });
    return [...map.entries()]
      .map(([vendedor, r]) => ({ vendedor, ...r, taxa: r.realizadas > 0 ? (r.vendas / r.realizadas) * 100 : 0 }))
      .sort((a, b) => a.vendedor.localeCompare(b.vendedor, "pt-BR"));
  }, [agenda, fSemana]);

  const totais = useMemo(() => resumo.reduce(
    (acc, r) => ({
      agendadas: acc.agendadas + r.agendadas,
      realizadas: acc.realizadas + r.realizadas,
      vendas: acc.vendas + r.vendas,
      valor: acc.valor + r.valor,
    }),
    { agendadas: 0, realizadas: 0, vendas: 0, valor: 0 },
  ), [resumo]);

  const exportar = () => {
    const headers = ["Data", "Cliente", "Cod", "Vendedor", "Status", "Vendeu", "Valor", "Resultado", "Observacao"];
    const rows = filtrada.map(v => [
      fmtDataBR(v.data_visita), nomeVisita(v), v.prospeccao ? "PROSPECÇÃO" : String(v.cod_cliente), capitalize(v.vendedor),
      STATUS_LABEL[v.status], v.vendeu ? "Sim" : "Não", v.vendeu ? String(v.valor_venda) : "",
      v.resultado || "", v.observacao || "",
    ]);
    downloadFile(exportCSV(headers, rows), `relatorio_visitas_${mesRef}.csv`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navMes(-1)}><ChevronLeft size={16} /></Button>
          <h3 className="font-semibold text-base min-w-[120px] text-center">Relatório — {mesLabel}</h3>
          <Button variant="outline" size="sm" onClick={() => navMes(1)}><ChevronRight size={16} /></Button>
        </div>
        <div className="flex items-center gap-2">
          <Select value={fVendedor} onValueChange={setFVendedor}>
            <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos vendedores</SelectItem>
              {vendedoresList.map(v => <SelectItem key={v} value={v}>{capitalize(v)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fSemana} onValueChange={setFSemana}>
            <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas semanas</SelectItem>
              {semanas.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData} title="Atualizar">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button variant="outline" size="sm" onClick={exportar}><Download size={14} className="mr-1" /> CSV</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={32} /></div>
      ) : (
        <>
          {/* Resumo consolidado */}
          <div className="bg-card rounded-lg shadow-sm border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-3 py-2">Vendedor</th>
                  <th className="px-3 py-2 text-center">Agendadas</th>
                  <th className="px-3 py-2 text-center">Realizadas</th>
                  <th className="px-3 py-2 text-center">Vendas</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-center">Taxa Conv.</th>
                </tr>
              </thead>
              <tbody>
                {resumo.map(r => (
                  <tr key={r.vendedor} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{capitalize(r.vendedor)}</td>
                    <td className="px-3 py-2 text-center">{r.agendadas}</td>
                    <td className="px-3 py-2 text-center">{r.realizadas}</td>
                    <td className="px-3 py-2 text-center">{r.vendas}</td>
                    <td className="px-3 py-2 text-right">{fmtBRL(r.valor)}</td>
                    <td className="px-3 py-2 text-center">{r.taxa.toFixed(1)}%</td>
                  </tr>
                ))}
                {resumo.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma visita neste período</td></tr>
                )}
              </tbody>
              {resumo.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/30 font-semibold border-t">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-center">{totais.agendadas}</td>
                    <td className="px-3 py-2 text-center">{totais.realizadas}</td>
                    <td className="px-3 py-2 text-center">{totais.vendas}</td>
                    <td className="px-3 py-2 text-right">{fmtBRL(totais.valor)}</td>
                    <td className="px-3 py-2 text-center">
                      {totais.realizadas > 0 ? ((totais.vendas / totais.realizadas) * 100).toFixed(1) : "0.0"}%
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Detalhes */}
          <div className="bg-card rounded-lg shadow-sm border overflow-x-auto">
            <div className="px-3 py-2 border-b font-semibold text-sm">Detalhes ({filtrada.length})</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Vendedor</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-center">Vendeu</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2">Observação</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map(v => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDataBR(v.data_visita)}</td>
                    <td className="px-3 py-2">
                      {nomeVisita(v)}{" "}
                      {v.prospeccao ? (
                        <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full align-middle">PROSPECÇÃO</span>
                      ) : (
                        <span className="text-muted-foreground">({v.cod_cliente})</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{capitalize(v.vendedor)}</td>
                    <td className="px-3 py-2">{STATUS_LABEL[v.status]}</td>
                    <td className="px-3 py-2 text-center">{v.status === "realizada" ? (v.vendeu ? "✅" : "—") : ""}</td>
                    <td className="px-3 py-2 text-right">{v.vendeu && v.valor_venda > 0 ? fmtBRL(v.valor_venda) : "—"}</td>
                    <td className="px-3 py-2 text-xs max-w-[220px] truncate" title={v.observacao || ""}>{v.observacao || "—"}</td>
                  </tr>
                ))}
                {filtrada.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma visita</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default RelatorioVisitas;
