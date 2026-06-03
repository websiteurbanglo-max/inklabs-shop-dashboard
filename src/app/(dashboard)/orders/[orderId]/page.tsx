"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useOrder } from "@/hooks/use-orders";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils";
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

const eventIcons: Record<string, string> = {
  ORDER_CREATED: "bg-green-100 text-green-600",
  STATUS_CHANGED: "bg-blue-100 text-blue-600",
  NOTE_ADDED: "bg-amber-100 text-amber-600",
  FILE_UPLOADED: "bg-purple-100 text-purple-600",
  PAYMENT_UPDATED: "bg-emerald-100 text-emerald-600",
};

const eventSvgPaths: Record<string, string> = {
  ORDER_CREATED: "M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z",
  STATUS_CHANGED: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  NOTE_ADDED: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  FILE_UPLOADED: "M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13",
  PAYMENT_UPDATED: "M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z",
};

function OrderDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Card className="p-6">
            <Skeleton className="h-5 w-24 mb-4" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </Card>
        </div>
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId ?? null;
  const { order, events, pipeline, isLoading, isError } = useOrder(orderId);

  useEffect(() => {
    if (order) document.title = `Order #${order.orderId.substring(0, 8)} — Inklabs`;
    else document.title = "Order — Inklabs";
  }, [order]);

  if (isLoading) return <OrderDetailSkeleton />;

  if (isError || !order) {
    return (
      <div className="text-center py-24">
        <p className="text-gray-500 text-sm font-medium">Order not found</p>
        <Link href="/orders" className="mt-3 inline-flex text-sm text-indigo-600 hover:text-indigo-700 font-medium">
          ← Back to Orders
        </Link>
      </div>
    );
  }

  const stages = pipeline?.stages
    ? [...pipeline.stages].sort((a, b) => a.order - b.order)
    : [];
  const currentStageIndex = stages.findIndex((s) => s.key === order.currentStageKey);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order #${orderId?.substring(0, 8)}...`}
        description={`Created ${formatDate(order.createdAt)} — ${formatRelativeTime(order.createdAt)}`}
        actions={
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium active:scale-[0.97]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Orders
          </Link>
        }
      />

      {/* Stage indicator */}
      {stages.length > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-5 tracking-tight">Order Progress</h2>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {stages.map((stage, index) => {
              const isPast = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;
              return (
                <div key={stage.key} className="flex items-center gap-1 min-w-0">
                  <div className="flex flex-col items-center min-w-16">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${isCurrent ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-200/50 scale-110" : isPast ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-400"}`}>
                      {isPast ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : index + 1}
                    </div>
                    <span className={`text-[11px] mt-1.5 text-center leading-tight font-medium ${isCurrent ? "text-indigo-600" : isPast ? "text-emerald-600" : "text-gray-300"}`}>
                      {stage.label}
                    </span>
                  </div>
                  {index < stages.length - 1 && (
                    <div className={`h-0.5 flex-1 min-w-4 mt-[-20px] rounded-full ${isPast ? "bg-emerald-400" : "bg-gray-100"}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${stageColors[order.currentStageKey] ?? "bg-gray-50 text-gray-600 border-gray-200/60"}`}>
              Current: {order.currentStageKey?.replace(/_/g, " ")}
            </span>
            <span className="text-[11px] text-gray-300">Stage changes are managed by the platform</span>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Design */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 tracking-tight">Design</h2>
            {order.designAssets?.designImageUrl ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={order.designAssets.designImageUrl} alt="Design" className="max-w-full max-h-96 object-contain rounded-xl border border-gray-100" />
                <a href={order.designAssets.designImageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-all active:scale-[0.97]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Design
                </a>
              </div>
            ) : (
              <div className="h-48 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
                <p className="text-gray-300 text-sm">No design image available</p>
              </div>
            )}
          </Card>
        </div>

        {/* Details */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 tracking-tight">Customer</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
                {(order.customerName || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-gray-900 font-semibold">{order.customerName || "—"}</p>
                {order.customerEmail && <p className="text-xs text-gray-400">{order.customerEmail}</p>}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 tracking-tight">Product Details</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Title</span><span className="text-gray-900 font-medium">{order.productTitle || "Custom Order"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Size</span><span className="text-gray-900">{order.sizeInInches}&quot; inches</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Quantity</span><span className="text-gray-900 font-medium tabular-nums">{order.quantity}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Source</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border ${order.source === "shopify" ? "bg-emerald-50 text-emerald-600 border-emerald-200/60" : "bg-purple-50 text-purple-600 border-purple-200/60"}`}>
                  {order.source}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 tracking-tight">Billing</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Unit Price</span><span className="tabular-nums">{formatCurrency(order.billingSnapshot?.unitPrice || 0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Quantity</span><span className="tabular-nums">&times;{order.quantity}</span></div>
              <div className="flex justify-between pt-3 border-t border-gray-100">
                <span className="font-semibold text-gray-800">Total</span>
                <span className="font-bold text-lg text-gray-900 tabular-nums">{formatCurrency(order.billingSnapshot?.total || 0)}</span>
              </div>
            </div>
          </Card>

          {order.notes && (
            <Card className="p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-2 tracking-tight">Notes</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{order.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {/* Timeline */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-5 tracking-tight">Order Timeline</h2>
        {events.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-300">No events recorded</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event, i) => (
              <div key={event.eventId} className="flex gap-4">
                <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${eventIcons[event.type] ?? "bg-gray-100 text-gray-500"}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={eventSvgPaths[event.type] ?? "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{event.description}</p>
                  {event.performedByName && <p className="text-[11px] text-gray-400 mt-0.5">by {event.performedByName}</p>}
                  {event.type === "STATUS_CHANGED" && event.fromStageKey && event.toStageKey && (
                    <p className="text-[11px] text-gray-400 mt-0.5">{event.fromStageKey.replace(/_/g, " ")} → {event.toStageKey.replace(/_/g, " ")}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-[11px] text-gray-300 pt-0.5">{formatRelativeTime(event.timestamp)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
