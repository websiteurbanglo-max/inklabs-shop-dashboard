import { verifyShopUser, handleAuthError } from "@/lib/auth";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const session = await verifyShopUser();

    // Fetch user info from Firebase Auth
    let displayName: string | undefined;
    let photoURL: string | undefined;

    try {
      const userRecord = await adminAuth.getUser(session.uid);
      displayName = userRecord.displayName;
      photoURL = userRecord.photoURL;
    } catch {
      // ignore
    }

    // Fetch shop info
    const shopDoc = await adminDb
      .collection("shops")
      .doc(session.shopId)
      .get();

    const shopData = shopDoc.data();

    return Response.json({
      user: {
        uid: session.uid,
        email: session.email,
        displayName: displayName || session.email,
        photoURL,
      },
      shop: {
        shopId: session.shopId,
        displayName: session.shopDisplayName,
        shopType: shopData?.shopType || "studio",
        role: session.role,
        isActive: shopData?.isActive ?? true,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
