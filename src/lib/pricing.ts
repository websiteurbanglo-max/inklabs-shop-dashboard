import { adminDb } from "./firebase-admin";
import type { PricingRule, PriceCalculation, VariantGroupDef } from "@/models/types";

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

export async function calculateOrderPrice(
  shopId: string,
  variantGroup: string,
  quantity: number
): Promise<PriceCalculation> {
  // Step 1: Try shop-specific pricing
  const shopRulesSnap = await adminDb
    .collection("shops")
    .doc(shopId)
    .collection("pricing")
    .doc("rules")
    .collection("items")
    .where("variantGroup", "==", variantGroup)
    .where("minQty", "<=", quantity)
    .where("isActive", "==", true)
    .get();

  let matchedRule: PricingRule | undefined;
  let ruleSource: "shop" | "global" = "shop";

  for (const doc of shopRulesSnap.docs) {
    const rule = { ...doc.data(), ruleId: doc.id } as PricingRule;
    if (quantity >= rule.minQty && quantity <= rule.maxQty) {
      matchedRule = rule;
      break;
    }
  }

  // Step 2: Fallback to global pricing
  if (!matchedRule) {
    const globalRulesSnap = await adminDb
      .collection("pricing")
      .doc("global")
      .collection("rules")
      .where("variantGroup", "==", variantGroup)
      .where("minQty", "<=", quantity)
      .where("isActive", "==", true)
      .get();

    for (const doc of globalRulesSnap.docs) {
      const rule = { ...doc.data(), ruleId: doc.id } as PricingRule;
      if (quantity >= rule.minQty && quantity <= rule.maxQty) {
        matchedRule = rule;
        ruleSource = "global";
        break;
      }
    }
  }

  // Step 3: No rule found
  if (!matchedRule) {
    throw new PricingError(
      "No pricing rule found for this variant group and quantity"
    );
  }

  // Step 4: Calculate
  const unitPrice = matchedRule.unitPrice; // in paisa
  const subtotal = unitPrice * quantity;
  const total = subtotal; // no taxes/discounts for now

  return {
    unitPrice,
    subtotal,
    total,
    currency: "INR" as const,
    appliedRuleId: matchedRule.ruleId,
    ruleSource,
  };
}

export function deriveVariantGroup(
  sizeInInches: number,
  variantGroups: VariantGroupDef[]
): string {
  for (const group of variantGroups) {
    if (group.sizes.includes(sizeInInches)) {
      return group.key;
    }
  }
  // Fallback: assign based on range if not explicitly listed
  if (sizeInInches <= 4) return "small";
  if (sizeInInches <= 7) return "medium";
  return "large";
}
