/**
 * Audit log narrative helpers — convert raw JSON logs into human descriptions.
 */

type Json = Record<string, unknown> | null | undefined;

const tableNice: Record<string, string> = {
  companies: "Empresa",
  profiles: "Perfil",
  employees: "Funcionário",
  clients: "Cliente",
  quotes: "Orçamento",
  ordens_servico: "OS",
  sales: "Venda",
  expenses: "Despesa",
  product_templates: "Template",
  item_templates: "Item",
  support_tickets: "Ticket",
  cash_registers: "Caixa",
  company_items: "Item de estoque",
  company_products: "Produto",
};

const moneyKeys = new Set([
  "final_amount", "total_amount", "subtotal", "discount_amount",
  "amount", "price", "unit_price", "cost", "value", "plan_price",
  "total", "paid_amount",
]);

const dateKeys = new Set([
  "due_date", "delivery_date", "expires_at", "started_at",
  "scheduled_at", "trial_ends_at",
]);

const ignoredKeys = new Set([
  "id", "created_at", "updated_at", "company_id", "user_id",
  "created_by", "updated_by",
]);

export function formatLogValue(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (moneyKeys.has(key) && typeof v === "number") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  }
  if (dateKeys.has(key) && typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  }
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function recordLabel(table: string, data: Json, recordId: string | null): string {
  const nice = tableNice[table] || table;
  if (!data) return `${nice} ${recordId ? `#${recordId.slice(0, 8)}` : ""}`.trim();
  const d = data as Record<string, unknown>;
  const ident =
    d.quote_number || d.os_number || d.sale_number ||
    d.number || d.name || d.title || d.full_name ||
    (recordId ? recordId.slice(0, 8) : "");
  const cli = d.customer_name || d.client_name;
  const idTxt = ident ? `#${ident}` : "";
  const cliTxt = cli ? ` (Cliente: ${cli})` : "";
  return `${nice} ${idTxt}${cliTxt}`.trim();
}

export interface DiffEntry {
  key: string;
  oldValue: string;
  newValue: string;
}

export function diffFields(oldData: Json, newData: Json): DiffEntry[] {
  if (!oldData || !newData) return [];
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const out: DiffEntry[] = [];
  for (const k of keys) {
    if (ignoredKeys.has(k)) continue;
    const a = (oldData as Record<string, unknown>)[k];
    const b = (newData as Record<string, unknown>)[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    out.push({ key: k, oldValue: formatLogValue(k, a), newValue: formatLogValue(k, b) });
  }
  return out;
}

export interface Narrative {
  text: string;
  diffs: DiffEntry[];
}

export function buildNarrative(log: {
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Json;
  new_data: Json;
}, userName: string): Narrative {
  const action = (log.action || "").toLowerCase();
  const label = recordLabel(log.table_name, log.new_data || log.old_data, log.record_id);

  if (action === "delete") {
    return { text: `${userName} excluiu ${label}`, diffs: [] };
  }
  if (action === "create" || action === "insert") {
    return { text: `${userName} criou ${label}`, diffs: [] };
  }
  if (action === "update") {
    const diffs = diffFields(log.old_data, log.new_data);
    const primary = diffs.find((d) => moneyKeys.has(d.key)) || diffs[0];
    const summary = primary
      ? `${userName} alterou ${label} — ${primary.key}: ${primary.oldValue} → ${primary.newValue}`
      : `${userName} atualizou ${label}`;
    return { text: summary, diffs };
  }
  return { text: `${userName} ${action} ${label}`, diffs: [] };
}
