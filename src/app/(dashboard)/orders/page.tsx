import { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyShopUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import PageHeader from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import type { Order } from "@/models/types";

export const metadata: Metadata = {
  title: "Orders — Inklabs Shop Dashboard",
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

interface SearchParams {
  stage?: string;
  source?: string;
  search?: string;
  page?: string;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  let session;
  try {
    session = await verifyShopUser();
  } catch {
    redirect("/login");
  }

  const params = await searchParams;
  const { stage, source, search } = params;

  let query = adminDb
    .collection("shops")
    .doc(session.shopId)
    .collection("orders")
    .orderBy("createdAt", "desc")
    .limit(25);

  if (stage) {
    query = adminDb
      .collection("shops")
      .doc(session.shopId)
      .collection("orders")
      .where("currentStageKey", "==", stage)
      .orderBy("createdAt", "desc")
      .limit(25) as typeof query;
  }

  if (source === "shopify" || source === "studio") {
    query = adminDb
      .collection("shops")
      .doc(session.shopId)
      .collection("orders")
      .where("source", "==", source)
      .orderBy("createdAt", "desc")
      .limit(25) as typeof query;
  }

  const snap = await query.get();
  let orders = snap.docs.map((doc) => ({
    ...doc.data(),
    orderId: doc.id,
  })) as Order[];

  // Client-side search filter
  if (search) {
    const q = search.toLowerCase();
    orders = orders.filter(
      (o) =>
        o.customerName?.toLowerCase().includes(q) ||
        o.customerEmail?.toLowerCase().includes(q) ||
        o.orderId?.toLowerCase().includes(q)
    );
  }

  const canCreateOrder =
    session.role === "operator" ||
    session.role === "admin" ||
    session.role === "owner";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="View and manage your shop orders"
        actions={
          canCreateOrder ? (
            <Link
              href="/orders/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Order
            </Link>
          ) : undefined
        }
      />

      {/* Filter Bar */}
      <Card className="p-4">
        <form className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Customer name, email, order ID..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Stage
            </label>
            <select
              name="stage"
              defaultValue={stage || ""}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
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
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Source
            </label>
            <select
              name="source"
              defaultValue={source || ""}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">All Sources</option>
              <option value="shopify">Shopify</option>
              <option value="studio">Studio</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
          >
            Filter
          </button>
          {(stage || source || search) && (
            <Link
              href="/orders"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
            >
              Clear
            </Link>
          )}
        </form>
      </Card>

      {/* Orders Table */}
      <Card className="p-0 overflow-hidden">
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <svg
              className="w-12 h-12 text-gray-300 mx-auto mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-gray-500 text-sm font-medium">No orders found</p>
            <p className="text-gray-400 text-xs mt-1">
              {stage || source || search
                ? "Try adjusting your filters"
                : "Orders will appear here once created"}
            </p>
            {canCreateOrder && !stage && !source && !search && (
              <Link
                href="/orders/create"
                className="mt-4 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Create your first order →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Design
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((order) => (
                  <tr
                    key={order.orderId}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <Link
                        href={`/orders/${order.orderId}`}
                        className="text-indigo-600 hover:text-indigo-700 font-mono text-xs font-medium"
                      >
                        {order.orderId.substring(0, 12)}...
                      </Link>
                      {order.shopifyOrderNumber && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          #{order.shopifyOrderNumber}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-gray-900 font-medium">
                        {order.customerName || "—"}
                      </p>
                      {order.customerEmail && (
                        <p className="text-xs text-gray-400">
                          {order.customerEmail}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {order.sizeInInches}&quot;
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {order.quantity}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          stageColors[order.currentStageKey] ||
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {order.currentStageKey?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          order.source === "shopify"
                            ? "bg-green-100 text-green-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {order.source}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-900 font-medium">
                      {formatCurrency(order.billingSnapshot?.total || 0)}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {formatRelativeTime(order.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      {order.designAssets?.thumbnailUrl ||
                      order.designAssets?.designImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            order.designAssets.thumbnailUrl ||
                            order.designAssets.designImageUrl
                          }
                          alt="Design"
                          className="w-10 h-10 object-cover rounded border border-gray-200"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
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

      <p className="text-xs text-gray-400 text-center">
        Showing {orders.length} order{orders.length !== 1 ? "s" : ""}
        {stage || source || search ? " (filtered)" : ""}
      </p>
    </div>
  );
}
