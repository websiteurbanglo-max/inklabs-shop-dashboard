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
    const today = searchParams.get("today") === "true";
    const cursor = searchParams.get("cursor");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(limitParam ? parseInt(limitParam, 10) : 25, 100);

    const ordersRef = adminDb
      .collection("shops")
      .doc(session.shopId)
      .collection("orders");

    // Resolve cursor document once (needed for startAfter)
    let cursorDoc: FirebaseFirestore.DocumentSnapshot | null = null;
    if (cursor) {
      cursorDoc = await ordersRef.doc(cursor).get();
    }

    // Build base query
    let query: FirebaseFirestore.Query = ordersRef
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (today) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      query = ordersRef
        .where("createdAt", ">=", startOfToday)
        .orderBy("createdAt", "desc")
        .limit(limit);
    } else if (stage) {
      query = ordersRef
        .where("currentStageKey", "==", stage)
        .orderBy("createdAt", "desc")
        .limit(limit);
    } else if (source === "shopify" || source === "studio") {
      query = ordersRef
        .where("source", "==", source)
        .orderBy("createdAt", "desc")
        .limit(limit);
    }

    if (cursorDoc?.exists) {
      query = query.startAfter(cursorDoc);
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

    // Only return cursor when there are likely more pages
    const hasMore = snap.docs.length >= limit;
    const nextCursor = hasMore ? snap.docs[snap.docs.length - 1].id : null;

    return Response.json({ orders, nextCursor });
  } catch (error) {
    return handleAuthError(error);
  }
}
