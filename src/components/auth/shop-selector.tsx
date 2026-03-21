"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      // Use the select-shop endpoint that works with existing session cookie
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
    <Card className="p-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Select a Shop</h2>
        <p className="text-gray-500 text-sm mt-2">
          You have access to multiple shops. Choose one to continue.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : memberships.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No active memberships found.</p>
          <a
            href="/onboarding"
            className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Get started →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {memberships.map((m) => (
            <button
              key={m.shopId}
              onClick={() => handleSelectShop(m.shopId)}
              disabled={selecting === m.shopId}
              className="w-full flex items-center gap-4 p-4 border border-gray-100 rounded-xl hover:border-indigo-200 hover:bg-indigo-50 transition-all text-left group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {m.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.logoUrl}
                  alt={m.shopName}
                  className="w-12 h-12 rounded-xl object-cover border border-gray-100 flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-lg font-bold text-indigo-700 flex-shrink-0">
                  {m.shopName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {m.shopName}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      m.shopType === "shopify"
                        ? "bg-green-100 text-green-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {m.shopType}
                  </span>
                  <span className="text-xs text-gray-500">{m.role}</span>
                </div>
              </div>

              {selecting === m.shopId ? (
                <svg
                  className="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0"
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
