import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  role: "admin" | "vendedor" | null;
  vendorName: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState>(null!);
export const useAuth = () => useContext(AuthCtx);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "vendedor" | null>(null);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserMeta = async (u: User) => {
    // Get role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.id)
      .limit(1);
    const r = roles?.[0]?.role as "admin" | "vendedor" | null;
    setRole(r);

    // Get vendor name if vendedor
    if (r === "vendedor") {
      const { data } = await supabase.rpc("get_vendor_name_for_user", { _user_id: u.id });
      setVendorName(data || null);
    } else {
      setVendorName(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        await loadUserMeta(u);
      } else {
        setRole(null);
        setVendorName(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        await loadUserMeta(u);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    return null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthCtx.Provider value={{ user, role, vendorName, loading, signIn, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
};
