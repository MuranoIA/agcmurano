import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VENDEDORES } from "@/lib/types";
import { useAppData } from "@/contexts/AppDataContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

const NovoClienteModal: React.FC<Props> = ({ open, onClose }) => {
  const { mesesCols, refreshData } = useAppData();
  const lastMonth = mesesCols[mesesCols.length - 1] || "";
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [valorMes, setValorMes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!codigo.trim() || !nome.trim()) {
      toast.error("Código e Nome são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const meses: Record<string, number> = {};
      if (lastMonth && valorMes) {
        meses[lastMonth] = parseFloat(valorMes.replace(",", ".")) || 0;
      }
      const { error } = await supabase.from("clientes").insert({
        codigo: codigo.trim(),
        nome: nome.trim(),
        vendedor: vendedor || null,
        meses: meses as unknown as Json,
        status: "Ativo",
        fat_total: 0,
        tm_mes: 0,
        ciclo_medio_d: 0,
        mcc: 0,
        dias_sem_compra: 0,
        objetivo_rs: 0,
        n_pedidos: 0,
      });
      if (error) throw error;
      toast.success("Cliente adicionado!");
      await refreshData();
      setCodigo(""); setNome(""); setVendedor(""); setValorMes("");
      onClose();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Código</Label>
            <Input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ex: 12345" />
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do cliente" />
          </div>
          <div>
            <Label>Vendedor</Label>
            <select className="w-full border rounded px-3 py-2 text-sm bg-card" value={vendedor} onChange={e => setVendedor(e.target.value)}>
              <option value="">Nenhum</option>
              {VENDEDORES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          {lastMonth && (
            <div>
              <Label>Valor {lastMonth}</Label>
              <Input value={valorMes} onChange={e => setValorMes(e.target.value)} placeholder="0" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NovoClienteModal;
