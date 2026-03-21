"use client";

import useSWR from "swr";
import type { EffectivePricingRule, VariantGroupDef } from "@/models/types";

interface PricingData {
  effectiveRules: EffectivePricingRule[];
  variantGroups: VariantGroupDef[];
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error("Failed to fetch pricing");
    throw error;
  }
  return res.json();
}

export function usePricing() {
  const { data, error, isLoading, mutate } = useSWR<PricingData>(
    "/api/pricing",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    effectiveRules: data?.effectiveRules ?? [],
    variantGroups: data?.variantGroups ?? [],
    isLoading,
    isError: !!error,
    mutate,
  };
}

export async function calculatePrice(
  variantGroup: string,
  quantity: number
): Promise<{
  unitPrice: number;
  subtotal: number;
  total: number;
  currency: "INR";
  appliedRuleId: string;
  ruleSource: "global" | "shop";
}> {
  const res = await fetch("/api/pricing/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variantGroup, quantity }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to calculate price");
  }

  return data;
}
