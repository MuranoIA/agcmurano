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
  somenteVendasProprias: boolean;
  setSomenteVendasProprias: (v: boolean) => void;
  posicoesAtivas: Record<string, boolean>;
  setPosicoesAtivas: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const corPosicao = (posicao: string, ativo: boolean): string => {
  if (!ativo) return "bg-gray-50 border-gray-200 text-gray-400";
  if (posicao === "DEV - Devolucao") return "bg-red-100 border-red-300 text-red-700";
  if (posicao === "F - Faturado") return "bg-green-100 border-green-300 text-green-700";
  if (posicao === "L - Liberado") return "bg-blue-100 border-blue-300 text-blue-700";
  return "bg-yellow-100 border-yellow-300 text-yellow-700";
};

const Filters: React.FC<Props> = ({ vendedor, setVendedor, regiao, setRegiao, status, setStatus, busca, setBusca, somenteVendasProprias, setSomenteVendasProprias, posicoesAtivas, setPosicoesAtivas }) => {
  const { vendedores, regioes } = useEmpresa();
  const { permissions } = usePermissions();
  const isVendedorRestrito = permissions?.role === "vendedor";
  const vendedorOpts = ["Todos", ...vendedores];
  const statusOpts = ["Todos", "Ativo", "Risco", "Inativo"];

  const nenhumaPosicao = Object.values(posicoesAtivas).every(v => !v);

  return (
    <div className="mb-4 space-y-2">
    <div className="flex flex-wrap items-center gap-3">
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
      <Button
        size="sm"
        variant={somenteVendasProprias ? "default" : "outline"}
        onClick={() => setSomenteVendasProprias(!somenteVendasProprias)}
        className={`text-xs ml-auto ${somenteVendasProprias ? "bg-green-600 hover:bg-green-700" : ""}`}
      >
        {somenteVendasProprias ? "✅ Vendas próprias" : "📊 Todas as vendas"}
      </Button>
    </div>

    {/* Toggles de posição do pedido */}
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-xs text-muted-foreground font-medium">Posição:</span>
      {Object.entries(posicoesAtivas).map(([posicao, ativo]) => (
        <button
          key={posicao}
          onClick={() => setPosicoesAtivas(prev => ({ ...prev, [posicao]: !prev[posicao] }))}
          title={posicao}
          className={`text-xs px-2 py-1 rounded-full border transition-colors ${corPosicao(posicao, ativo)}`}
        >
          {posicao.split(" - ")[0]}
        </button>
      ))}
      {nenhumaPosicao && (
        <span className="text-xs text-red-600">Nenhuma posição selecionada — os indicadores ficam zerados.</span>
      )}
    </div>
    </div>
  );
};

export default Filters;
