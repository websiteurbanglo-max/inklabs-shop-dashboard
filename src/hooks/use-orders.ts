"use client";

import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import type { Order, OrderEvent, Pipeline } from "@/models/types";

interface OrdersPage {
  orders: Order[];
  nextCursor: string | null;
}

interface OrderDetailData {
  order: Order;
  events: OrderEvent[];
  pipeline: Pipeline | null;
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

interface UseOrdersOptions {
  stage?: string;
  source?: string;
  search?: string;
  today?: boolean;
  limit?: number;
}

export function useOrders(options: UseOrdersOptions = {}) {
  const { stage, source, search, today, limit = 25 } = options;

  const getKey = (pageIndex: number, previousPageData: OrdersPage | null) => {
    // No more pages
    if (previousPageData && !previousPageData.nextCursor) return null;

    const params = new URLSearchParams();
    if (stage) params.set("stage", stage);
    if (source) params.set("source", source);
    if (search) params.set("search", search);
    if (today) params.set("today", "true");
    params.set("limit", String(limit));

    if (pageIndex > 0 && previousPageData?.nextCursor) {
      params.set("cursor", previousPageData.nextCursor);
    }

    return `/api/orders?${params.toString()}`;
  };

  const { data, error, isLoading, isValidating, size, setSize } =
    useSWRInfinite<OrdersPage>(getKey, fetcher, {
      revalidateOnFocus: false,
      revalidateFirstPage: false,
    });

  const orders = data ? data.flatMap((page) => page.orders) : [];
  const lastPage = data ? data[data.length - 1] : null;
  const hasMore = !!lastPage?.nextCursor;
  const isLoadingMore = isValidating && size > (data?.length ?? 0);

  return {
    orders,
    isLoading,
    isError: !!error,
    hasMore,
    isLoadingMore,
    loadMore: () => setSize(size + 1),
  };
}

export function useOrder(orderId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<OrderDetailData>(
    orderId ? `/api/orders/${orderId}` : null,
    fetcher,
    { revalidateOnFocus: false }
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
