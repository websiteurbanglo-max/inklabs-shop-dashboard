"use client";

import useSWR from "swr";
import type { ShopMember } from "@/models/types";

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch team");
  return res.json();
}

export function useTeam() {
  const { data, error, isLoading, mutate } = useSWR<{ members: ShopMember[] }>(
    "/api/team",
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    members: data?.members ?? [],
    isLoading,
    isError: !!error,
    mutate,
  };
}
