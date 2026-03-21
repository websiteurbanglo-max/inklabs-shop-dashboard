"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ShopMembership } from "@/models/types";

export default function ShopSelector() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<ShopMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/memberships")
      .then((r) => r.json())
      .then((data) => {
        const active = (data.memberships || []).filter(
          (m: ShopMembership) => m.status === "active"
        );
        setMemberships(active);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleSelectShop = async (shopId: string) => {
    setSelecting(shopId);
    try {
      const res = await fetch("/api/auth/select-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to select shop");
      }

      toast.success("Shop selected!");
      router.push("/dashboard");
    } catch (err) {
      toast.error((err as Error).message);
      setSelecting(null);
    }
  };

  return (
    <Card className="p-8 border-glow animate-fade-in-up">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Select a Shop</h2>
        <p className="text-gray-400 text-sm mt-2 leading-relaxed">
          You have access to multiple shops. Choose one to continue.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100">
              <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : memberships.length === 0 ? (
        <div className="text-center py-10 animate-fade-in-up">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm font-medium">No active memberships found.</p>
          <a
            href="/onboarding"
            className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            Get started
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      ) : (
        <div className="space-y-2.5">
          {memberships.map((m, i) => (
            <button
              key={m.shopId}
              onClick={() => handleSelectShop(m.shopId)}
              disabled={selecting === m.shopId}
              className={cn(
                "w-full flex items-center gap-4 p-4 border rounded-xl",
                "text-left group transition-all duration-200",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                "hover:border-indigo-200 hover:bg-indigo-50/50 hover:shadow-sm",
                "active:scale-[0.99]",
                selecting === m.shopId
                  ? "border-indigo-200 bg-indigo-50/50"
                  : "border-gray-100",
                "animate-fade-in-up"
              )}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {m.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.logoUrl}
                  alt={m.shopName}
                  className="w-12 h-12 rounded-xl object-cover border border-gray-100 flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center text-lg font-bold text-indigo-700 flex-shrink-0 transition-transform duration-200 group-hover:scale-105">
                  {m.shopName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate tracking-tight">
                  {m.shopName}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-px rounded-md font-medium border",
                      m.shopType === "shopify"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-200/60"
                        : "bg-purple-50 text-purple-600 border-purple-200/60"
                    )}
                  >
                    {m.shopType}
                  </span>
                  <span className="text-[11px] text-gray-400 capitalize">{m.role}</span>
                </div>
              </div>

              {selecting === m.shopId ? (
                <svg
                  className="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-20"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-80"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-gray-300 group-hover:text-indigo-400 transition-all duration-200 group-hover:translate-x-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
