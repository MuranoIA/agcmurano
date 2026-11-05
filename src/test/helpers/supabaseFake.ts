/**
 * Cliente Supabase falso para os testes.
 *
 * O cliente real encadeia chamadas (`from("x").select().eq().range()`) e só devolve
 * o resultado quando alguém dá `await`. Aqui, qualquer método encadeado é aceito,
 * fica registrado na lista `log` e o `await` final devolve o que o teste definir.
 * Assim dá para testar as regras de negócio sem rede e sem banco.
 */

export interface Resultado {
  data?: unknown;
  error?: unknown;
}

export interface Registro {
  nome: string;
  args: unknown[];
}

export interface ChamadaFrom {
  tabela: string;
  log: Registro[];
}

export interface ChamadaRpc {
  nome: string;
  args: unknown;
}

export interface ConfigFake {
  /** Decide o resultado de uma consulta `from(tabela)...` depois do `await`. */
  from?: (tabela: string, log: Registro[]) => Resultado | Promise<Resultado>;
  /** Decide o resultado de `rpc(nome, args)`. */
  rpc?: (nome: string, args: unknown) => Resultado | Promise<Resultado>;
}

const VAZIO: Resultado = { data: [], error: null };

function criarEncadeavel(resolver: (log: Registro[]) => Resultado | Promise<Resultado>) {
  const log: Registro[] = [];
  const proxy: any = new Proxy(() => undefined, {
    get(_alvo, prop) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) =>
          Promise.resolve(resolver(log)).then(ok, falha);
      }
      return (...args: unknown[]) => {
        log.push({ nome: String(prop), args });
        return proxy;
      };
    },
  });
  return { proxy, log };
}

export function criarClienteFake(config: ConfigFake = {}) {
  const froms: ChamadaFrom[] = [];
  const rpcs: ChamadaRpc[] = [];

  return {
    froms,
    rpcs,
    from(tabela: string) {
      const { proxy, log } = criarEncadeavel(l => (config.from ? config.from(tabela, l) : VAZIO));
      froms.push({ tabela, log });
      return proxy;
    },
    rpc(nome: string, args: unknown) {
      rpcs.push({ nome, args });
      return Promise.resolve(config.rpc ? config.rpc(nome, args) : VAZIO);
    },
    /** Todas as chamadas feitas a uma tabela. */
    daTabela(tabela: string) {
      return froms.filter(f => f.tabela === tabela);
    },
    /** Argumentos da primeira chamada de `metodo` dentro de uma consulta (ex.: "eq"). */
    arg(chamada: ChamadaFrom, metodo: string): unknown[] | undefined {
      return chamada.log.find(r => r.nome === metodo)?.args;
    },
  };
}

export type ClienteFake = ReturnType<typeof criarClienteFake>;
