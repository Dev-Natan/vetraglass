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
  name: "list_low_stock",
  title: "List low stock items",
  description:
    "List inventory items whose current quantity is at or below their configured minimum.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional().default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const { data, error } = await sb(ctx)
      .from("company_stock")
      .select("id, item_template_id, company_item_id, quantity, min_quantity, location, updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 50);

    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    const low = (data ?? []).filter(
      (r: any) => Number(r.quantity ?? 0) <= Number(r.min_quantity ?? 0),
    );

    return {
      content: [{ type: "text", text: JSON.stringify(low, null, 2) }],
      structuredContent: { items: low },
    };
  },
});
