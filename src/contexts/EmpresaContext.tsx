import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";
import { fetchVendedoresFromDB } from "@/lib/supabaseService";

export type Empresa = "Grandes Contas" | "Venus";

export const EMPRESAS: Empresa[] = ["Grandes Contas", "Venus"];

interface EmpresaState {
  empresa: Empresa;
  setEmpresa: (e: Empresa) => void;
  vendedores: string[];
  vendedoresInterior: string[];
  hasInterior: boolean;
  empresasPermitidas: Empresa[];
}

const Ctx = createContext<EmpresaState>(null!);
export const useEmpresa = () => useContext(Ctx);

const STORAGE_KEY = "empresa_selecionada";

export const EmpresaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { permissions } = usePermissions();

  const empresasPermitidas = useMemo<Empresa[]>(() => {
    if (!permissions) return EMPRESAS;
    return EMPRESAS.filter(e => permissions.empresas?.includes(e));
  }, [permissions]);

  const [empresa, setEmpresaState] = useState<Empresa>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "Venus" || saved === "Grandes Contas") return saved;
    return "Grandes Contas";
  });

  const [vendedores, setVendedores] = useState<string[]>([]);
  const [vendedoresInterior, setVendedoresInterior] = useState<string[]>([]);

  // Adjust selected empresa if not allowed
  useEffect(() => {
    if (empresasPermitidas.length === 0) return;
    if (!empresasPermitidas.includes(empresa)) {
      const next = empresasPermitidas[0];
      localStorage.setItem(STORAGE_KEY, next);
      setEmpresaState(next);
    }
  }, [empresasPermitidas, empresa]);

  // Load vendedores dynamically from DB whenever empresa changes
  useEffect(() => {
    let cancelled = false;
    fetchVendedoresFromDB(empresa)
      .then(({ vendedores: v, vendedoresInterior: vi }) => {
        if (cancelled) return;
        setVendedores(v);
        setVendedoresInterior(vi);
      })
      .catch(err => {
        console.error("Erro ao carregar vendedores:", err);
        if (!cancelled) {
          setVendedores([]);
          setVendedoresInterior([]);
        }
      });
    return () => { cancelled = true; };
  }, [empresa]);

  const setEmpresa = (e: Empresa) => {
    if (empresasPermitidas.length > 0 && !empresasPermitidas.includes(e)) return;
    localStorage.setItem(STORAGE_KEY, e);
    setEmpresaState(e);
  };

  const value = useMemo<EmpresaState>(() => ({
    empresa,
    setEmpresa,
    vendedores,
    vendedoresInterior,
    hasInterior: vendedoresInterior.length > 0,
    empresasPermitidas,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [empresa, empresasPermitidas, vendedores, vendedoresInterior]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
