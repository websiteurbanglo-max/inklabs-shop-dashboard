import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";
import { verifyShopUser, requireRole, handleAuthError } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import type { PricingRule, VariantGroupDef } from "@/models/types";

async function calculatePrice(
  shopId: string,
  variantGroup: string,
  quantity: number
): Promise<{
  unitPrice: number;
  subtotal: number;
  total: number;
  appliedRuleId: string;
  ruleSource: "shop" | "global";
}> {
  // Try shop-specific pricing first
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
    throw new Error("No pricing rule found for this variant group and quantity");
  }

  const unitPrice = matchedRule.unitPrice;
  const subtotal = unitPrice * quantity;
  const total = subtotal;

  return {
    unitPrice,
    subtotal,
    total,
    appliedRuleId: matchedRule.ruleId,
    ruleSource,
  };
}

function deriveVariantGroup(
  sizeInInches: number,
  variantGroups: VariantGroupDef[]
): string {
  for (const group of variantGroups) {
    if (group.sizes.includes(sizeInInches)) {
      return group.key;
    }
  }
  // fallback: assign based on range
  if (sizeInInches <= 4) return "small";
  if (sizeInInches <= 7) return "medium";
  return "large";
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifyShopUser();
    requireRole(session, "operator");

    const body = await request.json();
    const {
      rawImageUrl,
      designImageUrl,
      sizeInInches,
      quantity,
      customerName,
      customerEmail,
      notes,
    } = body as {
      rawImageUrl: string;
      designImageUrl: string;
      sizeInInches: number;
      quantity: number;
      customerName?: string;
      customerEmail?: string;
      notes?: string;
    };

    if (!rawImageUrl || !designImageUrl || !sizeInInches || !quantity) {
      return Response.json(
        {
          error:
            "rawImageUrl, designImageUrl, sizeInInches, and quantity are required",
        },
        { status: 400 }
      );
    }

    if (quantity < 1) {
      return Response.json(
        { error: "Quantity must be at least 1" },
        { status: 400 }
      );
    }

    // Get variant groups from platform config
    let variantGroups: VariantGroupDef[] = [
      { key: "small", label: "Small (2-4 inch)", sizes: [2, 3, 4] },
      { key: "medium", label: "Medium (5-7 inch)", sizes: [5, 6, 7] },
      { key: "large", label: "Large (8-10 inch)", sizes: [8, 9, 10] },
    ];

    let defaultPipelineId = "default";

    try {
      const configDoc = await adminDb
        .collection("platform_config")
        .doc("settings")
        .get();
      if (configDoc.exists) {
        if (configDoc.data()?.variantGroups) {
          variantGroups = configDoc.data()!.variantGroups;
        }
        if (configDoc.data()?.defaultPipelineId) {
          defaultPipelineId = configDoc.data()!.defaultPipelineId;
        }
      }
    } catch {
      // use defaults
    }

    const variantGroup = deriveVariantGroup(sizeInInches, variantGroups);

    // Calculate pricing
    let pricing;
    try {
      pricing = await calculatePrice(session.shopId, variantGroup, quantity);
    } catch (e) {
      return Response.json(
        {
          error:
            "No pricing rule found for this size and quantity combination. Contact the platform administrator.",
        },
        { status: 400 }
      );
    }

    const orderId = uuidv4();
    const now = FieldValue.serverTimestamp();

    const orderData = {
      orderId,
      shopId: session.shopId,
      source: "studio",
      shopifyOrderId: null,
      shopifyOrderNumber: null,
      shopifyLineItemId: null,
      customerName: customerName || "Studio Order",
      customerEmail: customerEmail || "",
      productTitle: "Custom Order",
      sizeInInches,
      variantGroup,
      quantity,
      designAssets: {
        rawImageUrl,
        designImageUrl,
        canvasJson: null,
        thumbnailUrl: null,
      },
      billingSnapshot: {
        unitPrice: pricing.unitPrice,
        subtotal: pricing.subtotal,
        total: pricing.total,
        currency: "INR",
        appliedRuleId: pricing.appliedRuleId,
        ruleSource: pricing.ruleSource,
        calculatedAt: now,
      },
      pipelineId: defaultPipelineId,
      currentStageKey: "received",
      currentStageUpdatedAt: now,
      notes: notes || "",
      createdBy: session.uid,
      createdAt: now,
      updatedAt: now,
    };

    const eventData = {
      orderId,
      shopId: session.shopId,
      type: "ORDER_CREATED",
      description: "Order created",
      performedBy: session.uid,
      performedByName: session.email,
      timestamp: now,
    };

    // Fetch shop info for global projection
    const shopDoc = await adminDb
      .collection("shops")
      .doc(session.shopId)
      .get();
    const shopData = shopDoc.data();

    // Batch write
    const batch = adminDb.batch();

    const orderRef = adminDb
      .collection("shops")
      .doc(session.shopId)
      .collection("orders")
      .doc(orderId);
    batch.set(orderRef, orderData);

    const eventRef = orderRef.collection("events").doc();
    batch.set(eventRef, eventData);

    // Global projection for superadmin visibility
    const projRef = adminDb.collection("orders_global").doc(orderId);
    batch.set(projRef, {
      orderId,
      shopId: session.shopId,
      shopDisplayName: session.shopDisplayName,
      shopType: shopData?.shopType || "studio",
      source: "studio",
      variantGroup,
      sizeInInches,
      quantity,
      productTitle: "Custom Order",
      currentStageKey: "received",
      currentStageUpdatedAt: now,
      pipelineId: defaultPipelineId,
      billingTotal: pricing.total,
      currency: "INR",
      customerName: customerName || "Studio Order",
      customerEmail: customerEmail || "",
      designThumbnailUrl: designImageUrl,
      createdAt: now,
      updatedAt: now,
    });

    await batch.commit();

    return Response.json(
      { order: { ...orderData, orderId } },
      { status: 201 }
    );
  } catch (error) {
    return handleAuthError(error);
  }
}
