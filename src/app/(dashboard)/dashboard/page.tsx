import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { adminDb } from "@/lib/firebase-admin";
import { adminAuth } from "@/lib/firebase-admin";
import { verifyShopUser } from "@/lib/auth";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import PageHeader from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import type { Order } from "@/models/types";

async function getDashboardData(shopId: string) {
  // Fetch recent orders
  const ordersSnap = await adminDb
    .collection("shops")
    .doc(shopId)
    .collection("orders")
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  const orders = ordersSnap.docs.map((doc) => ({
    ...doc.data(),
    orderId: doc.id,
  })) as Order[];

  // Get all orders for stats (limit to last 1000 for performance)
  const allOrdersSnap = await adminDb
    .collection("shops")
    .doc(shopId)
    .collection("orders")
    .orderBy("createdAt", "desc")
    .limit(1000)
    .get();

  const allOrders = allOrdersSnap.docs.map((d) => d.data() as Order);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const stats = {
    totalOrders: allOrders.length,
    totalRevenue: allOrders.reduce(
      (sum, o) => sum + (o.billingSnapshot?.total || 0),
      0
    ),
    ordersThisMonth: allOrders.filter((o) => {
      const d =
        o.createdAt instanceof Date
          ? o.createdAt
          : typeof o.createdAt === "string"
            ? new Date(o.createdAt)
            : (o.createdAt as { toDate?: () => Date }).toDate?.() ?? new Date();
      return d >= startOfMonth;
    }).length,
    pendingOrders: allOrders.filter((o) => o.currentStageKey === "received")
      .length,
  };

  // Stage counts
  const stageCounts: Record<string, number> = {};
  for (const order of allOrders) {
    const key = order.currentStageKey || "unknown";
    stageCounts[key] = (stageCounts[key] || 0) + 1;
  }

  return { orders, stats, stageCounts };
}

export default async function DashboardPage() {
  let session;
  try {
    session = await verifyShopUser();
  } catch {
    redirect("/login");
  }

  // Get user display name from Firebase Auth
  let userDisplayName = session.email;
  try {
    const userRecord = await adminAuth.getUser(session.uid);
    userDisplayName = userRecord.displayName || session.email;
  } catch {
    // ignore
  }

  const { orders, stats, stageCounts } = await getDashboardData(session.shopId);

  const stageColors: Record<string, string> = {
    received: "bg-blue-100 text-blue-800",
    processing: "bg-yellow-100 text-yellow-800",
    printing: "bg-orange-100 text-orange-800",
    quality_check: "bg-purple-100 text-purple-800",
    shipped: "bg-green-100 text-green-800",
    delivered: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-red-100 text-red-800",
  };

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

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-sm font-medium text-gray-500">Total Orders</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {stats.totalOrders}
          </p>
          <p className="text-xs text-gray-400 mt-1">All time</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-medium text-gray-500">Total Revenue</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {formatCurrency(stats.totalRevenue)}
          </p>
          <p className="text-xs text-gray-400 mt-1">All time</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-medium text-gray-500">This Month</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {stats.ordersThisMonth}
          </p>
          <p className="text-xs text-gray-400 mt-1">Orders placed</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-medium text-gray-500">Pending</p>
          <p className="text-3xl font-bold text-indigo-600 mt-1">
            {stats.pendingOrders}
          </p>
          <p className="text-xs text-gray-400 mt-1">Awaiting processing</p>
        </Card>
      </div>

      {/* Orders by Stage */}
      {Object.keys(stageCounts).length > 0 && (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Orders by Stage
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(stageCounts).map(([key, count]) => (
              <Link
                key={key}
                href={`/orders?stage=${key}`}
                className="flex flex-col items-center p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
              >
                <span
                  className={`text-2xl font-bold ${
                    key === "received"
                      ? "text-blue-600"
                      : key === "shipped" || key === "delivered"
                        ? "text-green-600"
                        : "text-gray-700"
                  }`}
                >
                  {count}
                </span>
                <span className="text-xs text-gray-500 mt-1 capitalize">
                  {key.replace(/_/g, " ")}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Orders */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Recent Orders
          </h2>
          <Link
            href="/orders"
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            View all →
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12">
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
            <p className="text-gray-500 text-sm">No orders yet</p>
            {canCreateOrder && (
              <Link
                href="/orders/create"
                className="mt-3 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Create your first order →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((order) => (
                  <tr
                    key={order.orderId}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-3">
                      <Link
                        href={`/orders/${order.orderId}`}
                        className="text-indigo-600 hover:text-indigo-700 font-mono text-xs font-medium"
                      >
                        {order.orderId.substring(0, 8)}...
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-gray-900">
                      {order.customerName || "—"}
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      {order.sizeInInches}&quot;
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      {order.quantity}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          stageColors[order.currentStageKey] ||
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {order.currentStageKey?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-900 font-medium">
                      {formatCurrency(order.billingSnapshot?.total || 0)}
                    </td>
                    <td className="py-3 px-3 text-gray-500 text-xs">
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
