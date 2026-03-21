"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MemberRole } from "@/models/types";

interface TopbarProps {
  shopDisplayName: string;
  shopId: string;
  role: MemberRole;
}

export default function Topbar({ shopDisplayName, shopId, role }: TopbarProps) {
  const [userInfo, setUserInfo] = useState<{
    displayName?: string;
    email?: string;
    photoURL?: string;
    shopType?: string;
  } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUserInfo({
            displayName: data.user.displayName,
            email: data.user.email,
            photoURL: data.user.photoURL,
            shopType: data.shop?.shopType,
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      // Full page reload to clear all client state (SWR cache, etc.)
      window.location.href = "/login";
    } catch {
      toast.error("Sign out failed");
      setSigningOut(false);
    }
  };

  const roleColors: Record<MemberRole, string> = {
    owner: "bg-purple-100 text-purple-700",
    admin: "bg-blue-100 text-blue-700",
    operator: "bg-green-100 text-green-700",
    viewer: "bg-gray-100 text-gray-600",
  };

  const shopTypeLabel =
    userInfo?.shopType === "shopify" ? "Shopify" : "Studio";

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
      {/* Left: Shop info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 truncate">
            {shopDisplayName}
          </h2>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded-full font-medium",
                userInfo?.shopType === "shopify"
                  ? "bg-green-100 text-green-700"
                  : "bg-purple-100 text-purple-700"
              )}
            >
              {shopTypeLabel}
            </span>
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded-full font-medium",
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
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
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
          Switch Shop
        </Link>

        {/* User avatar + sign out */}
        <div className="flex items-center gap-2">
          {userInfo?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={userInfo.photoURL}
              alt={userInfo.displayName || ""}
              className="w-8 h-8 rounded-full border border-gray-200"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
              {(userInfo?.displayName || userInfo?.email || "U")
                .charAt(0)
                .toUpperCase()}
            </div>
          )}

          <div className="hidden sm:block min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate max-w-32">
              {userInfo?.displayName || userInfo?.email || "..."}
            </p>
          </div>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Sign out"
          >
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
          </button>
        </div>
      </div>
    </header>
  );
}
