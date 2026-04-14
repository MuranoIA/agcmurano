import React, { useRef, useCallback } from "react";
import { LogOut, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/contexts/AppDataContext";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onNewUpload: () => void;
}

const AppHeader: React.FC<Props> = ({ onNewUpload }) => {
  const { loadCSV } = useAppData();
  const { signOut, user, role } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) loadCSV(text);
    };
    reader.readAsText(file, "UTF-8");
  }, [loadCSV]);

  return (
    <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-md">
      <div className="container flex items-center justify-between h-14 px-4">
        <h1 className="text-lg font-bold tracking-tight">Grandes Contas</h1>
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
