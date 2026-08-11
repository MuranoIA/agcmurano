import React from "react";
import { ClienteRCAInfo } from "@/lib/supabaseService";

interface Props {
  info?: ClienteRCAInfo;
  className?: string;
}

/**
 * Tag discreta exibida ao lado do nome do cliente quando o vendedor AGC
 * foi resolvido pelo RCA2 (ou seja, o RCA1 não tem mapeamento AGC ativo).
 */
const TagRCA2: React.FC<Props> = ({ info, className = "" }) => {
  if (!info?.viaRCA2) return null;

  const rca1 = info.rca1Nome || info.rca1Codigo || "sem RCA1";
  const titulo = `RCA1: ${rca1} (sem mapeamento AGC)` +
    (info.rca2Nome ? ` — vendedor definido pelo RCA2: ${info.rca2Nome}` : "");

  return (
    <span
      className={`text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full cursor-help shrink-0 ${className}`}
      title={titulo}
    >
      RCA2
    </span>
  );
};

export default TagRCA2;
