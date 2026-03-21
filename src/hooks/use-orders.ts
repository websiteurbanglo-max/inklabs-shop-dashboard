"use client";

import useSWR from "swr";
import type { Order } from "@/models/types";

interface OrdersData {
  orders: Order[];
  nextCursor: string | null;
}

interface OrderDetailData {
  order: Order;
  events: import("@/models/types").OrderEvent[];
  pipeline: import("@/models/types").Pipeline | null;
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error("Failed to fetch orders");
    throw error;
  }
  return res.json();
}

interface UseOrdersOptions {
  stage?: string;
  source?: string;
  search?: string;
  limit?: number;
}

export function useOrders(options: UseOrdersOptions = {}) {
  const params = new URLSearchParams();
  if (options.stage) params.set("stage", options.stage);
  if (options.source) params.set("source", options.source);
  if (options.search) params.set("search", options.search);
  if (options.limit) params.set("limit", String(options.limit));

  const url = `/api/orders?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<OrdersData>(url, fetcher, {
    revalidateOnFocus: false,
  });

  return {
    orders: data?.orders ?? [],
    nextCursor: data?.nextCursor ?? null,
    isLoading,
    isError: !!error,
    mutate,
  };
}

export function useOrder(orderId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<OrderDetailData>(
    orderId ? `/api/orders/${orderId}` : null,
    fetcher
  );

  return {
    order: data?.order ?? null,
    events: data?.events ?? [],
    pipeline: data?.pipeline ?? null,
    isLoading,
    isError: !!error,
    mutate,
  };
}
