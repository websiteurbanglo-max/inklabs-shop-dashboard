import { adminDb } from "@/lib/firebase-admin";
import type { PricingRule, EffectivePricingRule } from "./types";

export async function getShopPricingRules(
  shopId: string
): Promise<PricingRule[]> {
  try {
    const snap = await adminDb
      .collection("shops")
      .doc(shopId)
      .collection("pricing")
      .doc("rules")
      .collection("items")
      .where("isActive", "==", true)
      .get();

    return snap.docs.map((doc) => ({
      ...doc.data(),
      ruleId: doc.id,
    })) as PricingRule[];
  } catch {
    return [];
  }
}

export async function getGlobalPricingRules(): Promise<PricingRule[]> {
  try {
    const snap = await adminDb
      .collection("pricing")
      .doc("global")
      .collection("rules")
      .where("isActive", "==", true)
      .get();

    return snap.docs.map((doc) => ({
      ...doc.data(),
      ruleId: doc.id,
    })) as PricingRule[];
  } catch {
    return [];
  }
}

export async function getEffectivePricingRules(
  shopId: string
): Promise<EffectivePricingRule[]> {
  const [shopRules, globalRules] = await Promise.all([
    getShopPricingRules(shopId),
    getGlobalPricingRules(),
  ]);

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

  return effectiveRules;
}

export async function findMatchingRule(
  shopId: string,
  variantGroup: string,
  quantity: number
): Promise<{ rule: PricingRule; source: "shop" | "global" } | null> {
  const shopRules = await getShopPricingRules(shopId);

  let matchedRule: PricingRule | undefined = shopRules
    .filter(
      (r) =>
        r.variantGroup === variantGroup &&
        quantity >= r.minQty &&
        quantity <= r.maxQty
    )
    .sort((a, b) => a.minQty - b.minQty)[0];

  if (matchedRule) return { rule: matchedRule, source: "shop" };

  const globalRules = await getGlobalPricingRules();
  matchedRule = globalRules
    .filter(
      (r) =>
        r.variantGroup === variantGroup &&
        quantity >= r.minQty &&
        quantity <= r.maxQty
    )
    .sort((a, b) => a.minQty - b.minQty)[0];

  if (matchedRule) return { rule: matchedRule, source: "global" };

  return null;
}
