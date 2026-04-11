import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VENDEDORES } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppData } from "@/contexts/AppDataContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NovoClienteModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const { mesesCols, refreshData } = useAppData();
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [valorAbr, setValorAbr] = useState("");
  const [saving, setSaving] = useState(false);

  const lastMonth = mesesCols[mesesCols.length - 1] || "Abr/26";

  const handleSave = async () => {
    if (!codigo.trim() || !nome.trim()) {
      toast.error("Código e Nome são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const meses: Record<string, number> = {};
      const val = parseFloat(valorAbr.replace(",", ".")) || 0;
      if (val > 0) meses[lastMonth] = val;

      const { error } = await supabase.from("clientes").insert({
        codigo: codigo.trim(),
        nome: nome.trim(),
        vendedor: vendedor || null,
        status: "Inativo",
        fat_total: val,
        tm_mes: 0,
        tm_pedido: 0,
        ciclo_medio_d: 0,
        mcc: 0,
        meses_1a_compra: 0,
        dias_sem_compra: 0,
        dias_para_acao: 0,
        n_pedidos: 0,
        objetivo_rs: 0,
        meses: meses as any,
      });

      if (error) throw error;

      toast.success("Cliente adicionado com sucesso");
      await refreshData();
      setCodigo("");
      setNome("");
      setVendedor("");
      setValorAbr("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label htmlFor="codigo">Código</Label>
            <Input id="codigo" value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ex: 12345" />
          </div>
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do cliente" />
          </div>
          <div>
            <Label>Vendedor</Label>
            <Select value={vendedor} onValueChange={setVendedor}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {VENDEDORES.map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="valor">Valor {lastMonth}</Label>
            <Input id="valor" value={valorAbr} onChange={e => setValorAbr(e.target.value)} placeholder="0,00" />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NovoClienteModal;
