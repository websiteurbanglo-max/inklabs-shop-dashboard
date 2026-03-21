import { NextRequest } from "next/server";
import { verifyShopUser, requireRole, handleAuthError } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import type { PricingRule } from "@/models/types";

export async function POST(request: NextRequest) {
  try {
    const session = await verifyShopUser();
    requireRole(session, "operator");

    const body = await request.json();
    const { variantGroup, quantity } = body as {
      variantGroup: string;
      quantity: number;
    };

    if (!variantGroup || !quantity) {
      return Response.json(
        { error: "variantGroup and quantity are required" },
        { status: 400 }
      );
    }

    if (quantity < 1) {
      return Response.json(
        { error: "Quantity must be at least 1" },
        { status: 400 }
      );
    }

    // Try shop-specific pricing first
    const shopRulesSnap = await adminDb
      .collection("shops")
      .doc(session.shopId)
      .collection("pricing")
      .doc("rules")
      .collection("items")
      .where("variantGroup", "==", variantGroup)
      .where("minQty", "<=", quantity)
      .where("isActive", "==", true)
      .get();

    let matchedRule: PricingRule | null = null;
    let ruleSource: "shop" | "global" = "shop";

    for (const doc of shopRulesSnap.docs) {
      const rule = { ...doc.data(), ruleId: doc.id } as PricingRule;
      if (quantity >= rule.minQty && quantity <= rule.maxQty) {
        matchedRule = rule;
        break;
      }
    }

    // Fallback to global pricing
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

    if (!matchedRule) {
      return Response.json(
        {
          error:
            "No pricing rule found for this variant group and quantity. Contact the platform administrator.",
          found: false,
        },
        { status: 404 }
      );
    }

    const unitPrice = matchedRule.unitPrice;
    const subtotal = unitPrice * quantity;
    const total = subtotal;

    return Response.json({
      unitPrice,
      subtotal,
      total,
      currency: "INR",
      appliedRuleId: matchedRule.ruleId,
      ruleSource,
      found: true,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
