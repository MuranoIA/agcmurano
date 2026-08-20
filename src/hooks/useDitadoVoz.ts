import { useCallback, useEffect, useRef, useState } from "react";

// ---- TIPOS MÍNIMOS DA WEB SPEECH API (não faz parte do lib.dom padrão) ----

interface ResultadoFala {
  isFinal: boolean;
  0: { transcript: string };
}

interface EventoResultado {
  resultIndex: number;
  results: { length: number; [i: number]: ResultadoFala };
}

interface Reconhecimento {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: EventoResultado) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

type ConstrutorReconhecimento = new () => Reconhecimento;

const obterConstrutor = (): ConstrutorReconhecimento | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstrutorReconhecimento;
    webkitSpeechRecognition?: ConstrutorReconhecimento;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

/** Cola o trecho ditado no fim do texto existente, sem duplicar espaço. */
const compor = (base: string, adicao: string): string => {
  const trecho = adicao.trim();
  if (!trecho) return base;
  if (!base) return trecho;
  return /\s$/.test(base) ? base + trecho : `${base} ${trecho}`;
};

interface Opcoes {
  /** Valor atual do campo — vira a base sobre a qual o ditado é concatenado. */
  valor: string;
  onChange: (novo: string) => void;
  onErro?: (mensagem: string) => void;
}

/**
 * Ditado por voz (pt-BR) que CONCATENA no campo em vez de substituir.
 *
 * O resultado parcial é reescrito a cada evento — por isso guardamos a base do
 * campo e os trechos já finalizados em refs: sem isso o texto interino entraria
 * repetido a cada callback.
 */
export function useDitadoVoz({ valor, onChange, onErro }: Opcoes) {
  const [suportado] = useState(() => obterConstrutor() !== null);
  const [gravando, setGravando] = useState(false);

  const recRef = useRef<Reconhecimento | null>(null);
  const valorRef = useRef(valor);
  const baseRef = useRef("");
  const finaisRef = useRef("");
  const desejaGravarRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onErroRef = useRef(onErro);

  valorRef.current = valor;
  onChangeRef.current = onChange;
  onErroRef.current = onErro;

  useEffect(() => () => {
    desejaGravarRef.current = false;
    recRef.current?.abort();
  }, []);

  const criar = useCallback((): Reconhecimento | null => {
    const Construtor = obterConstrutor();
    if (!Construtor) return null;

    const rec = new Construtor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = e => {
      let finalNovo = "";
      let interino = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalNovo += r[0].transcript;
        else interino += r[0].transcript;
      }
      if (finalNovo.trim()) finaisRef.current = compor(finaisRef.current, finalNovo) + " ";
      onChangeRef.current(compor(baseRef.current, finaisRef.current + interino));
    };

    rec.onerror = e => {
      // Silêncio e parada manual são fluxo normal, não erro para o usuário.
      if (e.error === "no-speech" || e.error === "aborted") return;
      desejaGravarRef.current = false;
      onErroRef.current?.(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Permissão de microfone negada"
          : "Falha na gravação por voz"
      );
    };

    rec.onend = () => {
      // O Chrome encerra sozinho após alguns segundos de silêncio — só para de
      // valer quando o usuário clica em parar.
      if (desejaGravarRef.current) {
        try {
          rec.start();
          return;
        } catch {
          desejaGravarRef.current = false;
        }
      }
      setGravando(false);
    };

    return rec;
  }, []);

  const parar = useCallback(() => {
    if (!desejaGravarRef.current) return;
    desejaGravarRef.current = false;
    recRef.current?.stop();
  }, []);

  const alternar = useCallback(() => {
    if (desejaGravarRef.current) {
      parar();
      return;
    }

    const rec = recRef.current ?? criar();
    if (!rec) return;
    recRef.current = rec;

    baseRef.current = valorRef.current;
    finaisRef.current = "";
    desejaGravarRef.current = true;
    try {
      rec.start();
      setGravando(true);
    } catch {
      desejaGravarRef.current = false;
      onErroRef.current?.("Não foi possível iniciar a gravação");
    }
  }, [criar, parar]);

  return { suportado, gravando, alternar, parar };
}
