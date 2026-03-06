import { apiClient } from './client';

export interface Invoice {
  id: string;
  stripeInvoiceId: string | null;
  stripeInvoiceUrl: string | null;
  status: string;
  amount: string;
  currency: string;
  tenantId: string;
  tenant?: { id: string; name: string };
  billingRunId: string | null;
  periodStart: string;
  periodEnd: string;
  issuedAt: string | null;
  dueDate: string | null;
  paidAt: string | null;
}

export interface InvoiceListResponse {
  data: Invoice[];
  total: number;
  page: number;
  limit: number;
}

export interface InvoiceListParams {
  status?: string;
  tenantId?: string;
  page?: number;
  limit?: number;
}

export async function getInvoices(
  params?: InvoiceListParams,
): Promise<InvoiceListResponse> {
  const { data } = await apiClient.get<InvoiceListResponse>('/invoices', {
    params,
  });
  return data;
}

export async function getInvoice(id: string): Promise<Invoice> {
  const { data } = await apiClient.get<Invoice>(`/invoices/${id}`);
  return data;
}
