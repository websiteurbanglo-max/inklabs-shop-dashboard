import { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { verifyShopUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils";
import PageHeader from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import type { Order, OrderEvent, Pipeline } from "@/models/types";

export const metadata: Metadata = {
  title: "Order Detail — Inklabs Shop Dashboard",
};

const stageColors: Record<string, string> = {
  received: "bg-blue-100 text-blue-800",
  processing: "bg-yellow-100 text-yellow-800",
  printing: "bg-orange-100 text-orange-800",
  quality_check: "bg-purple-100 text-purple-800",
  shipped: "bg-green-100 text-green-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

const eventIcons: Record<string, string> = {
  ORDER_CREATED: "🎉",
  STATUS_CHANGED: "↗️",
  NOTE_ADDED: "📝",
  FILE_UPLOADED: "📎",
  PAYMENT_UPDATED: "💰",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  let session;
  try {
    session = await verifyShopUser();
  } catch {
    redirect("/login");
  }

  const { orderId } = await params;

  const orderDoc = await adminDb
    .collection("shops")
    .doc(session.shopId)
    .collection("orders")
    .doc(orderId)
    .get();

  if (!orderDoc.exists) {
    notFound();
  }

  const order = { ...orderDoc.data(), orderId: orderDoc.id } as Order;

  // Verify order belongs to this shop (defense in depth)
  if (order.shopId && order.shopId !== session.shopId) {
    notFound();
  }

  // Fetch events
  const eventsSnap = await adminDb
    .collection("shops")
    .doc(session.shopId)
    .collection("orders")
    .doc(orderId)
    .collection("events")
    .orderBy("timestamp", "desc")
    .get();

  const events = eventsSnap.docs.map((doc) => ({
    ...doc.data(),
    eventId: doc.id,
  })) as OrderEvent[];

  // Fetch pipeline
  let pipeline: Pipeline | null = null;
  if (order.pipelineId) {
    const pipelineDoc = await adminDb
      .collection("pipelines")
      .doc(order.pipelineId)
      .get();
    if (pipelineDoc.exists) {
      pipeline = { ...pipelineDoc.data(), pipelineId: pipelineDoc.id } as Pipeline;
    }
  }

  const stages = pipeline?.stages
    ? [...pipeline.stages].sort((a, b) => a.order - b.order)
    : [];
  const currentStageIndex = stages.findIndex(
    (s) => s.key === order.currentStageKey
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order #${orderId.substring(0, 8)}...`}
        description={`Created ${formatDate(order.createdAt)} • ${formatRelativeTime(order.createdAt)}`}
        actions={
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            ← Back to Orders
          </Link>
        }
      />

      {/* Stage indicator */}
      {stages.length > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Order Progress
          </h2>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {stages.map((stage, index) => {
              const isPast = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;
              return (
                <div key={stage.key} className="flex items-center gap-1 min-w-0">
                  <div className="flex flex-col items-center min-w-16">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isCurrent
                          ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                          : isPast
                            ? "bg-green-500 text-white"
                            : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {isPast ? "✓" : index + 1}
                    </div>
                    <span
                      className={`text-xs mt-1 text-center leading-tight ${
                        isCurrent
                          ? "text-indigo-600 font-semibold"
                          : isPast
                            ? "text-green-600"
                            : "text-gray-400"
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                  {index < stages.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 min-w-4 mt-[-16px] ${
                        isPast ? "bg-green-400" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                stageColors[order.currentStageKey] || "bg-gray-100 text-gray-700"
              }`}
            >
              Current: {order.currentStageKey?.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-gray-400">
              (Read-only — stage changes are managed by the platform)
            </span>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Design Preview - 3/5 width */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Design
            </h2>
            {order.designAssets?.designImageUrl ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={order.designAssets.designImageUrl}
                  alt="Design"
                  className="max-w-full max-h-96 object-contain rounded-lg border border-gray-100"
                />
                <a
                  href={order.designAssets.designImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm hover:bg-indigo-100 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Download Design
                </a>
              </div>
            ) : (
              <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                <p className="text-gray-400 text-sm">No design image available</p>
              </div>
            )}

            {order.designAssets?.rawImageUrl &&
              order.designAssets.rawImageUrl !==
                order.designAssets.designImageUrl && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    Original Upload
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={order.designAssets.rawImageUrl}
                    alt="Original upload"
                    className="max-w-xs max-h-32 object-contain rounded border border-gray-100"
                  />
                  <a
                    href={order.designAssets.rawImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                  >
                    Download Original
                  </a>
                </div>
              )}
          </Card>
        </div>

        {/* Order Details - 2/5 width */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer */}
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Customer
            </h2>
            <div className="space-y-2">
              <p className="text-gray-900 font-medium">
                {order.customerName || "—"}
              </p>
              {order.customerEmail && (
                <p className="text-sm text-gray-500">{order.customerEmail}</p>
              )}
            </div>
          </Card>

          {/* Product */}
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Product Details
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Title</span>
                <span className="text-gray-900">
                  {order.productTitle || "Custom Order"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Size</span>
                <span className="text-gray-900">{order.sizeInInches}&quot; inches</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Variant Group</span>
                <span className="text-gray-900">{order.variantGroup}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Quantity</span>
                <span className="text-gray-900 font-medium">
                  {order.quantity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Source</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    order.source === "shopify"
                      ? "bg-green-100 text-green-700"
                      : "bg-purple-100 text-purple-700"
                  }`}
                >
                  {order.source}
                </span>
              </div>
              {order.shopifyOrderNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Shopify Order</span>
                  <span className="text-gray-900">
                    #{order.shopifyOrderNumber}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Billing */}
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Billing
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Unit Price</span>
                <span className="text-gray-900">
                  {formatCurrency(order.billingSnapshot?.unitPrice || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Quantity</span>
                <span className="text-gray-900">×{order.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-900">
                  {formatCurrency(order.billingSnapshot?.subtotal || 0)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="font-semibold text-gray-800">Total</span>
                <span className="font-bold text-lg text-gray-900">
                  {formatCurrency(order.billingSnapshot?.total || 0)}
                </span>
              </div>
              {order.billingSnapshot?.ruleSource && (
                <p className="text-xs text-gray-400 mt-1">
                  Pricing: {order.billingSnapshot.ruleSource} rate
                </p>
              )}
            </div>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card className="p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">
                Notes
              </h2>
              <p className="text-sm text-gray-600">{order.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {/* Event Timeline */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Order Timeline
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-gray-400">No events recorded</p>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.eventId} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-sm">
                  {eventIcons[event.type] || "📋"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {event.description}
                  </p>
                  {event.performedByName && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      by {event.performedByName}
                    </p>
                  )}
                  {event.type === "STATUS_CHANGED" &&
                    event.fromStageKey &&
                    event.toStageKey && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {event.fromStageKey.replace(/_/g, " ")} →{" "}
                        {event.toStageKey.replace(/_/g, " ")}
                      </p>
                    )}
                </div>
                <div className="flex-shrink-0 text-xs text-gray-400">
                  {formatRelativeTime(event.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
