import { verifyShopUser, handleAuthError } from "@/lib/auth";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const session = await verifyShopUser();

    const [userRecord, shopDoc] = await Promise.all([
      adminAuth.getUser(session.uid).catch(() => null),
      adminDb.collection("shops").doc(session.shopId).get(),
    ]);

    return Response.json({
      user: {
        uid: session.uid,
        email: session.email,
        displayName: userRecord?.displayName || session.email,
        photoURL: userRecord?.photoURL,
      },
      shop: {
        shopId: session.shopId,
        displayName: session.shopDisplayName,
        shopType: shopDoc.data()?.shopType || "studio",
        role: session.role,
        isActive: shopDoc.data()?.isActive ?? true,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
