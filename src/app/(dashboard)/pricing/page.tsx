import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getShopSession, requireRole } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import PageHeader from "@/components/layout/page-header";
import PricingMatrix from "@/components/pricing/pricing-matrix";
import { Card } from "@/components/ui/card";
import type { PricingRule, VariantGroupDef, EffectivePricingRule } from "@/models/types";

export const metadata: Metadata = {
  title: "Pricing — Inklabs Shop Dashboard",
};

export default async function PricingPage() {
  let session;
  try {
    session = await getShopSession();
    requireRole(session, "admin");
  } catch {
    redirect("/dashboard");
  }

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing"
        description="View the effective pricing for your shop"
      />

      <Card className="p-4 bg-indigo-50/60 border-indigo-100/80 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4 text-indigo-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="pt-1">
            <p className="text-sm font-medium text-indigo-900">
              Read-only Pricing
            </p>
            <p className="text-sm text-indigo-700/80 mt-0.5 leading-relaxed">
              These are the prices applied to your orders. Contact the platform
              administrator to request changes.
            </p>
          </div>
        </div>
      </Card>

      <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <PricingMatrix
          effectiveRules={effectiveRules}
          variantGroups={variantGroups}
        />
      </div>
    </div>
  );
}
