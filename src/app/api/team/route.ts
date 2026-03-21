import { verifyShopUser, requireRole, handleAuthError } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import type { ShopMember } from "@/models/types";

export async function GET() {
  try {
    const session = await verifyShopUser();
    requireRole(session, "admin");

    const membersSnap = await adminDb
      .collection("shops")
      .doc(session.shopId)
      .collection("members")
      .get();

    const members = membersSnap.docs.map((doc) => ({
      ...doc.data(),
      uid: doc.id,
      shopId: session.shopId,
    })) as ShopMember[];

    return Response.json({ members });
  } catch (error) {
    return handleAuthError(error);
  }
}
