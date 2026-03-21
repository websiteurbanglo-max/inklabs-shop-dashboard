import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { EffectivePricingRule, VariantGroupDef } from "@/models/types";

interface PricingMatrixProps {
  effectiveRules: EffectivePricingRule[];
  variantGroups: VariantGroupDef[];
}

export default function PricingMatrix({
  effectiveRules,
  variantGroups,
}: PricingMatrixProps) {
  if (effectiveRules.length === 0) {
    return (
      <Card className="p-14 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-gray-500 text-sm font-medium">
          No pricing rules configured
        </p>
        <p className="text-gray-300 text-xs mt-1">
          Contact the platform administrator to set up pricing.
        </p>
      </Card>
    );
  }

  const quantityTiers = Array.from(
    new Set(effectiveRules.map((r) => `${r.minQty}-${r.maxQty}`))
  )
    .map((tier) => {
      const [min, max] = tier.split("-").map(Number);
      return { min, max, label: max === 999999 ? `${min}+` : `${min}–${max}` };
    })
    .sort((a, b) => a.min - b.min);

  const ruleMap = new Map<string, Map<string, EffectivePricingRule>>();

  for (const rule of effectiveRules) {
    const tierKey = `${rule.minQty}-${rule.maxQty}`;
    if (!ruleMap.has(rule.variantGroup)) {
      ruleMap.set(rule.variantGroup, new Map());
    }
    ruleMap.get(rule.variantGroup)!.set(tierKey, rule);
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-indigo-50 border border-indigo-200/60" />
          <span className="text-gray-500">Custom pricing for your shop</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-gray-50 border border-gray-200/60" />
          <span className="text-gray-500">Standard platform pricing</span>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 border-b border-gray-100/80">
              <tr>
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Variant Group / Size
                </th>
                {quantityTiers.map((tier) => (
                  <th
                    key={`${tier.min}-${tier.max}`}
                    className="text-center py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider"
                  >
                    Qty {tier.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {variantGroups.map((group) => {
                const groupRules = ruleMap.get(group.key);
                return (
                  <tr key={group.key} className="hover:bg-gray-50/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-gray-900 tracking-tight">{group.label}</p>
                      <p className="text-[11px] text-gray-300">
                        {group.sizes.join(", ")}&quot; inch
                        {group.sizes.length !== 1 ? "es" : ""}
                      </p>
                    </td>
                    {quantityTiers.map((tier) => {
                      const tierKey = `${tier.min}-${tier.max}`;
                      const rule = groupRules?.get(tierKey);
                      return (
                        <td
                          key={tierKey}
                          className="py-3.5 px-4 text-center"
                        >
                          {rule ? (
                            <div
                              className={`inline-block px-2.5 py-1 rounded-lg text-sm font-medium border ${
                                rule.source === "shop"
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200/60"
                                  : "bg-gray-50 text-gray-600 border-gray-200/60"
                              }`}
                            >
                              {formatCurrency(rule.unitPrice)}
                              <span className="text-[11px] font-normal ml-0.5 opacity-60">
                                /pc
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-200 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-[11px] text-gray-300">
        Prices shown are per piece (unit price). All amounts in Indian Rupees
        (INR).
      </p>
    </div>
  );
}
