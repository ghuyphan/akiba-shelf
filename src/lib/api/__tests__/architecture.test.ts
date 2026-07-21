import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as api from "../../api";

const apiDir = path.resolve(process.cwd(), "src/lib/api");

function domainFiles() {
  return fs
    .readdirSync(apiDir)
    .filter((name) => name.endsWith(".ts"))
    .sort();
}

describe("API module architecture", () => {
  it("keeps api.ts as a small compatibility barrel", () => {
    const barrel = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/api.ts"),
      "utf8",
    );
    expect(barrel.trim().split("\n")).toHaveLength(10);
    expect(barrel).not.toMatch(/\b(function|const|class)\b/);
  });

  it("preserves the established runtime exports", () => {
    const expectedFunctions = [
      "cancelCustomerOrder",
      "cancelOrder",
      "confirmOrderPayment",
      "createOrder",
      "createShop",
      "deleteProduct",
      "deleteStaffMember",
      "getAdminCatalogData",
      "getAdminGachaConfiguration",
      "getAdminProducts",
      "getCatalogCoreData",
      "getCatalogData",
      "getCustomerOrder",
      "getGachaCatalog",
      "getGachaCatalogs",
      "getOrders",
      "getOrderStatusCounts",
      "getPublicBoothSettings",
      "getPublicFeaturedProducts",
      "getPublicGachaEnabled",
      "getPublicPaymentSettings",
      "getPublicProductCategories",
      "getPublicProducts",
      "getPublicProductsByIds",
      "getPublicPromotionSettings",
      "getPublicShop",
      "getShopInvitations",
      "getShopMemberships",
      "getShopWorkspaceSummary",
      "getStaffMembers",
      "inviteShopMember",
      "normalizeProduct",
      "normalizePromotion",
      "publishGachaConfiguration",
      "saveBoothSettings",
      "saveGachaDraft",
      "savePaymentSettings",
      "saveProduct",
      "savePromotionSettings",
      "saveStaffMember",
      "signInAdmin",
      "signInWithGoogle",
      "signOutAdmin",
      "updateShop",
      "updateShopInvitation",
      "uploadImage",
      "uploadProductImages",
    ];
    for (const name of expectedFunctions) {
      expect(api, name).toHaveProperty(name, expect.any(Function));
    }
  });

  it("does not import the compatibility barrel from domain modules", () => {
    for (const file of domainFiles()) {
      const source = fs.readFileSync(path.join(apiDir, file), "utf8");
      expect(source, file).not.toMatch(/from\s+["']\.\.\/api["']/);
    }
  });

  it("keeps the API domain import graph acyclic", () => {
    const files = domainFiles();
    const graph = new Map(
      files.map((file) => {
        const source = fs.readFileSync(path.join(apiDir, file), "utf8");
        const dependencies = [
          ...source.matchAll(/from\s+["']\.\/([^"']+)["']/g),
        ]
          .map((match) => `${match[1]}.ts`)
          .filter((dependency) => files.includes(dependency));
        return [file, dependencies] as const;
      }),
    );
    const visiting = new Set<string>();
    const visited = new Set<string>();

    function visit(file: string) {
      if (visiting.has(file)) throw new Error(`API import cycle at ${file}`);
      if (visited.has(file)) return;
      visiting.add(file);
      for (const dependency of graph.get(file) ?? []) visit(dependency);
      visiting.delete(file);
      visited.add(file);
    }

    for (const file of files) visit(file);
    expect(visited.size).toBe(files.length);
  });
});
