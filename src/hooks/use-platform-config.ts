"use client";

import useSWR from "swr";
import type { VariantGroupDef } from "@/models/types";

interface PlatformConfigData {
  variantGroups: VariantGroupDef[];
  defaultPipelineId: string;
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch platform config");
  return res.json();
}

export function usePlatformConfig() {
  const { data, error, isLoading } = useSWR<PlatformConfigData>(
    "/api/platform-config",
    fetcher,
    {
      revalidateOnFocus: false,
      // Platform config is stable — keep cached for the session
      dedupingInterval: 60_000,
    }
  );

  return {
    variantGroups: data?.variantGroups ?? [],
    defaultPipelineId: data?.defaultPipelineId ?? "default",
    isLoading,
    isError: !!error,
  };
}
