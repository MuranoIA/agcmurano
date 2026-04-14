import React from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/contexts/AppDataContext";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onNewUpload: () => void;
}

const AppHeader: React.FC<Props> = ({ onNewUpload }) => {
  const { csvLoaded, forceApiRefresh } = useAppData();
  const { signOut, user } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-md">
      <div className="container flex items-center justify-between h-14 px-4">
        <h1 className="text-lg font-bold tracking-tight">Grandes Contas</h1>
        <div className="flex items-center gap-2">
          {csvLoaded && (
            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={forceApiRefresh}>
              <RefreshCw size={16} className="mr-1" /> Atualizar agora
            </Button>
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
