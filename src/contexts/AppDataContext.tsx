import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Cliente, OverlayStore, Visita } from "@/lib/types";
import { parseCSV } from "@/lib/csvParser";
import {
  fetchClientes,
  upsertClientes,
  fetchFullOverlay,
  fetchOverlayVisitas,
  dbSetVendedor,
  dbSetValorMes,
  dbBulkSetValoresMes,
  dbAddVisita,
  dbRemoveVisita,
  subscribeToOverlayChanges,
  bulkUpdateClienteFields,
} from "@/lib/supabaseService";
import { recalcAllClientes } from "@/lib/recalcClientes";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface AppState {
  clientes: Cliente[];
  mesesCols: string[];
  csvLoaded: boolean;
  overlay: OverlayStore;
  visitas: (Visita & { id?: string })[];
  loading: boolean;
  apiCodigos: Set<string>;
  lastApiUpdate: string | null;
  forceApiRefresh: () => Promise<void>;
  loadCSV: (text: string) => Promise<void>;
  refreshData: () => Promise<void>;
  setVendedor: (codigo: string, vendedor: string) => Promise<void>;
  setValorMes: (codigo: string, mes: string, valor: number) => Promise<void>;
  addVisita: (v: Visita) => Promise<void>;
  removeVisita: (id: string) => Promise<void>;
}

const Ctx = createContext<AppState>(null!);
export const useAppData = () => useContext(Ctx);

