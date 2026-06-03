"use client";

import { useEffect } from "react";
import { usePricing } from "@/hooks/use-pricing";
import { useAuth } from "@/hooks/use-auth";
import PageHeader from "@/components/layout/page-header";
import PricingMatrix from "@/components/pricing/pricing-matrix";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function PricingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Card className="p-0 overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function PricingPage() {
  const { shop } = useAuth();
  const { effectiveRules, variantGroups, isLoading } = usePricing();

  useEffect(() => {
    document.title = "Pricing — Inklabs";
  }, []);

  // Redirect non-admins: show a plain message (layout already hides nav item)
  if (!isLoading && shop && shop.role !== "admin" && shop.role !== "owner") {
    return (
      <div className="text-center py-24">
        <p className="text-gray-500 text-sm">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Pricing" description="View the effective pricing for your shop" />

      <Card className="p-4 bg-indigo-50/60 border-indigo-100/80">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="pt-1">
            <p className="text-sm font-medium text-indigo-900">Read-only Pricing</p>
            <p className="text-sm text-indigo-700/80 mt-0.5 leading-relaxed">
              These are the prices applied to your orders. Contact the platform administrator to request changes.
            </p>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <PricingSkeleton />
      ) : (
        <PricingMatrix effectiveRules={effectiveRules} variantGroups={variantGroups} />
      )}
    </div>
  );
}
