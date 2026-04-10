import React, { useCallback, useRef } from "react";
import { Upload } from "lucide-react";

interface Props {
  onFileLoad: (text: string) => void;
}

const UploadScreen: React.FC<Props> = ({ onFileLoad }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      onFileLoad(e.target?.result as string);
    };
    reader.readAsText(file, "UTF-8");
  }, [onFileLoad]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div
        className="border-2 border-dashed border-primary/30 rounded-2xl p-16 text-center cursor-pointer hover:border-primary/60 transition-colors max-w-lg w-full"
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mx-auto mb-4 text-primary" size={48} />
        <h2 className="text-xl font-semibold text-foreground mb-2">Carregar CSV de Grandes Contas</h2>
        <p className="text-muted-foreground text-sm">(processado)</p>
        <p className="text-muted-foreground text-xs mt-4">Arraste o arquivo aqui ou clique para selecionar</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
    </div>
  );
};

export default UploadScreen;
