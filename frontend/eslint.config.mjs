import next from "eslint-config-next";
import prettier from "eslint-config-prettier";

const config = [
  ...next,
  prettier,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      /** Sem `any` — regra estrutural do Frontend Core. */
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      /** Contratos gerados a partir do backend — editar lá, não aqui. */
      "src/types/contracts/**",
      /**
       * Design System já entregue (shadcn/ui e utilitários que o acompanham).
       * Fora do escopo desta camada e mantido sem alterações.
       */
      "src/components/ui/**",
      "src/hooks/use-mobile.tsx",
    ],
  },
];

export default config;
