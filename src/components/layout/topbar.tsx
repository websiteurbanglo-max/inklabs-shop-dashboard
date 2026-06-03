"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { MemberRole } from "@/models/types";

interface TopbarProps {
  shopDisplayName: string;
  shopId: string;
  role: MemberRole;
}

export default function Topbar({ shopDisplayName, role }: TopbarProps) {
  const { user, shop } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      window.location.href = "/login";
    } catch {
      toast.error("Sign out failed");
      setSigningOut(false);
    }
  };

  const roleColors: Record<MemberRole, string> = {
    owner: "bg-purple-50 text-purple-600 border-purple-200/60",
    admin: "bg-blue-50 text-blue-600 border-blue-200/60",
    operator: "bg-emerald-50 text-emerald-600 border-emerald-200/60",
    viewer: "bg-gray-50 text-gray-500 border-gray-200/60",
  };

  const shopTypeLabel = shop?.shopType === "shopify" ? "Shopify" : "Studio";

  return (
    <header className="h-16 glass-subtle border-b border-gray-100/60 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 sticky top-0 z-10">
      {/* Left: Shop info */}
      <div className="flex items-center gap-3 min-w-0 animate-fade-in">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 truncate tracking-tight">
            {shopDisplayName}
          </h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={cn(
                "text-[10px] px-1.5 py-px rounded-md font-medium border",
                shop?.shopType === "shopify"
                  ? "bg-emerald-50 text-emerald-600 border-emerald-200/60"
                  : "bg-purple-50 text-purple-600 border-purple-200/60"
              )}
            >
              {shopTypeLabel}
            </span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-px rounded-md font-medium border capitalize",
                roleColors[role]
              )}
            >
              {role}
            </span>
          </div>
        </div>
      </div>

      {/* Right: User actions */}
      <div className="flex items-center gap-2">
        {/* Switch shop */}
        <Link
          href="/select-shop"
          className={cn(
            "hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5",
            "text-xs font-medium text-gray-500 bg-gray-50/80",
            "hover:bg-gray-100 hover:text-gray-700",
            "rounded-xl transition-all duration-200 border border-gray-100",
            "active:scale-[0.97]"
          )}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          Switch
        </Link>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-gray-200/60 mx-1" />

        {/* User avatar + sign out */}
        <div className="flex items-center gap-2.5">
          {user?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt={user.displayName || ""}
              className="w-8 h-8 rounded-xl border border-gray-200/60 shadow-sm object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600 border border-indigo-200/40">
              {(user?.displayName || user?.email || "U")
                .charAt(0)
                .toUpperCase()}
            </div>
          )}

          <div className="hidden sm:block min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate max-w-32">
              {user?.displayName || user?.email || "..."}
            </p>
          </div>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className={cn(
              "p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100",
              "rounded-xl transition-all duration-200 disabled:opacity-50",
              "active:scale-95"
            )}
            title="Sign out"
          >
            {signingOut ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
