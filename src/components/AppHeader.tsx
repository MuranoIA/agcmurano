import React, { useRef, useCallback } from "react";
import { LogOut, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/contexts/AppDataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa, Empresa } from "@/contexts/EmpresaContext";

interface Props {
  onNewUpload: () => void;
}

const AppHeader: React.FC<Props> = ({ onNewUpload }) => {
  const { loadCSV } = useAppData();
  const { signOut, user, role } = useAuth();
  const { empresa, setEmpresa, empresasPermitidas } = useEmpresa();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) loadCSV(text);
    };
    reader.readAsText(file, "UTF-8");
  }, [loadCSV]);

  // Different header background per empresa
  const headerClass =
    empresa === "Venus"
      ? "sticky top-0 z-50 bg-[hsl(160_70%_22%)] text-primary-foreground shadow-md"
      : "sticky top-0 z-50 bg-primary text-primary-foreground shadow-md";

  return (
    <header className={headerClass}>
      <div className="container flex items-center justify-between h-14 px-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-bold tracking-tight truncate">{empresa}</h1>
          {empresasPermitidas.length > 1 && (
            <div className="hidden sm:flex items-center gap-1 bg-primary-foreground/10 rounded-md p-0.5">
              {empresasPermitidas.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmpresa(e as Empresa)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    empresa === e
                      ? "bg-primary-foreground text-foreground font-medium"
                      : "text-primary-foreground/80 hover:bg-primary-foreground/10"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {role === "admin" && (
            <>
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => fileRef.current?.click()}>
                <Upload size={16} className="mr-1" /> Subir CSV
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
            </>
          )}
          <span className="text-xs text-primary-foreground/70 hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={signOut}>
            <LogOut size={16} className="mr-1" /> Sair
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
