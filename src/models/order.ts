import { adminDb } from "@/lib/firebase-admin";
import type { Order, OrderEvent } from "./types";

export interface GetShopOrdersOptions {
  stage?: string;
  source?: string;
  limit?: number;
  startAfter?: string;
}

export async function getShopOrders(
  shopId: string,
  options: GetShopOrdersOptions = {}
): Promise<{ orders: Order[]; nextCursor: string | null }> {
  const limit = options.limit || 25;

  let query = adminDb
    .collection("shops")
    .doc(shopId)
    .collection("orders")
    .orderBy("createdAt", "desc")
    .limit(limit);

  if (options.stage) {
    query = adminDb
      .collection("shops")
      .doc(shopId)
      .collection("orders")
      .where("currentStageKey", "==", options.stage)
      .orderBy("createdAt", "desc")
      .limit(limit) as typeof query;
  }

  if (options.startAfter) {
    const startDoc = await adminDb
      .collection("shops")
      .doc(shopId)
      .collection("orders")
      .doc(options.startAfter)
      .get();
    if (startDoc.exists) {
      query = query.startAfter(startDoc) as typeof query;
    }
  }

  const snap = await query.get();
  const orders = snap.docs.map((doc) => ({
    ...doc.data(),
    orderId: doc.id,
  })) as Order[];

  const lastDoc = snap.docs[snap.docs.length - 1];
  const nextCursor = snap.docs.length === limit && lastDoc ? lastDoc.id : null;

  return { orders, nextCursor };
}

export async function getOrder(
  shopId: string,
  orderId: string
): Promise<Order | null> {
  const doc = await adminDb
    .collection("shops")
    .doc(shopId)
    .collection("orders")
    .doc(orderId)
    .get();

  if (!doc.exists) return null;
  return { ...doc.data(), orderId: doc.id } as Order;
}

export async function getOrderEvents(
  shopId: string,
  orderId: string
): Promise<OrderEvent[]> {
  const snap = await adminDb
    .collection("shops")
    .doc(shopId)
    .collection("orders")
    .doc(orderId)
    .collection("events")
    .orderBy("timestamp", "desc")
    .get();

  return snap.docs.map((doc) => ({
    ...doc.data(),
    eventId: doc.id,
  })) as OrderEvent[];
}
