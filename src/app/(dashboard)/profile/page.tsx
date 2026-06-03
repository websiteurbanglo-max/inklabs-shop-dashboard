"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/utils";
import PageHeader from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const roleColors: Record<string, string> = {
  owner: "bg-purple-50 text-purple-600 border-purple-200/60",
  admin: "bg-blue-50 text-blue-600 border-blue-200/60",
  operator: "bg-emerald-50 text-emerald-600 border-emerald-200/60",
  viewer: "bg-gray-50 text-gray-500 border-gray-200/60",
};

function ProfileSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="p-6 space-y-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </Card>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const { user, shop: authShop, isLoading: authLoading } = useAuth();
  const { shop, isLoading: profileLoading } = useProfile();

  useEffect(() => {
    document.title = "Profile — Inklabs";
  }, []);

  if (authLoading || profileLoading) return <ProfileSkeleton />;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Profile" description="View your shop profile and account information" />

      {/* Shop Profile */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-900 tracking-tight">Shop Profile</h2>
          {shop && !shop.isActive && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-50 text-amber-600 border border-amber-200/60">
              Pending Activation
            </span>
          )}
        </div>

        <div className="flex items-start gap-4 mb-6">
          {shop?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.logoUrl} alt={shop.displayName} className="w-16 h-16 rounded-2xl object-cover border border-gray-100 shadow-sm" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center text-2xl font-bold text-indigo-700 shadow-sm">
              {shop?.displayName?.charAt(0)?.toUpperCase() ?? "S"}
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold text-gray-900 tracking-tight">{shop?.displayName}</h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border ${shop?.shopType === "shopify" ? "bg-emerald-50 text-emerald-600 border-emerald-200/60" : "bg-purple-50 text-purple-600 border-purple-200/60"}`}>
                {shop?.shopType === "shopify" ? "Shopify" : "Studio"}
              </span>
              {shop?.slug && <span className="text-sm text-gray-400 font-mono">/{shop.slug}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shop?.contact?.email && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Contact Email</label>
              <p className="text-sm text-gray-900">{shop.contact.email}</p>
            </div>
          )}
          {shop?.contact?.phone && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Phone</label>
              <p className="text-sm text-gray-900">{shop.contact.phone}</p>
            </div>
          )}
          {shop?.contact?.address && (
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Address</label>
              <p className="text-sm text-gray-900">
                {[shop.contact.address, shop.contact.city, shop.contact.state, shop.contact.pincode].filter(Boolean).join(", ")}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Account Info */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-5 tracking-tight">Your Account</h2>
        <div className="flex items-center gap-4 mb-5">
          {user?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt={user.displayName || ""} className="w-14 h-14 rounded-2xl border border-gray-100 shadow-sm object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center text-xl font-bold text-indigo-700 shadow-sm">
              {(user?.displayName || user?.email)?.charAt(0)?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900 tracking-tight text-lg">{user?.displayName || "—"}</p>
            <p className="text-sm text-gray-400">{user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role</label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium capitalize border ${roleColors[authShop?.role ?? ""] ?? "bg-gray-50 text-gray-500 border-gray-200/60"}`}>
              {authShop?.role}
            </span>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 tracking-tight">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/select-shop" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium active:scale-[0.97]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Switch Shop
          </a>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 text-red-600 rounded-xl hover:bg-red-100 hover:border-red-200 transition-all text-sm font-medium active:scale-[0.97]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
