import { redirect } from "next/navigation";
import Link from "next/link";
import { adminDb } from "@/lib/firebase-admin";
import { adminAuth } from "@/lib/firebase-admin";
import { getShopSession } from "@/lib/auth";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import PageHeader from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import type { Order } from "@/models/types";

async function getDashboardData(shopId: string) {
  const ordersRef = adminDb
    .collection("shops")
    .doc(shopId)
    .collection("orders");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    recentSnap,
    statsSnap,
    totalCountSnap,
    monthCountSnap,
    pendingCountSnap,
  ] = await Promise.all([
    ordersRef.orderBy("createdAt", "desc").limit(10).get(),
    ordersRef.orderBy("createdAt", "desc").limit(200).get(),
    ordersRef.count().get(),
    ordersRef.where("createdAt", ">=", startOfMonth).count().get(),
    ordersRef.where("currentStageKey", "==", "received").count().get(),
  ]);

  const orders = recentSnap.docs.map((doc) => ({
    ...doc.data(),
    orderId: doc.id,
  })) as Order[];

  const statsOrders = statsSnap.docs.map((d) => d.data() as Order);

  const stats = {
    totalOrders: totalCountSnap.data().count,
    totalRevenue: statsOrders.reduce(
      (sum, o) => sum + (o.billingSnapshot?.total || 0),
      0
    ),
    ordersThisMonth: monthCountSnap.data().count,
    pendingOrders: pendingCountSnap.data().count,
  };

  const stageCounts: Record<string, number> = {};
  for (const order of statsOrders) {
    const key = order.currentStageKey || "unknown";
    stageCounts[key] = (stageCounts[key] || 0) + 1;
  }

  return { orders, stats, stageCounts };
}

const stageIcons: Record<string, string> = {
  received: "bg-blue-100 text-blue-600",
  processing: "bg-amber-100 text-amber-600",
  printing: "bg-orange-100 text-orange-600",
  quality_check: "bg-purple-100 text-purple-600",
  shipped: "bg-emerald-100 text-emerald-600",
  delivered: "bg-green-100 text-green-600",
  cancelled: "bg-red-100 text-red-600",
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

export default async function DashboardPage() {
  let session;
  try {
    session = await getShopSession();
  } catch {
    redirect("/login");
  }

  const [userRecord, { orders, stats, stageCounts }] = await Promise.all([
    adminAuth.getUser(session.uid).catch(() => null),
    getDashboardData(session.shopId),
  ]);

  const userDisplayName = userRecord?.displayName || session.email;

  const canCreateOrder =
    session.role === "operator" ||
    session.role === "admin" ||
    session.role === "owner";

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${userDisplayName.split(" ")[0]}`}
        description={`${session.shopDisplayName} — Shop Dashboard`}
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

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <Card className="p-6 group hover:border-indigo-200/60 transition-all duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-400">Total Orders</p>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <svg className="w-[18px] h-[18px] text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2 tabular-nums">
            {stats.totalOrders}
          </p>
          <p className="text-[11px] text-gray-300 mt-1">All time</p>
        </Card>

        <Card className="p-6 group hover:border-emerald-200/60 transition-all duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-400">Total Revenue</p>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <svg className="w-[18px] h-[18px] text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2 tabular-nums">
            {formatCurrency(stats.totalRevenue)}
          </p>
          <p className="text-[11px] text-gray-300 mt-1">All time</p>
        </Card>

        <Card className="p-6 group hover:border-blue-200/60 transition-all duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-400">This Month</p>
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <svg className="w-[18px] h-[18px] text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2 tabular-nums">
            {stats.ordersThisMonth}
          </p>
          <p className="text-[11px] text-gray-300 mt-1">Orders placed</p>
        </Card>

        <Card className="p-6 group hover:border-amber-200/60 transition-all duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-400">Pending</p>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <svg className="w-[18px] h-[18px] text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-indigo-600 mt-2 tabular-nums">
            {stats.pendingOrders}
          </p>
          <p className="text-[11px] text-gray-300 mt-1">Awaiting processing</p>
        </Card>
      </div>

      {/* Orders by Stage */}
      {Object.keys(stageCounts).length > 0 && (
        <Card className="p-6 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <h2 className="text-sm font-semibold text-gray-900 mb-4 tracking-tight">
            Orders by Stage
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {Object.entries(stageCounts).map(([key, count]) => (
              <Link
                key={key}
                href={`/orders?stage=${key}`}
                className="flex flex-col items-center p-3.5 rounded-xl border border-gray-100/80 hover:border-indigo-200/60 hover:bg-indigo-50/30 transition-all duration-200 group active:scale-[0.98]"
              >
                <span
                  className={`text-2xl font-bold tabular-nums transition-transform duration-200 group-hover:scale-110 ${
                    stageIcons[key]
                      ? stageIcons[key].split(" ")[1]
                      : "text-gray-600"
                  }`}
                >
                  {count}
                </span>
                <span className="text-[11px] text-gray-400 mt-1.5 capitalize font-medium">
                  {key.replace(/_/g, " ")}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Orders */}
      <Card className="p-6 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-900 tracking-tight">
            Recent Orders
          </h2>
          <Link
            href="/orders"
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors flex items-center gap-1 group"
          >
            View all
            <svg className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-14">
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
            <p className="text-gray-500 text-sm font-medium">No orders yet</p>
            <p className="text-gray-300 text-xs mt-1">Orders will appear here once created</p>
            {canCreateOrder && (
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
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100/80">
                  <th className="text-left py-2.5 px-6 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="text-left py-2.5 px-6 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((order) => (
                  <tr
                    key={order.orderId}
                    className="hover:bg-gray-50/60 transition-colors group"
                  >
                    <td className="py-3.5 px-6">
                      <Link
                        href={`/orders/${order.orderId}`}
                        className="text-indigo-600 hover:text-indigo-700 font-mono text-xs font-medium transition-colors"
                      >
                        {order.orderId.substring(0, 8)}...
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-gray-900 font-medium">
                      {order.customerName || "—"}
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
                    <td className="py-3.5 px-4 text-gray-900 font-medium tabular-nums">
                      {formatCurrency(order.billingSnapshot?.total || 0)}
                    </td>
                    <td className="py-3.5 px-6 text-gray-400 text-xs">
                      {formatRelativeTime(order.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
