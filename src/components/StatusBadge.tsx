import React from "react";
import { Cliente } from "@/lib/types";

interface Props {
  status: Cliente["Status"];
  large?: boolean;
}

const StatusBadge: React.FC<Props> = ({ status, large }) => {
  const cls = status === "Ativo" ? "badge-active" : status === "Risco" ? "badge-risk" : "badge-inactive";
  return <span className={`${cls} ${large ? "text-sm px-3 py-1" : ""}`}>{status}</span>;
};

export default StatusBadge;
