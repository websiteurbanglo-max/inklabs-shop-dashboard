"use client";

import useSWR from "swr";
import type { Order } from "@/models/types";

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  ordersThisMonth: number;
  pendingOrders: number;
}

interface DashboardData {
  stats: DashboardStats;
  recentOrders: Order[];
  stageCounts: Record<string, number>;
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch dashboard data");
  return res.json();
}

export function useDashboard() {
  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    "/api/dashboard",
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    stats: data?.stats ?? null,
    recentOrders: data?.recentOrders ?? [],
    stageCounts: data?.stageCounts ?? {},
    isLoading,
    isError: !!error,
    mutate,
  };
}
