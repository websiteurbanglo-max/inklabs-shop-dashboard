import { NextRequest } from "next/server";
import { verifyShopUser, handleAuthError } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import type { Order, OrderEvent, Pipeline } from "@/models/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await verifyShopUser();
    const { orderId } = await params;

    // Fetch order
    const orderDoc = await adminDb
      .collection("shops")
      .doc(session.shopId)
      .collection("orders")
      .doc(orderId)
      .get();

    if (!orderDoc.exists) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    const order = { ...orderDoc.data(), orderId: orderDoc.id } as Order;

    // Defense in depth: verify order belongs to this shop
    if (order.shopId && order.shopId !== session.shopId) {
      return Response.json({ error: "Order not found" }, { status: 404 });
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

    return Response.json({ order, events, pipeline });
  } catch (error) {
    return handleAuthError(error);
  }
}
