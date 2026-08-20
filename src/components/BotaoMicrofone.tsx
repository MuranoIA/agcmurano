import React from "react";

interface Props {
  gravando: boolean;
  onClick: () => void;
}

/** Botão de ditado por voz — some sozinho quando o navegador não suporta (ver useDitadoVoz). */
const BotaoMicrofone: React.FC<Props> = ({ gravando, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`shrink-0 p-2 rounded-full transition-colors ${
      gravando
        ? "bg-red-100 text-red-600 animate-pulse"
        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
    }`}
    title={gravando ? "Parar gravação" : "Gravar por voz"}
    aria-label={gravando ? "Parar gravação" : "Gravar por voz"}
    aria-pressed={gravando}
  >
    {gravando ? "⏹️" : "🎙️"}
  </button>
);

export default BotaoMicrofone;
