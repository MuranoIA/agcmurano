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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);

        if (u) {
          // Non-blocking fetch to avoid deadlock with auth state
          setTimeout(async () => {
            // Get role
            const { data: roles } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", u.id)
              .limit(1);
            const r = roles?.[0]?.role as "admin" | "vendedor" | null;
            setRole(r);

            // Get vendor name via direct query
            if (r === "vendedor" && u.email) {
              const { data } = await supabase
                .from("vendor_email_mapping")
                .select("vendor_name")
                .eq("email", u.email)
                .limit(1);
              setVendorName(data?.[0]?.vendor_name || null);
            } else {
              setVendorName(null);
            }
            setLoading(false);
          }, 0);
        } else {
          setRole(null);
          setVendorName(null);
          setLoading(false);
        }
      }
    );

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
