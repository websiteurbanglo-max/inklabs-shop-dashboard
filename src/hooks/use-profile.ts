"use client";

import useSWR from "swr";
import type { Shop } from "@/models/types";

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export function useProfile() {
  const { data, error, isLoading, mutate } = useSWR<{ shop: Shop }>(
    "/api/profile",
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    shop: data?.shop ?? null,
    isLoading,
    isError: !!error,
    mutate,
  };
}
