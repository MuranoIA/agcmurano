import React, { createContext, useContext, useEffect, useState } from "react";
import { externalSupabase } from "@/integrations/supabase/externalClient";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "gestor" | "vendedor";

export interface UserPermissions {
  id: number;
  email: string;
  nome: string;
  role: AppRole;
  empresas: string[];
  vendedor_filtro: string | null;
  ativo: boolean;
}

interface PermissionsState {
  permissions: UserPermissions | null;
  loading: boolean;
  error: string | null;
}

const Ctx = createContext<PermissionsState>({ permissions: null, loading: true, error: null });
export const usePermissions = () => useContext(Ctx);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.email) {
      setPermissions(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    externalSupabase
      .from("user_permissions")
      .select("*")
      .eq("email", user.email.toLowerCase())
      .eq("ativo", true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
          setPermissions(null);
        } else {
          setPermissions((data as UserPermissions) ?? null);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.email, authLoading]);

  return (
    <Ctx.Provider value={{ permissions, loading, error }}>
      {children}
    </Ctx.Provider>
  );
};
