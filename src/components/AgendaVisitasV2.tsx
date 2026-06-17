import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Sparkles, Plus, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import VisitaCard from "./VisitaCard";
import ModalRealizarVisita from "./ModalRealizarVisita";
import {
  AgendaVisita,
  InteligenciaCliente,
  fetchAgenda,
  fetchInteligencia,
  fetchVendedoresAgenda,
  gerarAgendaMes,
  deleteVisita,
  moveVisita,
  addVisitaManual,
  errMsg,
  getTerca,
  diasDaSemana,
  toISODate,
  mesRefDe,
  parseISODate,
  VISITAS_OBRIGATORIAS,
  VISITAS_MAX,
} from "@/lib/agendaService";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const AgendaVisitasV2: React.FC = () => {
  const { permissions } = usePermissions();
  const isGestor = permissions?.role === "gestor";

  const [vendedores, setVendedores] = useState<string[]>([]);
  const [vendedorAtivo, setVendedorAtivo] = useState<string>("");
  const [terca, setTerca] = useState<Date>(() => getTerca(new Date()));
  const [agenda, setAgenda] = useState<AgendaVisita[]>([]);
  const [inteligencia, setInteligencia] = useState<InteligenciaCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);

  const [realizarVisita, setRealizarVisita] = useState<AgendaVisita | null>(null);
  const [addDia, setAddDia] = useState<string | null>(null);

  const dragId = useRef<number | null>(null);

  const dias = useMemo(() => diasDaSemana(terca), [terca]);
  const mesRefAtual = useMemo(() => mesRefDe(terca), [terca]);
  const editable = !!vendedorAtivo;

  // Resolver vendedor ativo conforme papel
  useEffect(() => {
    if (!permissions) return;
    if (permissions.role === "vendedor") {
      setVendedorAtivo(permissions.vendedor_filtro || "");
      return;
    }
    // gestor: carregar lista e selecionar o primeiro
    fetchVendedoresAgenda()
      .then(list => {
        setVendedores(list);
        setVendedorAtivo(prev => prev || list[0] || "");
      })
      .catch(err => toast.error("Erro ao carregar vendedores: " + errMsg(err)));
  }, [permissions]);

  // Mapas de apoio
  const nomeMap = useMemo(() => {
    const m: Record<number, string> = {};
    inteligencia.forEach(c => { m[c.cod_cliente] = c.nome; });
    return m;
  }, [inteligencia]);

  const diasSemCompraMap = useMemo(() => {
    const m: Record<number, number> = {};
    inteligencia.forEach(c => { m[c.cod_cliente] = c.dias_sem_compra; });
    return m;
  }, [inteligencia]);

  const nomeDe = useCallback((cod: number) => nomeMap[cod] || `Cliente ${cod}`, [nomeMap]);

  const loadData = useCallback(async () => {
    if (!vendedorAtivo) return;
    setLoading(true);
    try {
      // meses visíveis (a semana pode cruzar a virada de mês)
      const mesesVisiveis = [...new Set(dias.map(d => mesRefDe(d)))];
      const [intel, ...agendas] = await Promise.all([
        fetchInteligencia(vendedorAtivo, "capital"),
        ...mesesVisiveis.map(m => fetchAgenda(m, vendedorAtivo)),
      ]);
      setInteligencia(intel);
      setAgenda(agendas.flat());
    } catch (err) {
      toast.error("Erro ao carregar agenda: " + errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [vendedorAtivo, dias]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGerar = async () => {
    if (!vendedorAtivo) return;
    const label = `${MESES[terca.getMonth()]}/${terca.getFullYear()}`;
    if (!confirm(`Gerar agenda automática de ${capitalize(vendedorAtivo)} para ${label}?\n\nIsso substitui a agenda gerada automaticamente deste mês (visitas adicionadas/editadas manualmente são preservadas).`)) return;
    setGerando(true);
    try {
      const n = await gerarAgendaMes(vendedorAtivo, mesRefAtual);
      if (n === 0) toast.info("Nenhum cliente encontrado para gerar agenda");
      else toast.success(`${n} visitas geradas para ${label}`);
      await loadData();
    } catch (err) {
      toast.error("Erro ao gerar agenda: " + errMsg(err));
    } finally {
      setGerando(false);
    }
  };

  // Drag & drop
  const handleDrop = async (diaISO: string) => {
    const id = dragId.current;
    dragId.current = null;
    if (id == null) return;
    const visita = agenda.find(v => v.id === id);
    if (!visita || visita.data_visita === diaISO) return;
    const countNoDia = agenda.filter(v => v.data_visita === diaISO && v.status !== "cancelada").length;
    if (countNoDia >= VISITAS_MAX) {
      toast.error(`Máximo de ${VISITAS_MAX} visitas por dia`);
      return;
    }
    // update otimista
    setAgenda(prev => prev.map(v => (v.id === id ? { ...v, data_visita: diaISO, mes_referencia: diaISO.slice(0, 7) } : v)));
    try {
      await moveVisita(id, diaISO, countNoDia + 1);
    } catch (err) {
      toast.error("Erro ao mover visita: " + errMsg(err));
      loadData();
    }
  };

  const semanaLabel = `${String(dias[0].getDate()).padStart(2, "0")}–${String(dias[3].getDate()).padStart(2, "0")}/${MESES[dias[0].getMonth()]}/${dias[0].getFullYear()}`;

  const navSemana = (delta: number) => {
    const t = new Date(terca);
    t.setDate(t.getDate() + delta * 7);
    setTerca(t);
  };

  return (
    <div className="space-y-4">
      {/* Barra de controle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navSemana(-1)}>
            <ChevronLeft size={16} className="mr-1" /> Semana anterior
          </Button>
          <span className="text-sm font-semibold min-w-[180px] text-center">Semana {semanaLabel}</span>
          <Button variant="outline" size="sm" onClick={() => navSemana(1)}>
            Próxima semana <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {isGestor && vendedores.length > 0 && (
            <Select value={vendedorAtivo} onValueChange={setVendedorAtivo}>
              <SelectTrigger className="w-40 h-9 text-sm">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                {vendedores.map(v => (
                  <SelectItem key={v} value={v}>{capitalize(v)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={loadData} title="Atualizar">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          {editable && (
            <Button size="sm" onClick={handleGerar} disabled={gerando}>
              {gerando ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Sparkles size={14} className="mr-1" />}
              Gerar Agenda do Mês
            </Button>
          )}
        </div>
      </div>

      {!vendedorAtivo && !loading && (
        <p className="text-sm text-muted-foreground text-center py-8">Selecione um vendedor para ver a agenda.</p>
      )}

      {/* Grade da semana */}
      {vendedorAtivo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {dias.map(dia => {
            const diaISO = toISODate(dia);
            const visitasDoDia = agenda
              .filter(v => v.data_visita === diaISO)
              .sort((a, b) => a.ordem - b.ordem);
            const ativas = visitasDoDia.filter(v => v.status !== "cancelada").length;
            const incompleto = ativas < VISITAS_OBRIGATORIAS;
            return (
              <div
                key={diaISO}
                onDragOver={e => { if (editable) e.preventDefault(); }}
                onDrop={() => editable && handleDrop(diaISO)}
                className="bg-muted/30 rounded-lg p-2 min-h-[120px] flex flex-col"
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-sm font-semibold">
                    {DIAS_SEMANA[dia.getDay()]} {String(dia.getDate()).padStart(2, "0")}
                  </span>
                  <span className={`text-[10px] ${incompleto ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                    {ativas}/{VISITAS_MAX}
                  </span>
                </div>
                <div className="space-y-2 flex-1">
                  {visitasDoDia.map(v => (
                    <VisitaCard
                      key={v.id}
                      visita={v}
                      nome={v.prospeccao && v.nome_prospeccao ? v.nome_prospeccao : nomeDe(v.cod_cliente)}
                      diasSemCompra={diasSemCompraMap[v.cod_cliente]}
                      editable={editable}
                      onRealizar={() => setRealizarVisita(v)}
                      onDetalhes={() => setRealizarVisita(v)}
                      onDragStart={() => { dragId.current = v.id; }}
                      onDelete={editable ? async () => {
                        try {
                          await deleteVisita(v.id);
                          setAgenda(prev => prev.filter(x => x.id !== v.id));
                          toast.success("Visita excluída");
                        } catch (err) {
                          toast.error("Erro ao excluir: " + errMsg(err));
                        }
                      } : undefined}
                    />
                  ))}
                </div>
                {editable && ativas < VISITAS_MAX && (
                  <button
                    onClick={() => setAddDia(diaISO)}
                    className="mt-2 w-full text-xs text-muted-foreground border border-dashed rounded-md py-1.5 hover:bg-muted hover:text-foreground transition"
                  >
                    <Plus size={12} className="inline mr-1" /> Adicionar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ModalRealizarVisita
        open={!!realizarVisita}
        onOpenChange={o => !o && setRealizarVisita(null)}
        visita={realizarVisita}
        nome={realizarVisita ? (realizarVisita.prospeccao && realizarVisita.nome_prospeccao ? realizarVisita.nome_prospeccao : nomeDe(realizarVisita.cod_cliente)) : ""}
        onSaved={loadData}
      />

      {addDia && (
        <AddVisitaDialog
          open={!!addDia}
          onOpenChange={o => !o && setAddDia(null)}
          dia={addDia}
          vendedor={vendedorAtivo}
          inteligencia={inteligencia}
          agenda={agenda}
          onAdded={loadData}
        />
      )}
    </div>
  );
};

// ---- Dialog de adição manual ----

interface AddProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dia: string;
  vendedor: string;
  inteligencia: InteligenciaCliente[];
  agenda: AgendaVisita[];
  onAdded: () => void;
}

const AddVisitaDialog: React.FC<AddProps> = ({ open, onOpenChange, dia, vendedor, inteligencia, agenda, onAdded }) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<InteligenciaCliente | null>(null);
  const [prospeccao, setProspeccao] = useState(false);
  const [nomeProspeccao, setNomeProspeccao] = useState("");
  const [saving, setSaving] = useState(false);

  const suggestions = useMemo(() => {
    if (search.length < 2) return [];
    const term = search.toLowerCase();
    return inteligencia
      .filter(c => c.nome?.toLowerCase().includes(term) || String(c.cod_cliente).includes(term))
      .slice(0, 8);
  }, [search, inteligencia]);

  const salvar = async () => {
    if (prospeccao && !nomeProspeccao.trim()) { toast.error("Informe o nome do cliente"); return; }
    if (!prospeccao && !selected) { toast.error("Selecione um cliente"); return; }
    const countNoDia = agenda.filter(v => v.data_visita === dia && v.status !== "cancelada").length;
    if (countNoDia >= VISITAS_MAX) { toast.error(`Máximo de ${VISITAS_MAX} visitas por dia`); return; }
    setSaving(true);
    try {
      await addVisitaManual({
        cod_cliente: prospeccao ? 0 : selected!.cod_cliente,
        vendedor,
        data_visita: dia,
        ordem: countNoDia + 1,
        prioridade: prospeccao ? "normal" : selected!.prioridade_sugerida,
        motivo_prioridade: prospeccao ? null : selected!.motivo_prioridade,
        prospeccao,
        nome_prospeccao: prospeccao ? nomeProspeccao.trim() : undefined,
      });
      toast.success("Visita adicionada");
      onAdded();
      onOpenChange(false);
    } catch (err) {
      const m = errMsg(err);
      if (m.includes("duplicate")) {
        toast.error("Este cliente já está agendado neste dia");
      } else {
        toast.error("Erro ao adicionar: " + m);
      }
    } finally {
      setSaving(false);
    }
  };

  const diaFmt = (() => {
    const d = parseISODate(dia);
    return `${DIAS_SEMANA[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${MESES[d.getMonth()]}`;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar visita — {diaFmt}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={prospeccao}
              onCheckedChange={c => { setProspeccao(c === true); setSelected(null); }}
            />
            <span className="text-sm font-medium">Cliente fora do AGC (prospecção)</span>
          </label>

          {prospeccao ? (
            <div>
              <Label>Nome do cliente</Label>
              <Input
                placeholder="Digite o nome do cliente"
                value={nomeProspeccao}
                onChange={e => setNomeProspeccao(e.target.value)}
                autoFocus
              />
            </div>
          ) : (
            <div className="relative">
              <Label>Cliente</Label>
              <Input
                placeholder="Buscar nome ou código"
                value={search}
                onChange={e => { setSearch(e.target.value); setSelected(null); }}
              />
              {suggestions.length > 0 && !selected && (
                <div className="absolute z-30 mt-1 w-full bg-card border rounded shadow-lg max-h-52 overflow-y-auto">
                  {suggestions.map(c => (
                    <div
                      key={c.cod_cliente}
                      className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                      onClick={() => { setSelected(c); setSearch(`${c.nome} (${c.cod_cliente})`); }}
                    >
                      {c.cod_cliente} — {c.nome}
                      <span className="text-xs text-muted-foreground ml-1">· {c.dias_sem_compra}d sem compra</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving || (prospeccao ? !nomeProspeccao.trim() : !selected)}>
              {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
              Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgendaVisitasV2;
