import React from "react";
import { Upload, Download, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadJSON } from "@/lib/format";
import { toast } from "sonner";
import { useAppData } from "@/contexts/AppDataContext";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onNewUpload: () => void;
}

const AppHeader: React.FC<Props> = ({ onNewUpload }) => {
  const { csvLoaded, overlay } = useAppData();
  const { isAdmin, user, signOut, role } = useAuth();

  const handleExportOverlay = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dt = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const json = JSON.stringify({ exportado_em: dt, overlay }, null, 2);
    downloadJSON(json, "grandes_contas_overlay.json");
    toast.success("Overlay exportado com sucesso");
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Logout realizado");
  };

  return (
    <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-md">
      <div className="container flex items-center justify-between h-14 px-4">
        <h1 className="text-lg font-bold tracking-tight">Grandes Contas</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={onNewUpload}>
              <Upload size={16} className="mr-1" /> Novo CSV
            </Button>
          )}
          {csvLoaded && isAdmin && (
            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={handleExportOverlay}>
              <Download size={16} className="mr-1" /> Exportar overlay
            </Button>
          )}
          <span className="text-xs text-primary-foreground/70 hidden sm:inline">
            {user?.email} ({role || "sem papel"})
          </span>
          <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={handleSignOut}>
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
