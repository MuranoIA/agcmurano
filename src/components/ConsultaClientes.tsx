import React, { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { externalSupabase } from "@/integrations/supabase/externalClient";
import { fmtCpfCnpj, fmtTelefone, iniciais } from "@/lib/format";

/** Linha da tabela `clientes` retornada pela pesquisa. */
export interface ClienteBusca {
  codcli: number;
  cliente: string | null;
  cpf_cnpj: string | null;
  telefone: string | null;
  cidade: string | null;
  bairro: string | null;
  rca_vendedor: string | null;
  rca2_vendedor: string | null;
  ativo: boolean;
}

interface Props {
  onSelectCliente: (codcli: number, cliente: ClienteBusca) => void;
}

const LIMITE = 30;
const DEBOUNCE_MS = 400;

type TipoBusca = "codigo" | "documento" | "numero" | "nome";

/**
 * CPF/CNPJ é gravado com máscara ("10.318.964/0001-36") e telefone varia entre
 * "(91)3255-5603" e "9132555603". Intercalar % entre os dígitos casa com qualquer
 * máscara: "3255" -> "%3%2%5%5%".
 */
const padraoDigitos = (d: string) => `%${d.split("").join("%")}%`;

/** Detecta o que o vendedor digitou a partir do formato do termo. */
export function buildQuery(termo: string): { tipo: TipoBusca; valor: string } | null {
  const limpo = termo.trim();
  if (limpo.length < 2) return null;

  const soNumeros = limpo.replace(/\D/g, "");

  // Só dígitos: código, documento ou telefone conforme o tamanho
  if (soNumeros.length === limpo.length) {
    if (soNumeros.length <= 5) return { tipo: "codigo", valor: soNumeros };
    if (soNumeros.length >= 10) return { tipo: "documento", valor: soNumeros };
    return { tipo: "numero", valor: soNumeros };
  }

  // Digitado com máscara (123.456.789-00 / 12.345.678/0001-90 / (91) 99999-9999)
  if (soNumeros.length >= 8 && !/[a-zA-Z]/.test(limpo)) {
    return { tipo: "documento", valor: soNumeros };
  }

  return { tipo: "nome", valor: limpo };
}

export async function pesquisar(termo: string): Promise<ClienteBusca[]> {
  const q = buildQuery(termo);
  if (!q) return [];

  let query = externalSupabase
    .from("clientes")
    .select("codcli, cliente, cpf_cnpj, telefone, cidade, bairro, rca_vendedor, rca2_vendedor, ativo")
    .order("cliente")
    .limit(LIMITE);

  const padrao = padraoDigitos(q.valor);

  switch (q.tipo) {
    case "codigo":
      query = query.eq("codcli", Number(q.valor));
      break;
    case "documento":
      query = query.or(`cpf_cnpj.ilike.${padrao},telefone.ilike.${padrao}`);
      break;
    case "numero":
      query = query.or(
        `cpf_cnpj.ilike.${padrao},telefone.ilike.${padrao},codcli.eq.${Number(q.valor) || 0}`,
      );
      break;
    case "nome":
      // Fora do `or` porque o termo é livre e vírgulas quebrariam o filtro do PostgREST
      query = query.ilike("cliente", `%${q.valor}%`);
      break;
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ClienteBusca[];
}

/** "40 - LUIS GUILHERME SOUZA SANTOS" -> "Luis Guilherme Souza Santos" */
export function nomeRCA(raw?: string | null): string | null {
  const nome = (raw || "").split(" - ")[1]?.trim();
  if (!nome) return null;
  return nome.toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase());
}

const ConsultaClientes: React.FC<Props> = ({ onSelectCliente }) => {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<ClienteBusca[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (busca.trim().length < 2) {
      setResultados([]);
      setLoading(false);
      return;
    }
    let cancelado = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await pesquisar(busca);
        if (!cancelado) setResultados(res);
      } catch (err) {
        if (!cancelado) {
          console.error("Erro na pesquisa de clientes:", err);
          toast.error("Erro na pesquisa");
          setResultados([]);
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    }, DEBOUNCE_MS);
    // Digitou de novo antes do fim: descarta o timer e ignora a resposta em voo
    return () => { cancelado = true; clearTimeout(timer); };
  }, [busca]);

  const termoCurto = busca.trim().length < 2;

  return (
    <div className="space-y-4">
      <div className="max-w-xl mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Pesquisar por nome, código, CPF/CNPJ ou telefone..."
            aria-label="Pesquisar cliente"
            className="w-full pl-10 pr-9 py-3 border rounded-xl text-sm bg-card focus:outline-none focus:ring-2 focus:ring-[#621244]"
            autoFocus
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              aria-label="Limpar pesquisa"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="max-w-xl mx-auto">
        {termoCurto && (
          <div className="text-center py-12 text-muted-foreground">
            <Search size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Digite pelo menos 2 caracteres para pesquisar</p>
            <p className="text-xs mt-1">Busca por nome, código, CPF/CNPJ ou telefone</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <Loader2 className="animate-spin mx-auto mb-2 text-primary" />
            <p className="text-xs text-muted-foreground">Pesquisando...</p>
          </div>
        )}

        {!loading && !termoCurto && resultados.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Nenhum cliente encontrado</p>
          </div>
        )}

        {!loading && resultados.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground mb-2">
              {resultados.length}
              {resultados.length === LIMITE ? "+" : ""} resultado(s)
              {resultados.length === LIMITE && " — refine a busca para ver menos"}
            </p>
            <div className="space-y-2">
              {resultados.map(c => (
                <div
                  key={c.codcli}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectCliente(c.codcli, c)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSelectCliente(c.codcli, c); }}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-[#621244] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {iniciais(c.cliente)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {c.cliente || `Cliente ${c.codcli}`}
                      {!c.ativo && (
                        <span className="ml-2 text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full align-middle">
                          INATIVO
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>Cód. {c.codcli}</span>
                      {c.cpf_cnpj && <span>{fmtCpfCnpj(c.cpf_cnpj)}</span>}
                      {c.telefone && <span>📞 {fmtTelefone(c.telefone)}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground/70 truncate">
                      {[c.cidade, c.bairro].filter(Boolean).join(" — ") || "Sem endereço"}
                    </p>
                  </div>
                  <div className="text-right shrink-0 max-w-[110px]">
                    <p className="text-xs text-muted-foreground truncate" title={nomeRCA(c.rca_vendedor) || ""}>
                      {nomeRCA(c.rca_vendedor) || "Sem RCA"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ConsultaClientes;
