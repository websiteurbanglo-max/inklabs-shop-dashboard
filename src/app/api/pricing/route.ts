import { verifyShopUser, requireRole, handleAuthError } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import type { PricingRule, EffectivePricingRule, VariantGroupDef } from "@/models/types";

export async function GET() {
  try {
    const session = await verifyShopUser();
    requireRole(session, "admin");

    const [configResult, shopRulesResult, globalRulesResult] = await Promise.allSettled([
      adminDb.collection("platform_config").doc("settings").get(),
      adminDb
        .collection("shops")
        .doc(session.shopId)
        .collection("pricing")
        .doc("rules")
        .collection("items")
        .where("isActive", "==", true)
        .get(),
      adminDb
        .collection("pricing")
        .doc("global")
        .collection("rules")
        .where("isActive", "==", true)
        .get(),
    ]);

    let variantGroups: VariantGroupDef[] = [
      { key: "small", label: "Small (2-4 inch)", sizes: [2, 3, 4] },
      { key: "medium", label: "Medium (5-7 inch)", sizes: [5, 6, 7] },
      { key: "large", label: "Large (8-10 inch)", sizes: [8, 9, 10] },
    ];

    if (
      configResult.status === "fulfilled" &&
      configResult.value.exists &&
      configResult.value.data()?.variantGroups
    ) {
      variantGroups = configResult.value.data()!.variantGroups;
    }

    const shopRules: PricingRule[] =
      shopRulesResult.status === "fulfilled"
        ? shopRulesResult.value.docs.map(
            (doc) => ({ ...doc.data(), ruleId: doc.id }) as PricingRule
          )
        : [];

    const globalRules: PricingRule[] =
      globalRulesResult.status === "fulfilled"
        ? globalRulesResult.value.docs.map(
            (doc) => ({ ...doc.data(), ruleId: doc.id }) as PricingRule
          )
        : [];

    const shopRuleMap = new Map(
      shopRules.map((r) => [`${r.variantGroup}-${r.minQty}-${r.maxQty}`, r])
    );

    const effectiveRules: EffectivePricingRule[] = [
      ...shopRules.map((r) => ({ ...r, source: "shop" as const })),
    ];

    for (const globalRule of globalRules) {
      const key = `${globalRule.variantGroup}-${globalRule.minQty}-${globalRule.maxQty}`;
      if (!shopRuleMap.has(key)) {
        effectiveRules.push({ ...globalRule, source: "global" as const });
      }
    }

    return Response.json({ effectiveRules, variantGroups });
  } catch (error) {
    return handleAuthError(error);
  }
}
