import { adminDb } from "@/lib/firebase-admin";
import type { ShopMember } from "./types";

export async function getShopMembers(shopId: string): Promise<ShopMember[]> {
  const snap = await adminDb
    .collection("shops")
    .doc(shopId)
    .collection("members")
    .get();

  return snap.docs.map((doc) => ({
    ...doc.data(),
    uid: doc.id,
    shopId,
  })) as ShopMember[];
}

export async function getMember(
  shopId: string,
  uid: string
): Promise<ShopMember | null> {
  const doc = await adminDb
    .collection("shops")
    .doc(shopId)
    .collection("members")
    .doc(uid)
    .get();

  if (!doc.exists) return null;
  return { ...doc.data(), uid: doc.id, shopId } as ShopMember;
}