function applyOverlay(raw: Cliente[], overlay: OverlayStore): Cliente[] {
  return raw.map(c => {
    const vendedor = overlay.vendedores[c.Codigo] || c.Vendedor;
    const meses = { ...c.meses };
    if (overlay.valores_mes[c.Codigo]) {
      Object.entries(overlay.valores_mes[c.Codigo]).forEach(([m, v]) => { meses[m] = v; });
    }
    return { ...c, Vendedor: vendedor, meses };
  });
}

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, vendorName } = useAuth();
  const [rawClientes, setRawClientes] = useState<Cliente[]>([]);
  const [mesesCols, setMesesCols] = useState<string[]>([]);
  const [csvLoaded, setCsvLoaded] = useState(false);
  const [overlay, setOverlay] = useState<OverlayStore>({ vendedores: {}, valores_mes: {}, visitas: [] });
  const [visitas, setVisitas] = useState<(Visita & { id?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  // apiOverlay: { codigo: { "Mmm/AA": valor } }
  const [apiOverlay, setApiOverlay] = useState<Record<string, Record<string, number>>>({});
  const [apiCodigos, setApiCodigos] = useState<Set<string>>(new Set());
  const [lastApiUpdate, setLastApiUpdate] = useState<string | null>(null);

  const fmtTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  const fetchApiFaturamento = useCallback(async (showToasts = false) => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const baseUrl = `https://${projectId}.supabase.co/functions/v1/fetch-faturamento`;

      // Build month ranges from Jan/2025 to current month
      const now = new Date();
      const months: { start: string; end: string; label: string }[] = [];
      const mesesNomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

      let y = 2025, m = 0; // Jan 2025
      while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth())) {
        const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(y, m + 1, 0).getDate();
        const end = `${y}-${String(m + 1).padStart(2, "0")}-${lastDay}`;
        const label = `${mesesNomes[m]}/${String(y).slice(2)}`;
        months.push({ start, end, label });
        m++;
        if (m > 11) { m = 0; y++; }
      }

      // Fetch all months in parallel (batches of 4 to avoid overload)
      const allData: { label: string; items: any[] }[] = [];
      for (let i = 0; i < months.length; i += 4) {
        const batch = months.slice(i, i + 4);
        const results = await Promise.all(
          batch.map(async (mo) => {
            const res = await fetch(`${baseUrl}?data_inicio=${mo.start}&data_fim=${mo.end}`);
            if (!res.ok) return { label: mo.label, items: [] };
            const data = await res.json();
            return { label: mo.label, items: Array.isArray(data) ? data : [] };
          })
        );
        allData.push(...results);
      }

      // Group by codigo + month label
      const totals: Record<string, Record<string, number>> = {};
      const allCodes = new Set<string>();
      allData.forEach(({ label, items }) => {
        items.forEach((item: any) => {
          if (item.tipo === "VENDA" && item.codigo_cliente) {
            const code = String(item.codigo_cliente);
            allCodes.add(code);
            if (!totals[code]) totals[code] = {};
            totals[code][label] = (totals[code][label] || 0) + (Number(item.valor) || 0);
          }
        });
      });

      setApiOverlay(totals);
      setApiCodigos(allCodes);
      const time = fmtTime();
      setLastApiUpdate(time);
      if (showToasts) toast.success(`✅ Dados atualizados às ${time} (${months.length} meses)`);
    } catch (err) {
      console.warn("API faturamento indisponível:", err);
      const time = lastApiUpdate || "--:--";
      if (showToasts) {
        toast.error(`⚠️ Falha ao atualizar dados da API. Última atualização: ${time}`);
      } else {
        toast(`⚠️ Falha ao atualizar dados da API. Última atualização: ${time}`, { duration: 4000 });
      }
    }
  }, [lastApiUpdate]);

  const refreshData = useCallback(async () => {
    try {
      const [clientesResult, overlayResult, visitasResult] = await Promise.all([
        fetchClientes(),
        fetchFullOverlay(),
        fetchOverlayVisitas(),
      ]);
      setRawClientes(clientesResult.clientes);
      if (clientesResult.mesesCols.length > 0) setMesesCols(clientesResult.mesesCols);
      setCsvLoaded(clientesResult.clientes.length > 0);
      setOverlay(overlayResult);
      setVisitas(visitasResult);
    } catch (err) {
      console.error("Error refreshing data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + realtime subscription
  useEffect(() => {
    refreshData();
    const unsub = subscribeToOverlayChanges(() => {
      refreshData();
    });
    return unsub;
  }, [refreshData]);

  // Fetch API faturamento after data is loaded, then every 60 min
  useEffect(() => {
    if (!csvLoaded) return;
    fetchApiFaturamento(false);
    const interval = setInterval(() => fetchApiFaturamento(false), 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [csvLoaded, fetchApiFaturamento]);

  const forceApiRefresh = useCallback(async () => {
    await fetchApiFaturamento(true);
  }, [fetchApiFaturamento]);

  const loadCSV = useCallback(async (text: string) => {
    setLoading(true);
    try {
      const { clientes: parsed, mesesCols: cols } = parseCSV(text);
      await upsertClientes(parsed);
      setRawClientes(parsed);
      setMesesCols(cols);
      setCsvLoaded(true);
      toast.success(`${parsed.length} clientes carregados no banco`);
    } catch (err: any) {
      toast.error("Erro ao salvar CSV: " + (err.message || err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSetVendedor = useCallback(async (codigo: string, vendedor: string) => {
    await dbSetVendedor(codigo, vendedor);
    setOverlay(prev => ({ ...prev, vendedores: { ...prev.vendedores, [codigo]: vendedor } }));
  }, []);

  const handleSetValorMes = useCallback(async (codigo: string, mes: string, valor: number) => {
    try {
      await dbSetValorMes(codigo, mes, valor);
      setOverlay(prev => ({
        ...prev,
        valores_mes: {
          ...prev.valores_mes,
          [codigo]: { ...(prev.valores_mes[codigo] || {}), [mes]: valor },
        },
      }));
    } catch (err: any) {
      toast.error("Erro ao salvar valor: " + (err.message || err));
      throw err;
    }
  }, []);

  const handleAddVisita = useCallback(async (v: Visita) => {
    try {
      await dbAddVisita(v);
      await refreshData();
    } catch (err: any) {
      toast.error("Erro ao registrar visita: " + (err.message || err));
      throw err;
    }
  }, [refreshData]);

  const handleRemoveVisita = useCallback(async (id: string) => {
    await dbRemoveVisita(id);
    setVisitas(prev => prev.filter(v => v.id !== id));
  }, []);

  // Monthly recalculation persistence
  const recalcRan = useRef(false);
  useEffect(() => {
    if (!csvLoaded || rawClientes.length === 0 || recalcRan.current) return;
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastKey = localStorage.getItem("ultimo_recalculo_mes");
    if (lastKey === currentKey) return;
    recalcRan.current = true;

    const recalced = recalcAllClientes(rawClientes);
    const rows = recalced.map(c => ({
      codigo: c.Codigo,
      tm_mes: c.TM_Mes,
      ciclo_medio_d: c.Ciclo_Medio_d,
      dias_sem_compra: c.Dias_Sem_Compra,
      status: c.Status,
      dias_para_acao: c.Dias_Para_Acao,
      proxima_acao: c.Proxima_Acao,
      objetivo_rs: c.Objetivo_R$,
    }));
    bulkUpdateClienteFields(rows).then(() => {
      localStorage.setItem("ultimo_recalculo_mes", currentKey);
      const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      toast.success(`✅ Dados recalculados para ${meses[now.getMonth()]}/${String(now.getFullYear()).slice(2)}`);
      refreshData();
    }).catch(err => {
      console.error("Erro no recálculo mensal:", err);
    });
  }, [csvLoaded, rawClientes, refreshData]);

  const clientes = useMemo(() => {
    let list = applyOverlay(rawClientes, overlay);
    // Apply API faturamento overlay for all months
    if (Object.keys(apiOverlay).length > 0) {
      list = list.map(c => {
        const clientOverlay = apiOverlay[c.Codigo];
        if (clientOverlay) {
          const newMeses = { ...c.meses };
          Object.entries(clientOverlay).forEach(([mes, valor]) => {
            newMeses[mes] = valor;
          });
          return { ...c, meses: newMeses };
        }
        return c;
      });
    }
    // Recalculate derived fields locally
    list = recalcAllClientes(list);
    // Filter out clients without vendedor
    list = list.filter(c => !!c.Vendedor);
    if (role === "vendedor" && vendorName) {
      list = list.filter(c => c.Vendedor === vendorName);
    }
    return list;
  }, [rawClientes, overlay, apiOverlay, role, vendorName]);

  return (
    <Ctx.Provider value={{
      clientes,
      mesesCols,
      csvLoaded,
      overlay,
      visitas: role === "vendedor" && vendorName ? visitas.filter(v => v.vendedor === vendorName) : visitas,
      loading,
      apiCodigos,
      lastApiUpdate,
      forceApiRefresh,
      loadCSV,
      refreshData,
      setVendedor: handleSetVendedor,
      setValorMes: handleSetValorMes,
      addVisita: handleAddVisita,
      removeVisita: handleRemoveVisita,
    }}>
      {children}
    </Ctx.Provider>
  );
};
