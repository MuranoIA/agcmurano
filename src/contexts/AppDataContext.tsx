import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { Cliente, OverlayStore } from "@/lib/types";
import { parseCSV } from "@/lib/csvParser";
import { loadOverlay, getOverlay, subscribe, importOverlay } from "@/lib/overlayStore";

interface AppState {
  clientes: Cliente[];
  mesesCols: string[];
  csvLoaded: boolean;
  loadCSV: (text: string) => void;
  applyOverlayToClientes: (raw: Cliente[], overlay: OverlayStore) => Cliente[];
  refreshFromOverlay: () => void;
}

const Ctx = createContext<AppState>(null!);
export const useAppData = () => useContext(Ctx);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rawClientes, setRawClientes] = useState<Cliente[]>([]);
  const [mesesCols, setMesesCols] = useState<string[]>([]);
  const [csvLoaded, setCsvLoaded] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    loadOverlay();
    const unsub = subscribe(() => setTick(t => t + 1));
    return unsub;
  }, []);

  const applyOverlayToClientes = useCallback((raw: Cliente[], overlay: OverlayStore): Cliente[] => {
    return raw.map(c => {
      const vendedor = overlay.vendedores[c.Codigo] || c.Vendedor;
      const meses = { ...c.meses };
      if (overlay.valores_mes[c.Codigo]) {
        Object.entries(overlay.valores_mes[c.Codigo]).forEach(([m, v]) => { meses[m] = v; });
      }
      return { ...c, Vendedor: vendedor, meses };
    });
  }, []);

  const clientes = useMemo(() => {
    return applyOverlayToClientes(rawClientes, getOverlay());
  }, [rawClientes, applyOverlayToClientes, csvLoaded]);

  const loadCSV = useCallback((text: string) => {
    const { clientes: parsed, mesesCols: cols } = parseCSV(text);
    setRawClientes(parsed);
    setMesesCols(cols);
    setCsvLoaded(true);
  }, []);

  const refreshFromOverlay = useCallback(() => {
    setTick(t => t + 1);
  }, []);

  // Re-derive when overlay changes
  const clientesFinal = useMemo(() => {
    return applyOverlayToClientes(rawClientes, getOverlay());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawClientes, applyOverlayToClientes, /* tick triggers re-render */]);

  return (
    <Ctx.Provider value={{ clientes: clientesFinal, mesesCols, csvLoaded, loadCSV, applyOverlayToClientes, refreshFromOverlay }}>
      {children}
    </Ctx.Provider>
  );
};
