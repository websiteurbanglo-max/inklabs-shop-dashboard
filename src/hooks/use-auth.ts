"use client";

import useSWR from "swr";

interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

interface ShopInfo {
  shopId: string;
  displayName: string;
  shopType: "shopify" | "studio";
  role: "owner" | "admin" | "operator" | "viewer";
  isActive: boolean;
}

interface AuthData {
  user: AuthUser;
  shop: ShopInfo;
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error("Failed to fetch auth data");
    throw error;
  }
  return res.json();
}

export function useAuth() {
  const { data, error, isLoading, mutate } = useSWR<AuthData>(
    "/api/auth/me",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    user: data?.user ?? null,
    shop: data?.shop ?? null,
    isLoading,
    isError: !!error,
    mutate,
  };
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}
