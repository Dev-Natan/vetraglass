import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listClients from "./tools/list-clients";
import listQuotes from "./tools/list-quotes";
import listLowStock from "./tools/list-stock";

const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "vetra-mcp",
  title: "Vetra Glass",
  version: "0.1.0",
  instructions:
    "Tools for the Vetra Glass ERP: list clients, list quotes (orçamentos) and check low-stock items for the signed-in user's company.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listClients, listQuotes, listLowStock],
});
