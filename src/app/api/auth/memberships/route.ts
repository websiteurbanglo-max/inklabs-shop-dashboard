import { verifySessionOnly, handleAuthError } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import type { ShopMembership } from "@/models/types";

async function getMembershipDocsForUser(uid: string) {
  try {
    const membershipsSnap = await adminDb
      .collectionGroup("members")
      .where("uid", "==", uid)
      .get();
    return membershipsSnap.docs;
  } catch (error) {
    const code = (error as { code?: number | string })?.code;
    const isPreconditionError = code === 9 || code === "failed-precondition";

    if (!isPreconditionError) {
      throw error;
    }

    // Fallback when collectionGroup index is missing.
    const shopsSnap = await adminDb.collection("shops").get();
    const docs = await Promise.all(
      shopsSnap.docs.map((shopDoc) => shopDoc.ref.collection("members").doc(uid).get())
    );
    return docs.filter((doc) => doc.exists);
  }
}

export async function GET() {
  try {
    // Only verify session cookie — user might not have a shop yet
    const user = await verifySessionOnly();

    const membershipDocs = await getMembershipDocsForUser(user.uid);

    const memberships: ShopMembership[] = [];

    for (const doc of membershipDocs) {
      const data = doc.data();
      if (!data) continue;
      const shopRef = doc.ref.parent.parent;
      if (!shopRef) continue;

      let shopName = shopRef.id;
      let shopType: "shopify" | "studio" = "studio";
      let logoUrl: string | undefined;

      try {
        const shopDoc = await shopRef.get();
        if (shopDoc.exists) {
          shopName = shopDoc.data()?.displayName || shopRef.id;
          shopType = shopDoc.data()?.shopType || "studio";
          logoUrl = shopDoc.data()?.logoUrl;
        }
      } catch {
        // ignore
      }

      memberships.push({
        shopId: shopRef.id,
        shopName,
        shopType,
        logoUrl,
        role: data.role,
        status: data.status,
        requestedAt: data.requestedAt?.toDate?.()?.toISOString(),
      });
    }

    return Response.json({ memberships });
  } catch (error) {
    return handleAuthError(error);
  }
}
