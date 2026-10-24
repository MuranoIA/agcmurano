import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  role: "admin" | "vendedor" | null;
  vendorName: string | null;
  loading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState>(null!);

// Sem resposta do servidor de login nesse prazo, sai do carregamento e mostra o aviso no login
const AUTH_TIMEOUT_MS = 10000;
const MSG_SEM_CONEXAO = "Não foi possível conectar ao servidor de login. Tente novamente em instantes.";

const comPrazo = <T,>(p: PromiseLike<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    Promise.resolve(p).then(
      v => { clearTimeout(t); resolve(v); },
      e => { clearTimeout(t); reject(e); },
    );
  });
export const useAuth = () => useContext(AuthCtx);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "vendedor" | null>(null);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let resolvido = false;
    const prazo = setTimeout(() => {
      if (resolvido) return;
      console.error("[auth] servidor de login não respondeu em", AUTH_TIMEOUT_MS, "ms");
      setAuthError(MSG_SEM_CONEXAO);
      setLoading(false);
    }, AUTH_TIMEOUT_MS);
    const concluir = () => {
      resolvido = true;
      clearTimeout(prazo);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);

        if (u) {
          // Non-blocking fetch to avoid deadlock with auth state
          setTimeout(async () => {
            try {
              // Get role
              const { data: roles } = await comPrazo(
                supabase.from("user_roles").select("role").eq("user_id", u.id).limit(1),
                AUTH_TIMEOUT_MS,
              );
              const r = roles?.[0]?.role as "admin" | "vendedor" | null;
              setRole(r);

              // Get vendor name via direct query
              if (r === "vendedor" && u.email) {
                const { data } = await comPrazo(
                  supabase.from("vendor_email_mapping").select("vendor_name").eq("email", u.email).limit(1),
                  AUTH_TIMEOUT_MS,
                );
                setVendorName(data?.[0]?.vendor_name || null);
              } else {
                setVendorName(null);
              }
              setAuthError(null);
            } catch (e) {
              console.error("[auth] falha ao carregar perfil", e);
              setAuthError(MSG_SEM_CONEXAO);
            } finally {
              concluir();
            }
          }, 0);
        } else {
          setRole(null);
          setVendorName(null);
          concluir();
        }
      }
    );

    return () => {
      clearTimeout(prazo);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    try {
      const { error } = await comPrazo(supabase.auth.signInWithPassword({ email, password }), AUTH_TIMEOUT_MS);
      if (error) return error.message;
      setAuthError(null);
      return null;
    } catch (e) {
      console.error("[auth] login sem resposta", e);
      return MSG_SEM_CONEXAO;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthCtx.Provider value={{ user, role, vendorName, loading, authError, signIn, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
};
