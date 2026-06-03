import React from "react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  vendedor: string;
  setVendedor: (v: string) => void;
  regiao: string;
  setRegiao: (r: string) => void;
  status: string;
  setStatus: (v: string) => void;
  busca: string;
  setBusca: (v: string) => void;
}

const Filters: React.FC<Props> = ({ vendedor, setVendedor, regiao, setRegiao, status, setStatus, busca, setBusca }) => {
  const { vendedores, regioes } = useEmpresa();
  const { permissions } = usePermissions();
  const isVendedorRestrito = permissions?.role === "vendedor";
  const vendedorOpts = ["Todos", ...vendedores];
  const statusOpts = ["Todos", "Ativo", "Risco", "Inativo"];

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {!isVendedorRestrito && (
        <div className="flex gap-1">
          {vendedorOpts.map(v => (
            <Button key={v} size="sm" variant={vendedor === v ? "default" : "outline"} onClick={() => setVendedor(v)} className="text-xs">
              {v}
            </Button>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        {["Todos", ...regioes].map(r => (
          <Button key={r} size="sm" variant={regiao === r ? "default" : "outline"}
            onClick={() => setRegiao(r)} className="text-xs">
            {r === "capital" ? "Capital" : r === "vigia" ? "Vigia" : r}
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
