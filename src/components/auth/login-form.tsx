"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { toast } from "sonner";
import { getClientAuth, getGoogleProvider } from "@/lib/firebase-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const auth = getClientAuth();
      const provider = getGoogleProvider();

      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      // Exchange ID token for session cookie
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      const { redirect } = data;

      toast.success("Signed in successfully!");

      // Navigate to the appropriate route
      const from = searchParams.get("from");
      if (redirect === "/dashboard" && from && from.startsWith("/")) {
        router.push(from);
      } else {
        router.push(redirect || "/dashboard");
      }
    } catch (err: unknown) {
      const errorCode =
        (err as { code?: string }).code || "";
      const errorMessage =
        (err as { message?: string }).message || "Sign in failed";

      if (errorCode === "auth/popup-blocked") {
        setError(
          "Popup was blocked by your browser. Please allow popups for this site and try again."
        );
      } else if (errorCode === "auth/popup-closed-by-user") {
        setError("Sign in was cancelled.");
      } else if (errorCode === "auth/network-request-failed") {
        setError(
          "Network error. Please check your connection and try again."
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Shop Dashboard</h2>
        <p className="text-gray-500 text-sm mt-2">
          Sign in with your Google account to manage your shop
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg">
          <div className="flex gap-3">
            <svg
              className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <Button
        onClick={handleGoogleSignIn}
        loading={loading}
        variant="outline"
        size="lg"
        className="w-full gap-3"
      >
        {!loading && (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        {loading ? "Signing in..." : "Sign in with Google"}
      </Button>

      <div className="mt-6 text-center">
        <p className="text-xs text-gray-400">
          By signing in, you agree to the platform terms of service.
        </p>
      </div>
    </Card>
  );
}
