import { verifyShopUser, requireRole, handleAuthError } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import type { PricingRule, EffectivePricingRule, VariantGroupDef } from "@/models/types";

export async function GET() {
  try {
    const session = await verifyShopUser();
    requireRole(session, "admin");

    // Get variant groups from platform config
    let variantGroups: VariantGroupDef[] = [
      { key: "small", label: "Small (2-4 inch)", sizes: [2, 3, 4] },
      { key: "medium", label: "Medium (5-7 inch)", sizes: [5, 6, 7] },
      { key: "large", label: "Large (8-10 inch)", sizes: [8, 9, 10] },
    ];

    try {
      const configDoc = await adminDb
        .collection("platform_config")
        .doc("settings")
        .get();
      if (configDoc.exists && configDoc.data()?.variantGroups) {
        variantGroups = configDoc.data()!.variantGroups;
      }
    } catch {
      // use defaults
    }

    // Fetch shop pricing rules
    let shopRules: PricingRule[] = [];
    try {
      const shopRulesSnap = await adminDb
        .collection("shops")
        .doc(session.shopId)
        .collection("pricing")
        .doc("rules")
        .collection("items")
        .where("isActive", "==", true)
        .get();
      shopRules = shopRulesSnap.docs.map(
        (doc) => ({ ...doc.data(), ruleId: doc.id }) as PricingRule
      );
    } catch {
      // no shop rules
    }

    // Fetch global pricing rules
    let globalRules: PricingRule[] = [];
    try {
      const globalRulesSnap = await adminDb
        .collection("pricing")
        .doc("global")
        .collection("rules")
        .where("isActive", "==", true)
        .get();
      globalRules = globalRulesSnap.docs.map(
        (doc) => ({ ...doc.data(), ruleId: doc.id }) as PricingRule
      );
    } catch {
      // no global rules
    }

    // Merge: shop overrides take precedence
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
