declare const process: { env: Record<string, string | undefined> };
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
  name: "list_clients",
  title: "List clients",
  description:
    "List the signed-in user's customer records (name, phone, email, city).",
  inputSchema: {
    search: z
      .string()
      .optional()
      .describe("Optional case-insensitive filter matching name, email or phone."),
    limit: z.number().int().min(1).max(100).optional().default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    let q = sb(ctx)
      .from("clients")
      .select("id, name, document, email, phone, city, state, is_active, created_at")
      .order("name", { ascending: true })
      .limit(limit ?? 25);

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      q = q.or(`name.ilike.${s},email.ilike.${s},phone.ilike.${s}`);
    }

    const { data, error } = await q;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { clients: data ?? [] },
    };
  },
});
