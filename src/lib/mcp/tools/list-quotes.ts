import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "list_quotes",
  title: "List quotes",
  description:
    "List recent quotes (orçamentos) visible to the signed-in user, ordered by creation date.",
  inputSchema: {
    status: z
      .enum(["pendente", "aprovado", "rejeitado", "cancelado"])
      .optional()
      .describe("Filter by quote status."),
    limit: z.number().int().min(1).max(100).optional().default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    let q = sb(ctx)
      .from("quotes")
      .select("id, quote_number, client_id, status, total_amount, created_at, valid_until")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);

    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { quotes: data ?? [] },
    };
  },
});
