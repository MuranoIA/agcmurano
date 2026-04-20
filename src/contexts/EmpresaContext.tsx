import React, { createContext, useContext, useState, useMemo } from "react";

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
}

const Ctx = createContext<EmpresaState>(null!);
export const useEmpresa = () => useContext(Ctx);

const STORAGE_KEY = "empresa_selecionada";

export const EmpresaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [empresa, setEmpresaState] = useState<Empresa>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "Venus" || saved === "Grandes Contas") return saved;
    return "Grandes Contas";
  });

  const setEmpresa = (e: Empresa) => {
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
    };
  }, [empresa]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
