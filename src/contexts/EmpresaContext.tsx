import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";

export type Empresa = "Grandes Contas" | "Venus";

export const EMPRESAS: Empresa[] = ["Grandes Contas", "Venus"];

const VENDEDORES_POR_EMPRESA: Record<Empresa, string[]> = {
  "Grandes Contas": ["Jacques", "Maiara", "Hugo"],
  "Venus": ["Anne", "Thiago", "Henry", "Milene", "Thamires"],
};

const VENDEDORES_INTERIOR_POR_EMPRESA: Record<Empresa, string[]> = {
  "Grandes Contas": ["Jacques Interior", "Maiara Interior", "Hugo Interior"],
  "Venus": [],
};

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

  // Adjust selected empresa if not allowed
  useEffect(() => {
    if (empresasPermitidas.length === 0) return;
    if (!empresasPermitidas.includes(empresa)) {
      const next = empresasPermitidas[0];
      localStorage.setItem(STORAGE_KEY, next);
      setEmpresaState(next);
    }
  }, [empresasPermitidas, empresa]);

  const setEmpresa = (e: Empresa) => {
    if (empresasPermitidas.length > 0 && !empresasPermitidas.includes(e)) return;
    localStorage.setItem(STORAGE_KEY, e);
    setEmpresaState(e);
  };

  const value = useMemo<EmpresaState>(() => {
    const vendedores = VENDEDORES_POR_EMPRESA[empresa];
    const vendedoresInterior = VENDEDORES_INTERIOR_POR_EMPRESA[empresa];
    return {
      empresa,
      setEmpresa,
      vendedores,
      vendedoresInterior,
      hasInterior: vendedoresInterior.length > 0,
      empresasPermitidas,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, empresasPermitidas]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
