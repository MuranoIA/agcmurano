import { Cliente } from "./types";

/** Recalculate derived fields for a single client */
export function recalcCliente(c: Cliente): Cliente {
  const tmMes = c.MCC > 0 ? c.Fat_Total / c.MCC : 0;
  const cicloMedio = c.MCC > 0 ? 30 * (16 / c.MCC) : 0;

  // Dias_Sem_Compra = days between ultima_compra and today
  let diasSemCompra = c.Dias_Sem_Compra;
  if (c.Ultima_Compra) {
    const parts = c.Ultima_Compra.split("/");
    let ucDate: Date | null = null;
    if (parts.length === 3) {
      // DD/MM/YYYY
      ucDate = new Date(+parts[2], +parts[1] - 1, +parts[0]);
    } else {
      ucDate = new Date(c.Ultima_Compra);
    }
    if (ucDate && !isNaN(ucDate.getTime())) {
      const diffMs = Date.now() - ucDate.getTime();
      diasSemCompra = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  // Status
  let status: Cliente["Status"];
  if (cicloMedio > 0 && diasSemCompra <= cicloMedio * 1.2) {
    status = "Ativo";
  } else if (cicloMedio > 0 && diasSemCompra <= cicloMedio * 2) {
    status = "Risco";
  } else {
    status = "Inativo";
  }

  // Dias_Para_Acao
  let diasParaAcao: number;
  if (status === "Ativo") {
    diasParaAcao = Math.round(cicloMedio - diasSemCompra);
  } else if (status === "Risco") {
    diasParaAcao = 0;
  } else {
    diasParaAcao = Math.round(cicloMedio - diasSemCompra); // negative
  }

  // Proxima_Acao
  let proximaAcao: string;
  if (status === "Ativo") {
    proximaAcao = `Visitar em ${Math.max(0, diasParaAcao)}d`;
  } else if (status === "Risco") {
    proximaAcao = "Contato urgente";
  } else {
    proximaAcao = "Reativação crítica";
  }

  const objetivoRs = tmMes * 1.10;

  return {
    ...c,
    TM_Mes: tmMes,
    Ciclo_Medio_d: cicloMedio,
    Dias_Sem_Compra: diasSemCompra,
    Status: status,
    Dias_Para_Acao: diasParaAcao,
    Proxima_Acao: proximaAcao,
    Objetivo_R$: objetivoRs,
  };
}

/** Recalculate all clients */
export function recalcAllClientes(clientes: Cliente[]): Cliente[] {
  return clientes.map(recalcCliente);
}
