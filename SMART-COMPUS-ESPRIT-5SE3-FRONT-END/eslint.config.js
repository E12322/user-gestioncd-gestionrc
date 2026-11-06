import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "node_modules", ".claude", ".impeccable", ".playwright-cli", "coverage", "playwright-report", "test-results"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  { plugins: { "react-hooks": reactHooks }, rules: reactHooks.configs.recommended.rules },
  { languageOptions: { globals: { ...globals.browser } } },
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      // Page de connexion / formulaires d'auth : le focus initial sur le premier champ est voulu. Les composants maison sont ignorés.
      "jsx-a11y/no-autofocus": ["error", { ignoreNonDOM: true }],
      // Règles React Compiler très strictes : le socle de données maison (useQuery/useMutation) et deux pages les enfreignent.
      // En avertissement tant que ce socle n'est pas refactoré : visible, mais ne bloque pas.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  // Contrat d'architecture (couches) : app → pages → features → shared, jamais de feature → feature.
  // Vérifié aussi par src/test/architecture.test.ts (couvre les imports relatifs).
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/app/*", "@/pages/*", "@/features/*"], message: "shared ne dépend d'aucune autre couche." }] },
      ],
    },
  },
  {
    files: ["src/pages/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["@/app/*"], message: "pages ne dépend pas de app." }] }] },
  },
  ...["users", "academic", "resources", "housing", "student-life", "library"].map((m) => ({
    files: [`src/features/${m}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/app/*", "@/pages/*"], message: "Une feature ne dépend ni de app ni de pages." },
            {
              group: ["@/features/*", `!@/features/${m}`, `!@/features/${m}/*`],
              message: "Une feature ne dépend jamais d'une autre feature.",
            },
          ],
        },
      ],
    },
  })),
  {
    files: ["src/test/**", "**/*.test.{ts,tsx}", "e2e/**"],
    rules: {},
  },
  prettier,
);
