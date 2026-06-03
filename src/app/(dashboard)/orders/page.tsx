import { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getShopSession } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import PageHeader from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import type { Order } from "@/models/types";

export const metadata: Metadata = {
  title: "Orders — Inklabs Shop Dashboard",
};

const stageColors: Record<string, string> = {
  received: "bg-blue-50 text-blue-700 border-blue-200/60",
  processing: "bg-amber-50 text-amber-700 border-amber-200/60",
  printing: "bg-orange-50 text-orange-700 border-orange-200/60",
  quality_check: "bg-purple-50 text-purple-700 border-purple-200/60",
  shipped: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  delivered: "bg-green-50 text-green-700 border-green-200/60",
  cancelled: "bg-red-50 text-red-700 border-red-200/60",
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
    session = await getShopSession();
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
  } else if (source === "shopify" || source === "studio") {
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
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-b from-indigo-500 to-indigo-600 text-white rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md hover:shadow-indigo-200/50 active:scale-[0.97] border border-indigo-600/20"
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
      <Card className="p-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <form className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Search
            </label>
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Customer name, email, order ID..."
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(79,70,229,0.08)] hover:border-gray-300"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Stage
            </label>
            <select
              name="stage"
              defaultValue={stage || ""}
              className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white hover:border-gray-300"
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
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Source
            </label>
            <select
              name="source"
              defaultValue={source || ""}
              className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white hover:border-gray-300"
            >
              <option value="">All Sources</option>
              <option value="shopify">Shopify</option>
              <option value="studio">Studio</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-gradient-to-b from-indigo-500 to-indigo-600 text-white rounded-xl hover:from-indigo-600 hover:to-indigo-700 text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-indigo-200/50 active:scale-[0.97] border border-indigo-600/20"
          >
            Filter
          </button>
          {(stage || source || search) && (
            <Link
              href="/orders"
              className="px-4 py-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 text-sm font-medium transition-all duration-200 border border-gray-200 hover:border-gray-300 active:scale-[0.97]"
            >
              Clear
            </Link>
          )}
        </form>
      </Card>

      {/* Orders Table */}
      <Card className="p-0 overflow-hidden animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-300"
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
            </div>
            <p className="text-gray-500 text-sm font-medium">No orders found</p>
            <p className="text-gray-300 text-xs mt-1">
              {stage || source || search
                ? "Try adjusting your filters"
                : "Orders will appear here once created"}
            </p>
            {canCreateOrder && !stage && !source && !search && (
              <Link
                href="/orders/create"
                className="mt-4 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              >
                Create your first order
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-100/80">
                <tr>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Design
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((order) => (
                  <tr
                    key={order.orderId}
                    className="hover:bg-indigo-50/30 transition-colors group"
                  >
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/orders/${order.orderId}`}
                        className="text-indigo-600 hover:text-indigo-700 font-mono text-xs font-medium transition-colors"
                      >
                        {order.orderId.substring(0, 12)}...
                      </Link>
                      {order.shopifyOrderNumber && (
                        <p className="text-[11px] text-gray-300 mt-0.5">
                          #{order.shopifyOrderNumber}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-gray-900 font-medium">
                        {order.customerName || "—"}
                      </p>
                      {order.customerEmail && (
                        <p className="text-[11px] text-gray-300 truncate max-w-40">
                          {order.customerEmail}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {order.sizeInInches}&quot;
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 tabular-nums">
                      {order.quantity}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border ${
                          stageColors[order.currentStageKey] ||
                          "bg-gray-50 text-gray-600 border-gray-200/60"
                        }`}
                      >
                        {order.currentStageKey?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border ${
                          order.source === "shopify"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200/60"
                            : "bg-purple-50 text-purple-600 border-purple-200/60"
                        }`}
                      >
                        {order.source}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-900 font-medium tabular-nums">
                      {formatCurrency(order.billingSnapshot?.total || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-gray-400 text-xs">
                      {formatRelativeTime(order.createdAt)}
                    </td>
                    <td className="py-3.5 px-4">
                      {order.designAssets?.thumbnailUrl ||
                      order.designAssets?.designImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            order.designAssets.thumbnailUrl ||
                            order.designAssets.designImageUrl
                          }
                          alt="Design"
                          className="w-10 h-10 object-cover rounded-lg border border-gray-100 transition-transform duration-200 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-gray-300"
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

      <p className="text-[11px] text-gray-300 text-center animate-fade-in" style={{ animationDelay: "400ms" }}>
        Showing {orders.length} order{orders.length !== 1 ? "s" : ""}
        {stage || source || search ? " (filtered)" : ""}
      </p>
    </div>
  );
}
