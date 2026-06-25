import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='window'][callee.property.name='open'] Literal[value=/wa\\.me|whatsapp\\.com|whatsapp\\.me|api\\.whatsapp/i]",
          message: "Não use window.open com URLs do WhatsApp. Use o util openWhatsapp de '@/utils/whatsapp'.",
        },
        {
          selector: "Literal[value=/whatsapp\\.me|api\\.whatsapp\\.com/i]",
          message: "Links diretos para whatsapp.me ou api.whatsapp.com são proibidos. Use openWhatsapp (wa.me) de '@/utils/whatsapp'.",
        },
        {
          selector: "TemplateElement[value.raw=/whatsapp\\.me|api\\.whatsapp\\.com/i]",
          message: "Links diretos para whatsapp.me ou api.whatsapp.com são proibidos. Use openWhatsapp (wa.me) de '@/utils/whatsapp'.",
        },
      ],
    },
  },
  {
    files: ["src/utils/whatsapp.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
);

