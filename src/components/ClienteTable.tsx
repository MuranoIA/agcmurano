import React, { useState, useMemo } from "react";
import { Cliente } from "@/lib/types";
import { useAppData } from "@/contexts/AppDataContext";
import { useAuth } from "@/contexts/AuthContext";
import { fmtBRL, fmtBRLShort } from "@/lib/format";
import { VENDEDORES } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import { ArrowUpDown, Pencil, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

interface Props {
  clientes: Cliente[];
  onSelect: (c: Cliente) => void;
}

type SortKey = keyof Cliente | "lastMonth";

const ClienteTable: React.FC<Props> = ({ clientes, onSelect }) => {
  const { mesesCols, overlay, setVendedor, setValorMes, refreshData } = useAppData();
  const { role } = useAuth();
  const lastMonth = mesesCols[mesesCols.length - 1] || "";
  const [sortKey, setSortKey] = useState<SortKey>("Fat_Total");
  const [sortAsc, setSortAsc] = useState(false);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [newCodigo, setNewCodigo] = useState("");
  const [newNome, setNewNome] = useState("");
  const [newVendedor, setNewVendedor] = useState("");
  const [newValor, setNewValor] = useState("");
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(() => {
    return [...clientes].sort((a, b) => {
      let va: any, vb: any;
      if (sortKey === "lastMonth") {
        va = a.meses[lastMonth] || 0; vb = b.meses[lastMonth] || 0;
      } else {
        va = a[sortKey]; vb = b[sortKey];
      }
      if (typeof va === "string") return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? va - vb : vb - va;
    });
  }, [clientes, sortKey, sortAsc, lastMonth]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const headers: { key: SortKey; label: string; w?: string }[] = [
    { key: "Codigo", label: "Código", w: "w-20" },
    { key: "Nome", label: "Nome", w: "w-48" },
    { key: "Vendedor", label: "Vendedor", w: "w-28" },
    { key: "Status", label: "Status", w: "w-24" },
    { key: "Ciclo_Medio_d", label: "Ciclo (d)", w: "w-20" },
    { key: "TM_Mes", label: "TM/Mês", w: "w-28" },
    { key: "Objetivo_R$", label: "Objetivo", w: "w-28" },
    { key: "lastMonth", label: lastMonth, w: "w-28" },
    { key: "MCC", label: "MCC", w: "w-16" },
    { key: "Dias_Sem_Compra", label: "Dias s/C", w: "w-20" },
    { key: "Proxima_Acao", label: "Próx. Ação", w: "w-36" },
    { key: "Fat_Total", label: "Fat. Total", w: "w-28" },
  ];

  const handleVendedorChange = (codigo: string, v: string) => {
    setVendedor(codigo, v);
  };

  const startEdit = (codigo: string, currentVal: number) => {
    setEditingCell(codigo);
    setEditValue(String(currentVal || ""));
  };

  const commitEdit = async (codigo: string) => {
    const val = parseFloat(editValue.replace(",", ".")) || 0;
    try {
      await setValorMes(codigo, lastMonth, val);
    } catch (e) {
      console.error("Erro ao salvar:", e);
    }
    setEditingCell(null);
  };

  const isEdited = (codigo: string) => !!overlay.valores_mes[codigo]?.[lastMonth];

  const handleNewCliente = async () => {
    if (!newCodigo || !newNome) { toast.error("Código e Nome são obrigatórios"); return; }
    setSaving(true);
    try {
      const meses: Record<string, number> = {};
      mesesCols.forEach(m => { meses[m] = 0; });
      const valorAbr = parseFloat(newValor.replace(",", ".")) || 0;
      if (lastMonth) meses[lastMonth] = valorAbr;

      const { error } = await supabase.from("clientes").insert({
        codigo: newCodigo,
        nome: newNome,
        vendedor: newVendedor || null,
        meses: meses as unknown as Json,
      });
      if (error) throw error;
      toast.success("Cliente adicionado!");
      setShowNewModal(false);
      setNewCodigo(""); setNewNome(""); setNewVendedor(""); setNewValor("");
      await refreshData();
    } catch (e: any) {
      toast.error("Erro: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {role === "admin" && (
        <div className="flex justify-end">
          <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus size={14} className="mr-1" /> Novo cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Cliente</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Código</Label>
                  <Input value={newCodigo} onChange={e => setNewCodigo(e.target.value)} placeholder="Ex: 5001" />
                </div>
                <div>
                  <Label>Nome</Label>
                  <Input value={newNome} onChange={e => setNewNome(e.target.value)} placeholder="Nome do cliente" />
                </div>
                <div>
                  <Label>Vendedor</Label>
                  <select className="w-full border rounded px-3 py-2 text-sm bg-card" value={newVendedor} onChange={e => setNewVendedor(e.target.value)}>
                    <option value="">Nenhum</option>
                    {VENDEDORES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Valor {lastMonth}</Label>
                  <Input value={newValor} onChange={e => setNewValor(e.target.value)} placeholder="0" />
                </div>
                <Button className="w-full" onClick={handleNewCliente} disabled={saving}>
                  {saving ? "Salvando..." : "Adicionar cliente"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              {headers.map(h => (
                <th key={h.key} className={`px-3 py-2 text-left font-medium text-muted-foreground cursor-pointer select-none ${h.w || ""}`} onClick={() => toggleSort(h.key)}>
                  <span className="flex items-center gap-1">{h.label} <ArrowUpDown size={12} /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr key={c.Codigo} className={`cursor-pointer hover:bg-muted/30 ${i % 2 ? "bg-muted/10" : ""}`} onClick={() => onSelect(c)}>
                <td className="px-3 py-2 font-mono text-xs">{c.Codigo}</td>
                <td className="px-3 py-2 font-medium truncate max-w-[200px]">{c.Nome}</td>
                <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                  {c.Vendedor ? (
                    <span className="text-sm">{c.Vendedor}</span>
                  ) : (
                    <select className="border rounded px-1 py-0.5 text-xs bg-card" onChange={e => handleVendedorChange(c.Codigo, e.target.value)} defaultValue="">
                      <option value="" disabled>Atribuir</option>
                      {VENDEDORES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  )}
                </td>
                <td className="px-3 py-2"><StatusBadge status={c.Status} /></td>
                <td className="px-3 py-2 text-right">{c.Ciclo_Medio_d}</td>
                <td className="px-3 py-2 text-right">{fmtBRL(c.TM_Mes)}</td>
                <td className="px-3 py-2 text-right">{c.Objetivo_R$ ? fmtBRL(c.Objetivo_R$) : "—"}</td>
                <td className="px-3 py-2 text-right" onClick={e => { e.stopPropagation(); startEdit(c.Codigo, c.meses[lastMonth] || 0); }}>
                  {editingCell === c.Codigo ? (
                    <span className="flex items-center gap-0.5 justify-end">
                      <input
                        autoFocus
                        className="border rounded px-1 py-0.5 w-20 text-right text-xs"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && commitEdit(c.Codigo)}
                      />
                      <button
                        className="text-primary hover:text-primary/80"
                        onClick={e => { e.stopPropagation(); commitEdit(c.Codigo); }}
                      >
                        <Check size={14} />
                      </button>
                    </span>
                  ) : (
                    <span className="flex items-center justify-end gap-1">
                      {fmtBRLShort(c.meses[lastMonth] || 0)}
                      {isEdited(c.Codigo) && <Pencil size={10} className="text-accent" />}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">{c.MCC}</td>
                <td className="px-3 py-2 text-right">{c.Dias_Sem_Compra}</td>
                <td className="px-3 py-2 text-xs">
                  <span className={c.Status === "Inativo" ? "text-status-inactive" : c.Status === "Risco" ? "text-status-risk" : "text-status-active"}>
                    {c.Proxima_Acao}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-medium">{fmtBRL(c.Fat_Total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClienteTable;
