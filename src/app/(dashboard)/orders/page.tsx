"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useOrders } from "@/hooks/use-orders";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import PageHeader from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const stageColors: Record<string, string> = {
  received: "bg-blue-50 text-blue-700 border-blue-200/60",
  processing: "bg-amber-50 text-amber-700 border-amber-200/60",
  printing: "bg-orange-50 text-orange-700 border-orange-200/60",
  quality_check: "bg-purple-50 text-purple-700 border-purple-200/60",
  shipped: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  delivered: "bg-green-50 text-green-700 border-green-200/60",
  cancelled: "bg-red-50 text-red-700 border-red-200/60",
};

function OrdersTableSkeleton() {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b border-gray-100 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </Card>
  );
}

export default function OrdersPage() {
  const { shop } = useAuth();

  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [today, setToday] = useState(false);

  useEffect(() => {
    document.title = "Orders — Inklabs";
  }, []);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset other filters when Today is toggled
  const handleTodayToggle = useCallback(() => {
    setToday((prev) => {
      if (!prev) {
        setStage("");
        setSource("");
        setSearchInput("");
        setSearch("");
      }
      return !prev;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setStage("");
    setSource("");
    setSearchInput("");
    setSearch("");
    setToday(false);
  }, []);

  const { orders, isLoading, hasMore, isLoadingMore, loadMore } = useOrders({
    stage: stage || undefined,
    source: source || undefined,
    search: search || undefined,
    today,
  });

  const canCreateOrder =
    shop?.role === "operator" ||
    shop?.role === "admin" ||
    shop?.role === "owner";

  const hasActiveFilters = stage || source || search || today;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="View and manage your shop orders"
        actions={
          canCreateOrder ? (
            <Link
              href="/orders/create"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-b from-indigo-500 to-indigo-600 text-white rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all duration-200 text-sm font-medium shadow-sm active:scale-[0.97] border border-indigo-600/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Order
            </Link>
          ) : undefined
        }
      />

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Today toggle */}
          <button
            onClick={handleTodayToggle}
            className={`h-10 px-4 rounded-xl text-sm font-medium border transition-all duration-200 active:scale-95 ${
              today
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            Today
          </button>

          <div className="flex-1 min-w-48">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (today) setToday(false);
              }}
              placeholder="Search by name, email, order ID..."
              className="w-full h-10 px-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 hover:border-gray-300 transition-all"
            />
          </div>

          <select
            value={stage}
            onChange={(e) => { setStage(e.target.value); if (today) setToday(false); }}
            className="h-10 px-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white hover:border-gray-300 transition-all"
          >
            <option value="">All Stages</option>
            <option value="received">Received</option>
            <option value="processing">Processing</option>
            <option value="printing">Printing</option>
            <option value="quality_check">Quality Check</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={source}
            onChange={(e) => { setSource(e.target.value); if (today) setToday(false); }}
            className="h-10 px-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white hover:border-gray-300 transition-all"
          >
            <option value="">All Sources</option>
            <option value="shopify">Shopify</option>
            <option value="studio">Studio</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="h-10 px-4 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 text-sm font-medium border border-gray-200 hover:border-gray-300 transition-all active:scale-95"
            >
              Clear
            </button>
          )}
        </div>
      </Card>

      {/* Orders Table */}
      {isLoading ? (
        <OrdersTableSkeleton />
      ) : (
        <Card className="p-0 overflow-hidden">
          {orders.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-sm font-medium">No orders found</p>
              <p className="text-gray-300 text-xs mt-1">
                {hasActiveFilters ? "Try adjusting your filters" : "Orders will appear here once created"}
              </p>
              {canCreateOrder && !hasActiveFilters && (
                <Link href="/orders/create" className="mt-4 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  Create your first order
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 border-b border-gray-100/80">
                  <tr>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Order ID</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Customer</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Size</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Qty</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Stage</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Source</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Created</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Design</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((order) => (
                    <tr key={order.orderId} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link href={`/orders/${order.orderId}`} className="text-indigo-600 hover:text-indigo-700 font-mono text-xs font-medium">
                          {order.orderId.substring(0, 12)}...
                        </Link>
                        {order.shopifyOrderNumber && (
                          <p className="text-[11px] text-gray-300 mt-0.5">#{order.shopifyOrderNumber}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-gray-900 font-medium">{order.customerName || "—"}</p>
                        {order.customerEmail && (
                          <p className="text-[11px] text-gray-300 truncate max-w-40">{order.customerEmail}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500">{order.sizeInInches}&quot;</td>
                      <td className="py-3.5 px-4 text-gray-500 tabular-nums">{order.quantity}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border ${stageColors[order.currentStageKey] ?? "bg-gray-50 text-gray-600 border-gray-200/60"}`}>
                          {order.currentStageKey?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border ${order.source === "shopify" ? "bg-emerald-50 text-emerald-600 border-emerald-200/60" : "bg-purple-50 text-purple-600 border-purple-200/60"}`}>
                          {order.source}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-900 font-medium tabular-nums">{formatCurrency(order.billingSnapshot?.total || 0)}</td>
                      <td className="py-3.5 px-4 text-gray-400 text-xs">{formatRelativeTime(order.createdAt)}</td>
                      <td className="py-3.5 px-4">
                        {order.designAssets?.thumbnailUrl || order.designAssets?.designImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={order.designAssets.thumbnailUrl || order.designAssets.designImageUrl}
                            alt="Design"
                            className="w-10 h-10 object-cover rounded-lg border border-gray-100"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Load More */}
      {!isLoading && hasMore && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 text-sm font-medium transition-all duration-200 disabled:opacity-50 active:scale-95"
          >
            {isLoadingMore ? "Loading…" : "Load more orders"}
          </button>
        </div>
      )}

      {!isLoading && orders.length > 0 && (
        <p className="text-[11px] text-gray-300 text-center">
          Showing {orders.length} order{orders.length !== 1 ? "s" : ""}
          {hasActiveFilters ? " (filtered)" : ""}
        </p>
      )}
    </div>
  );
}
