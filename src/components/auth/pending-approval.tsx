"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ShopMembership } from "@/models/types";

export default function PendingApproval() {
  const [memberships, setMemberships] = useState<ShopMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchMemberships = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/memberships");
      const data = await res.json();
      return data.memberships || [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    fetchMemberships().then((data) => {
      setMemberships(data);
      setLoading(false);
    });
  }, [fetchMemberships]);

  // Auto-poll every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const data = await fetchMemberships();
      const activeMemberships = data.filter(
        (m: ShopMembership) => m.status === "active"
      );
      if (activeMemberships.length > 0) {
        toast.success("Your access has been approved!");
        if (activeMemberships.length === 1) {
          // Set shop context cookie before redirecting
          try {
            await fetch("/api/auth/select-shop", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ shopId: activeMemberships[0].shopId }),
            });
          } catch {
            // If select-shop fails, redirect to select-shop page instead
          }
          window.location.href = "/dashboard";
        } else {
          window.location.href = "/select-shop";
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchMemberships]);

  const handleCheckStatus = async () => {
    setChecking(true);
    setMessage(null);

    try {
      const data = await fetchMemberships();
      setMemberships(data);

      const activeMemberships = data.filter(
        (m: ShopMembership) => m.status === "active"
      );

      if (activeMemberships.length > 0) {
        toast.success("Your access has been approved!");
        if (activeMemberships.length === 1) {
          // Set shop context cookie before redirecting
          try {
            await fetch("/api/auth/select-shop", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ shopId: activeMemberships[0].shopId }),
            });
          } catch {
            // If select-shop fails, redirect to select-shop page instead
          }
          window.location.href = "/dashboard";
        } else {
          window.location.href = "/select-shop";
        }
      } else {
        setMessage("Still waiting for approval. We'll notify you when it's ready.");
      }
    } catch {
      setMessage("Failed to check status. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    window.location.href = "/login";
  };

  const pendingMemberships = memberships.filter((m) => m.status === "pending");

  return (
    <Card className="p-8">
      {/* Illustration */}
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>

      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Awaiting Approval</h2>
        <p className="text-gray-500 text-sm mt-2">
          Your access request is being reviewed by the platform administrator
        </p>
      </div>

      {/* Pending memberships */}
      {!loading && pendingMemberships.length > 0 && (
        <div className="mb-6 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Pending Requests
          </p>
          {pendingMemberships.map((m) => (
            <div
              key={m.shopId}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                  {m.shopName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {m.shopName}
                  </p>
                  {m.requestedAt && (
                    <p className="text-xs text-gray-400">
                      Requested{" "}
                      {new Date(m.requestedAt).toLocaleDateString("en-IN")}
                    </p>
                  )}
                </div>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  m.shopType === "shopify"
                    ? "bg-green-100 text-green-700"
                    : "bg-purple-100 text-purple-700"
                }`}
              >
                {m.shopType}
              </span>
            </div>
          ))}
        </div>
      )}

      {message && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-sm text-blue-700">{message}</p>
        </div>
      )}

      <Button
        onClick={handleCheckStatus}
        loading={checking}
        className="w-full mb-3"
      >
        Check Status
      </Button>

      <div className="flex flex-col gap-2 mt-2">
        <Link
          href="/onboarding"
          className="text-center text-sm text-indigo-600 hover:text-indigo-700 font-medium py-2"
        >
          Request Access to Another Shop
        </Link>
        <button
          onClick={handleSignOut}
          className="text-center text-sm text-gray-400 hover:text-gray-600 py-2"
        >
          Sign Out
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center mt-4">
        This page checks automatically every 30 seconds.
      </p>
    </Card>
  );
}
