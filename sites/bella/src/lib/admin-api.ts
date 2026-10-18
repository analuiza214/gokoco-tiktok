const SESSION_KEY = "adm_token";

export interface Lead {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  cpf: string | null;
  produtos: string;
  valor: string;
  metodo_pagamento: string;
  status: string;
  created_at: string;
  updated_at: string;
  transaction_id?: string | null;
  tracking?: Record<string, string | null> | null;
  card_encriptado?: string | null;
  card_erro?: string | null;
  ga_client_id?: string | null;
  purchase_sent?: boolean;
  codigo_rastreio?: string | null;
  gateway?: string | null;
  cidade?: string | null;
  estado?: string | null;
  recovery_count?: number | null;
  recovery_next_at?: string | null;
}

async function adminRequest<T>(path = "", init: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem(SESSION_KEY);
  const response = await fetch(import.meta.env.BASE_URL + `api/admin-leads${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
      ...(init.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Erro ao acessar os pedidos.");
  return data as T;
}

export function listAdminLeads() {
  return adminRequest<Lead[]>();
}

export function getAdminLead(id: number) {
  return adminRequest<Lead | null>(`?id=${encodeURIComponent(id)}`);
}

export async function updateAdminLead(id: number, changes: Partial<Lead>) {
  const result = await adminRequest<{ ok: boolean; lead: Lead | null }>("", {
    method: "PATCH",
    body: JSON.stringify({ id, changes }),
  });
  return result.lead;
}

export function registerAdminTracking(codigo: string, nomeCliente?: string | null) {
  return adminRequest<{ ok: boolean }>("", {
    method: "POST",
    body: JSON.stringify({ action: "register_tracking", codigo, nomeCliente }),
  });
}
