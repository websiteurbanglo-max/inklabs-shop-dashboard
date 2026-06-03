import { getShopSession, handleAuthError } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import type { Order } from "@/models/types";

export async function GET() {
  try {
    const session = await getShopSession();

    const ordersRef = adminDb
      .collection("shops")
      .doc(session.shopId)
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

    const recentOrders = recentSnap.docs.map((doc) => ({
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

    return Response.json({ stats, recentOrders, stageCounts });
  } catch (error) {
    return handleAuthError(error);
  }
}
