import { NextRequest } from "next/server";
import { verifyShopUser, handleAuthError } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import type { Order } from "@/models/types";

export async function GET(request: NextRequest) {
  try {
    const session = await verifyShopUser();

    const { searchParams } = new URL(request.url);
    const stage = searchParams.get("stage");
    const source = searchParams.get("source");
    const search = searchParams.get("search");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 25;

    let query = adminDb
      .collection("shops")
      .doc(session.shopId)
      .collection("orders")
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (stage) {
      query = adminDb
        .collection("shops")
        .doc(session.shopId)
        .collection("orders")
        .where("currentStageKey", "==", stage)
        .orderBy("createdAt", "desc")
        .limit(limit) as typeof query;
    } else if (source === "shopify" || source === "studio") {
      query = adminDb
        .collection("shops")
        .doc(session.shopId)
        .collection("orders")
        .where("source", "==", source)
        .orderBy("createdAt", "desc")
        .limit(limit) as typeof query;
    }

    const snap = await query.get();
    let orders = snap.docs.map((doc) => ({
      ...doc.data(),
      orderId: doc.id,
    })) as Order[];

    // Search filter (applied in-memory)
    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(
        (o) =>
          o.customerName?.toLowerCase().includes(q) ||
          o.customerEmail?.toLowerCase().includes(q) ||
          o.orderId?.toLowerCase().includes(q)
      );
    }

    const lastDoc = snap.docs[snap.docs.length - 1];

    return Response.json({
      orders,
      nextCursor: lastDoc ? lastDoc.id : null,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
