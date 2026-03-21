import { adminDb } from "@/lib/firebase-admin";
import type { Shop } from "./types";

export async function getShop(shopId: string): Promise<Shop | null> {
  const doc = await adminDb.collection("shops").doc(shopId).get();
  if (!doc.exists) return null;
  return { ...doc.data(), shopId: doc.id } as Shop;
}

export async function updateShop(
  shopId: string,
  data: Partial<Shop>
): Promise<Shop> {
  const { FieldValue } = await import("firebase-admin/firestore");
  await adminDb
    .collection("shops")
    .doc(shopId)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });

  const doc = await adminDb.collection("shops").doc(shopId).get();
  return { ...doc.data(), shopId: doc.id } as Shop;
}
