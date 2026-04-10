import React, { useRef } from "react";
import { Upload, Download, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportOverlayJSON, importOverlay } from "@/lib/overlayStore";
import { downloadJSON } from "@/lib/format";
import { toast } from "sonner";
import { useAppData } from "@/contexts/AppDataContext";

interface Props {
  onNewUpload: () => void;
}

const AppHeader: React.FC<Props> = ({ onNewUpload }) => {
  const { csvLoaded, refreshFromOverlay } = useAppData();
  const overlayInputRef = useRef<HTMLInputElement>(null);

  const handleExportOverlay = () => {
    const json = exportOverlayJSON();
    downloadJSON(json, "grandes_contas_overlay.json");
    toast.success("Overlay exportado com sucesso");
  };

  const handleImportOverlay = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!csvLoaded) {
      toast.error("Carregue o CSV primeiro antes de importar o overlay.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const overlay = data.overlay || data;
        importOverlay(overlay);
        refreshFromOverlay();
        toast.success("Overlay importado com sucesso");
      } catch {
        toast.error("Arquivo de overlay inválido");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-md">
      <div className="container flex items-center justify-between h-14 px-4">
        <h1 className="text-lg font-bold tracking-tight">Grandes Contas</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={onNewUpload}>
            <Upload size={16} className="mr-1" /> Novo CSV
          </Button>
          <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={handleExportOverlay}>
            <Download size={16} className="mr-1" /> Exportar overlay
          </Button>
          <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => overlayInputRef.current?.click()}>
            <FolderOpen size={16} className="mr-1" /> Importar overlay
          </Button>
          <input ref={overlayInputRef} type="file" accept=".json" className="hidden" onChange={handleImportOverlay} />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
