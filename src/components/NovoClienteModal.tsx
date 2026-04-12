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
import { Loader2 } from "lucide-react";
import { Json } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NovoClienteModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const { refreshData } = useAppData();
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchedData, setFetchedData] = useState<{
    meses: Record<string, number>;
    fat_total: number;
    n_pedidos: number;
    mcc: number;
    tm_mes: number;
    ciclo_medio_d: number;
    objetivo_rs: number;
    tm_pedido: number;
    primeira_compra: string;
    ultima_compra: string;
  } | null>(null);
  const [apiWarning, setApiWarning] = useState("");

  const handleCodigoBlur = async () => {
    const cod = codigo.trim();
    if (!cod) return;

    setFetching(true);
    setApiWarning("");
    setFetchedData(null);

    try {
      const { data, error } = await supabase.functions.invoke("fetch-cliente-api", {
        body: null,
        headers: {},
        method: "GET",
      });

      // supabase.functions.invoke doesn't support query params well, use fetch directly
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(
        `${supabaseUrl}/functions/v1/fetch-cliente-api?codcli=${encodeURIComponent(cod)}`,
        {
          headers: {
            "Authorization": `Bearer ${anonKey}`,
            "apikey": anonKey,
          },
        }
      );

      if (!res.ok) throw new Error("Erro na API");

      const result = await res.json();

      if (!result.found) {
        setApiWarning("Código não encontrado na API. Você pode preencher manualmente.");
        setFetching(false);
        return;
      }

      // Extract name from header
      if (result.header) {
        const h = Array.isArray(result.header) ? result.header[0] : result.header;
        if (h?.nome || h?.Nome || h?.NOME || h?.razao_social || h?.RazaoSocial) {
          setNome(h.nome || h.Nome || h.NOME || h.razao_social || h.RazaoSocial || "");
        }
      }

      // Process vendas data into meses map
      const meses: Record<string, number> = {};
      let fatTotal = 0;
      let nPedidos = 0;
      let mcc = 0;
      let primeiraCompra = "";
      let ultimaCompra = "";

      if (result.vendas) {
        const vendas = Array.isArray(result.vendas) ? result.vendas : [result.vendas];
        
        for (const v of vendas) {
          // Try different key patterns for month/value
          const mes = v.mes || v.Mes || v.MES || v.periodo || v.Periodo;
          const valor = parseFloat(v.valor || v.Valor || v.VALOR || v.total || v.Total || 0);
          
          if (mes && valor) {
            meses[mes] = (meses[mes] || 0) + valor;
            fatTotal += valor;
          }

          // Count pedidos
          const pedidos = parseInt(v.n_pedidos || v.N_Pedidos || v.qtd_pedidos || v.pedidos || 1);
          nPedidos += pedidos;
        }

        // MCC = months with purchases
        mcc = Object.keys(meses).filter(k => meses[k] > 0).length;

        // Find first and last purchase dates from months
        const mesKeys = Object.keys(meses).filter(k => meses[k] > 0);
        if (mesKeys.length > 0) {
          primeiraCompra = mesKeys[0];
          ultimaCompra = mesKeys[mesKeys.length - 1];
        }
      }

      const tmMes = mcc > 0 ? fatTotal / mcc : 0;
      const cicloMedio = mcc > 0 ? 30 * (16 / mcc) : 0;
      const tmPedido = nPedidos > 0 ? fatTotal / nPedidos : 0;
      const objetivoRs = tmMes * 1.10;

      setFetchedData({
        meses,
        fat_total: fatTotal,
        n_pedidos: nPedidos,
        mcc,
        tm_mes: tmMes,
        ciclo_medio_d: cicloMedio,
        objetivo_rs: objetivoRs,
        tm_pedido: tmPedido,
        primeira_compra: primeiraCompra,
        ultima_compra: ultimaCompra,
      });

      toast.success("Dados do cliente carregados da API");
    } catch (err: any) {
      console.error("Erro ao buscar cliente na API:", err);
      setApiWarning("Não foi possível buscar na API. Preencha manualmente.");
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    if (!codigo.trim() || !nome.trim()) {
      toast.error("Código e Nome são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const row: Record<string, unknown> = {
        codigo: codigo.trim(),
        nome: nome.trim(),
        vendedor: vendedor || null,
        status: "Inativo",
        fat_total: fetchedData?.fat_total || 0,
        tm_mes: fetchedData?.tm_mes || 0,
        tm_pedido: fetchedData?.tm_pedido || 0,
        ciclo_medio_d: fetchedData?.ciclo_medio_d || 0,
        mcc: fetchedData?.mcc || 0,
        meses_1a_compra: 0,
        dias_sem_compra: 0,
        dias_para_acao: 0,
        n_pedidos: fetchedData?.n_pedidos || 0,
        objetivo_rs: fetchedData?.objetivo_rs || 0,
        primeira_compra: fetchedData?.primeira_compra || null,
        ultima_compra: fetchedData?.ultima_compra || null,
        meses: (fetchedData?.meses || {}) as unknown as Json,
      };

      const { error } = await supabase.from("clientes").insert(row as any);
      if (error) throw error;

      toast.success("Cliente adicionado com sucesso");
      await refreshData();
      setCodigo("");
      setNome("");
      setVendedor("");
      setFetchedData(null);
      setApiWarning("");
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
            <div className="relative">
              <Input
                id="codigo"
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                onBlur={handleCodigoBlur}
                placeholder="Ex: 12345"
                disabled={fetching}
              />
              {fetching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {apiWarning && (
            <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 rounded px-3 py-2">{apiWarning}</p>
          )}

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

          {fetchedData && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3 space-y-1">
              <p className="font-medium text-foreground">Dados carregados da API:</p>
              <p>Fat. Total: R$ {fetchedData.fat_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p>MCC: {fetchedData.mcc} | TM/Mês: R$ {fetchedData.tm_mes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p>Pedidos: {fetchedData.n_pedidos} | Objetivo: R$ {fetchedData.objetivo_rs.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p>Meses: {Object.keys(fetchedData.meses).length} períodos</p>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving || fetching} className="w-full">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NovoClienteModal;
