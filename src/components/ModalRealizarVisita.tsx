import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AgendaVisita, updateVisita, errMsg } from "@/lib/agendaService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visita: AgendaVisita | null;
  nome: string;
  onSaved: () => void;
}

const RESULTADOS = [
  { value: "venda", label: "Venda realizada" },
  { value: "reagendar", label: "Reagendar" },
  { value: "sem_interesse", label: "Sem interesse" },
  { value: "ausente", label: "Cliente ausente" },
  { value: "outro", label: "Outro" },
] as const;

const ModalRealizarVisita: React.FC<Props> = ({ open, onOpenChange, visita, nome, onSaved }) => {
  const [vendeu, setVendeu] = useState(false);
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [resultado, setResultado] = useState<string>("venda");
  const [novaData, setNovaData] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && visita) {
      setVendeu(visita.vendeu ?? false);
      setValor(visita.valor_venda ? String(visita.valor_venda) : "");
      setObs(visita.observacao ?? "");
      setResultado(visita.resultado || "venda");
      setNovaData(visita.data_visita);
    }
  }, [open, visita]);

  if (!visita) return null;

  const isReagendar = resultado === "reagendar";

  const salvar = async () => {
    if (isReagendar && !novaData) {
      toast.error("Escolha a nova data para reagendar");
      return;
    }
    setSaving(true);
    try {
      const valorNum = vendeu ? parseFloat(valor.replace(",", ".")) || 0 : 0;
      if (isReagendar) {
        await updateVisita(visita.id, {
          status: "reagendada",
          resultado,
          observacao: obs || null,
          data_visita: novaData,
          mes_referencia: novaData.slice(0, 7),
          vendeu: false,
          valor_venda: 0,
        });
        toast.success("Visita reagendada");
      } else {
        await updateVisita(visita.id, {
          status: "realizada",
          vendeu,
          valor_venda: valorNum,
          observacao: obs || null,
          resultado,
        });
        toast.success("Visita registrada!");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao salvar: " + errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Visita</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm">
            Cliente: <span className="font-medium">{nome}</span>{" "}
            <span className="text-muted-foreground">({visita.cod_cliente})</span>
          </div>

          {!isReagendar && (
            <>
              <div>
                <Label className="mb-1.5 block">Vendeu?</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={vendeu ? "default" : "outline"} onClick={() => setVendeu(true)}>
                    Sim
                  </Button>
                  <Button type="button" size="sm" variant={!vendeu ? "default" : "outline"} onClick={() => setVendeu(false)}>
                    Não
                  </Button>
                </div>
              </div>

              {vendeu && (
                <div>
                  <Label htmlFor="valor">Valor da venda (R$)</Label>
                  <Input
                    id="valor"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={valor}
                    onChange={e => setValor(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          <div>
            <Label className="mb-1.5 block">Resultado</Label>
            <RadioGroup value={resultado} onValueChange={setResultado}>
              {RESULTADOS.map(r => (
                <div key={r.value} className="flex items-center gap-2">
                  <RadioGroupItem value={r.value} id={`res-${r.value}`} />
                  <Label htmlFor={`res-${r.value}`} className="font-normal cursor-pointer">{r.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {isReagendar && (
            <div>
              <Label htmlFor="novaData">Nova data</Label>
              <Input id="novaData" type="date" value={novaData} onChange={e => setNovaData(e.target.value)} />
            </div>
          )}

          <div>
            <Label htmlFor="obs">Observação</Label>
            <Textarea id="obs" rows={3} value={obs} onChange={e => setObs(e.target.value)} placeholder="Anotações da visita..." />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={saving}>
              {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ModalRealizarVisita;
