import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**", "playwright-report/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "jsx-a11y": jsxA11y, "react-hooks": reactHooks },
    rules: {
      ...Object.fromEntries(
        Object.keys(jsxA11y.flatConfigs.recommended.rules).map((rule) => [
          rule,
          "warn",
        ]),
      ),
      "react-hooks/rules-of-hooks": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/exhaustive-deps": "warn",
      // jsx-a11y interaction rules stay off for now: re-enabling them surfaces
      // 59 warnings across 18 files. The remediation plan (per-site fixes and
      // patterns) lives in docs/technical-debt.md — flip these back on
      // as that list is worked down. The 2026-07-17 pass already fixed the
      // ProductCard / SelectedItemPanel / OrderQueue / CatalogToolbar /
      // SwipeConfirmButton sites, which pass with the rules enabled.
      "jsx-a11y/label-has-for": "off",
      "jsx-a11y/control-has-associated-label": "off",
      "jsx-a11y/no-autofocus": "off",
      "jsx-a11y/label-has-associated-control": "off",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-static-element-interactions": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/no-noninteractive-element-to-interactive-role": "off",
      "jsx-a11y/no-noninteractive-tabindex": "off",
    },
  },
  {
    files: [
      "src/components/ui/MobileSheetShell.tsx",
      "src/components/catalog/browsing/StackedFeatured.tsx",
      "src/components/catalog/checkout/PaymentQrModal.tsx",
      "src/pages/CatalogPage.tsx",
    ],
    rules: {
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/no-noninteractive-element-to-interactive-role": "error",
      "jsx-a11y/no-noninteractive-tabindex": "error",
      "jsx-a11y/no-noninteractive-element-interactions": [
        "error",
        {
          handlers: [
            "onClick",
            "onMouseDown",
            "onMouseUp",
            "onKeyPress",
            "onKeyDown",
            "onKeyUp",
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/components/admin/design/StorefrontDesigner.tsx",
      "src/components/admin/settings/PromotionSettingsForm.tsx",
      "src/components/admin/products/ProductForm.tsx",
      "src/components/ui/ColorPicker.tsx",
    ],
    rules: {
      "jsx-a11y/label-has-for": "error",
      "jsx-a11y/control-has-associated-label": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/no-autofocus": "error",
    },
  },
  {
    files: ["src/components/admin/design/StorefrontDesigner.tsx"],
    rules: {
      "jsx-a11y/no-static-element-interactions": [
        "error",
        {
          handlers: [
            "onClick",
            "onMouseDown",
            "onMouseUp",
            "onKeyPress",
            "onKeyDown",
            "onKeyUp",
          ],
        },
      ],
      "jsx-a11y/no-noninteractive-element-interactions": [
        "error",
        {
          handlers: [
            "onClick",
            "onMouseDown",
            "onMouseUp",
            "onKeyPress",
            "onKeyDown",
            "onKeyUp",
          ],
        },
      ],
      "jsx-a11y/no-noninteractive-tabindex": "error",
    },
  },
);
