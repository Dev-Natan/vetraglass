import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type JsonResponse = {
  success: boolean;
  error?: string;
  code?: string;
  removed?: {
    products: number;
    stock: number;
    prices: number;
    companyItems: number;
    companyProductItems: number;
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ success: false, code: "CONFIG", error: "Configuração do servidor incompleta." } satisfies JsonResponse),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, code: "AUTH", error: "Você precisa estar logado." } satisfies JsonResponse),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { id, force = false } = await req.json().catch(() => ({ id: null, force: false }));
    if (!id || typeof id !== "string") {
      return new Response(
        JSON.stringify({ success: false, code: "BAD_REQUEST", error: "ID do item não informado." } satisfies JsonResponse),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // 1) Identify requester
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(
        JSON.stringify({ success: false, code: "AUTH", error: "Sessão inválida. Faça login novamente." } satisfies JsonResponse),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const userId = authData.user.id;

    // 2) Privileged client (bypasses RLS)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 3) Check SaaS admin permission
    const { data: saasAdminRow, error: saasAdminError } = await adminClient
      .from("saas_admins")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (saasAdminError) throw saasAdminError;

    if (!saasAdminRow) {
      return new Response(
        JSON.stringify({ success: false, code: "FORBIDDEN", error: "Acesso negado." } satisfies JsonResponse),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // 4) Check references (FK blockers)
    const [{ count: ptiCount, data: ptiRows, error: ptiError }, { count: stockCount, error: stockError },
      { count: priceCount, error: priceError }, { count: companyItemsCount, error: ciError },
      { count: companyProductItemsCount, error: cpiError }] = await Promise.all([
      adminClient
        .from("product_template_items")
        .select("id, company_id, product_template_id, product_templates(name)", { count: "exact" })
        .eq("item_template_id", id)
        .limit(10),
      adminClient
        .from("company_stock")
        .select("id", { count: "exact", head: true })
        .eq("item_template_id", id),
      adminClient
        .from("company_item_prices")
        .select("id", { count: "exact", head: true })
        .eq("item_template_id", id),
      adminClient
        .from("company_items")
        .select("id", { count: "exact", head: true })
        .eq("item_template_id", id),
      adminClient
        .from("company_product_items")
        .select("id", { count: "exact", head: true })
        .eq("item_template_id", id),
    ]);

    if (ptiError) throw ptiError;
    if (stockError) throw stockError;
    if (priceError) throw priceError;
    if (ciError) throw ciError;
    if (cpiError) throw cpiError;

    const hasReferences = (ptiCount ?? 0) > 0 || (stockCount ?? 0) > 0 || (priceCount ?? 0) > 0 || 
                          (companyItemsCount ?? 0) > 0 || (companyProductItemsCount ?? 0) > 0;

    // If has references and NOT force mode, return error with details
    if (hasReferences && !force) {
      if ((ptiCount ?? 0) > 0) {
        const names = Array.from(
          new Set(
            (ptiRows ?? [])
              .map((r: any) => r?.product_templates?.name)
              .filter((n: any) => typeof n === "string" && n.trim().length > 0),
          ),
        ).slice(0, 5);

        const extra = names.length ? ` Exemplos: ${names.join(", ")}.` : "";

        return new Response(
          JSON.stringify({
            success: false,
            code: "IN_USE",
            error:
              `Este item está sendo usado em ${ptiCount} produto(s). Use "Forçar exclusão" para remover de todos os produtos automaticamente.` + extra,
          } satisfies JsonResponse),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }

      if ((stockCount ?? 0) > 0) {
        return new Response(
          JSON.stringify({
            success: false,
            code: "IN_STOCK",
            error: `Este item está vinculado ao estoque (${stockCount}). Use "Forçar exclusão" para remover do estoque automaticamente.`,
          } satisfies JsonResponse),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }

      if ((priceCount ?? 0) > 0) {
        return new Response(
          JSON.stringify({
            success: false,
            code: "IN_PRICES",
            error: `Este item tem preços configurados (${priceCount}). Use "Forçar exclusão" para remover os preços automaticamente.`,
          } satisfies JsonResponse),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
    }

    // 5) If force mode, delete all references first
    let removedCounts = {
      products: 0,
      stock: 0,
      prices: 0,
      companyItems: 0,
      companyProductItems: 0,
    };

    if (force && hasReferences) {
      console.log(`Force deleting item ${id} with references...`);

      // Delete company_product_items first (references company_items)
      if ((companyProductItemsCount ?? 0) > 0) {
        const { error: delCpiError } = await adminClient
          .from("company_product_items")
          .delete()
          .eq("item_template_id", id);
        if (delCpiError) {
          console.error("Error deleting company_product_items:", delCpiError);
          throw delCpiError;
        }
        removedCounts.companyProductItems = companyProductItemsCount ?? 0;
      }

      // Delete product_template_items
      if ((ptiCount ?? 0) > 0) {
        const { error: delPtiError } = await adminClient
          .from("product_template_items")
          .delete()
          .eq("item_template_id", id);
        if (delPtiError) {
          console.error("Error deleting product_template_items:", delPtiError);
          throw delPtiError;
        }
        removedCounts.products = ptiCount ?? 0;
      }

      // Delete company_stock (references company_items, need to clear first)
      if ((stockCount ?? 0) > 0) {
        const { error: delStockError } = await adminClient
          .from("company_stock")
          .delete()
          .eq("item_template_id", id);
        if (delStockError) {
          console.error("Error deleting company_stock:", delStockError);
          throw delStockError;
        }
        removedCounts.stock = stockCount ?? 0;
      }

      // Delete company_item_prices
      if ((priceCount ?? 0) > 0) {
        const { error: delPriceError } = await adminClient
          .from("company_item_prices")
          .delete()
          .eq("item_template_id", id);
        if (delPriceError) {
          console.error("Error deleting company_item_prices:", delPriceError);
          throw delPriceError;
        }
        removedCounts.prices = priceCount ?? 0;
      }

      // Delete company_items last (after stock is cleared)
      if ((companyItemsCount ?? 0) > 0) {
        const { error: delCiError } = await adminClient
          .from("company_items")
          .delete()
          .eq("item_template_id", id);
        if (delCiError) {
          console.error("Error deleting company_items:", delCiError);
          throw delCiError;
        }
        removedCounts.companyItems = companyItemsCount ?? 0;
      }

      console.log("Removed references:", removedCounts);
    }

    // 6) Delete the item template
    const { error: deleteError } = await adminClient.from("item_templates").delete().eq("id", id);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ 
      success: true,
      ...(force && hasReferences ? { removed: removedCounts } : {})
    } satisfies JsonResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("admin-delete-item-template error:", error);
    return new Response(
      JSON.stringify({ success: false, code: "SERVER", error: "Erro ao excluir. Tente novamente." } satisfies JsonResponse),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
