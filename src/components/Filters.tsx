import React from "react";
import { VENDEDORES } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  vendedor: string;
  setVendedor: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  busca: string;
  setBusca: (v: string) => void;
}

const Filters: React.FC<Props> = ({ vendedor, setVendedor, status, setStatus, busca, setBusca }) => {
  const vendedorOpts = ["Todos", ...VENDEDORES];
  const statusOpts = ["Todos", "Ativo", "Risco", "Inativo"];

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="flex gap-1">
        {vendedorOpts.map(v => (
          <Button key={v} size="sm" variant={vendedor === v ? "default" : "outline"} onClick={() => setVendedor(v)} className="text-xs">
            {v}
          </Button>
        ))}
      </div>
      <div className="flex gap-1">
        {statusOpts.map(s => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)} className="text-xs">
            {s}
          </Button>
        ))}
      </div>
      <Input
        placeholder="Buscar por nome ou código..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
        className="max-w-xs text-sm"
      />
    </div>
  );
};

export default Filters;
