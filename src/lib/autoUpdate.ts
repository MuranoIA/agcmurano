// Atualização automática do AGC.
//
// Pelo hub (app.muranoprofessional.com.br/agc) o AGC fica aberto dentro de um quadro que
// não recarrega ao trocar de aba, então quem usa por lá ficava dias na versão antiga.
// Uma vez por dia o app pergunta ao servidor qual é a versão publicada; se mudou, recarrega
// sozinho no primeiro momento seguro: ninguém digitando, nenhuma janela (modal) aberta e
// pelo menos alguns minutos sem mexer na tela, para não perder o que está sendo preenchido.

const CHAVE_ULTIMA_VERIFICACAO = "agc:ultima-verificacao-versao";
export const INTERVALO_VERIFICACAO_MS = 24 * 60 * 60 * 1000;
const CHECAGEM_PERIODICA_MS = 60 * 60 * 1000; // olha a cada hora se já passou um dia
const OCIOSO_PARA_RECARREGAR_MS = 3 * 60 * 1000;
const TENTAR_RECARREGAR_MS = 30 * 1000;

/** "…/assets/index-DVP9_8n1.js" -> "index-DVP9_8n1.js" (a build nova troca esse nome). */
export function extrairVersao(texto: string): string | null {
  const m = texto.match(/assets\/(index-[\w-]+\.js)/);
  return m ? m[1] : null;
}

export function precisaVerificar(ultima: number | null, agora: number): boolean {
  return ultima === null || !Number.isFinite(ultima) || agora - ultima >= INTERVALO_VERIFICACAO_MS;
}

export function momentoSeguro(params: {
  agora: number;
  ultimaInteracao: number;
  digitando: boolean;
  modalAberto: boolean;
}): boolean {
  return !params.digitando && !params.modalAberto && params.agora - params.ultimaInteracao >= OCIOSO_PARA_RECARREGAR_MS;
}

function versaoCarregada(): string | null {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'));
  for (const s of scripts) {
    const v = extrairVersao(s.src);
    if (v) return v;
  }
  return null;
}

async function versaoPublicada(): Promise<string | null> {
  const res = await fetch(`/?verificar-versao=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  return extrairVersao(await res.text());
}

function lerUltima(): number | null {
  try {
    const v = localStorage.getItem(CHAVE_ULTIMA_VERIFICACAO);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function gravarUltima(t: number) {
  try {
    localStorage.setItem(CHAVE_ULTIMA_VERIFICACAO, String(t));
  } catch {
    /* sem storage: verifica de novo no próximo carregamento */
  }
}

export function iniciarAtualizacaoDiaria(): void {
  const atual = versaoCarregada();
  if (!atual) return; // ambiente de desenvolvimento (vite dev não tem assets/index-*.js)

  let ultimaInteracao = Date.now();
  const marcar = () => { ultimaInteracao = Date.now(); };
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach(ev =>
    window.addEventListener(ev, marcar, { passive: true, capture: true }),
  );

  let pendente = false;

  const tentarRecarregar = () => {
    const ativo = document.activeElement;
    const digitando = !!ativo && (ativo.tagName === "INPUT" || ativo.tagName === "TEXTAREA" || (ativo as HTMLElement).isContentEditable);
    const modalAberto = !!document.querySelector('[role="dialog"], [role="alertdialog"]');
    if (momentoSeguro({ agora: Date.now(), ultimaInteracao, digitando, modalAberto })) {
      window.location.reload();
    }
  };

  const verificar = async () => {
    if (pendente || !precisaVerificar(lerUltima(), Date.now())) return;
    try {
      const publicada = await versaoPublicada();
      gravarUltima(Date.now());
      if (publicada && publicada !== atual) {
        pendente = true;
        setInterval(tentarRecarregar, TENTAR_RECARREGAR_MS);
      }
    } catch {
      /* sem rede: tenta na próxima checagem */
    }
  };

  verificar();
  setInterval(verificar, CHECAGEM_PERIODICA_MS);
}
