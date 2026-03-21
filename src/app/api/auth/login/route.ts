import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
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

    // Fallback path: avoid collection group dependency (e.g. missing index/setup).
    const shopsSnap = await adminDb.collection("shops").get();
    const docs = await Promise.all(
      shopsSnap.docs.map((shopDoc) =>
        shopDoc.ref.collection("members").doc(uid).get()
      )
    );
    return docs.filter((doc) => doc.exists);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken, shopId } = body as {
      idToken?: string;
      shopId?: string;
    };

    if (!idToken) {
      return Response.json({ error: "idToken is required" }, { status: 400 });
    }

    // Step 1: Verify the Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return Response.json({ error: "Invalid ID token" }, { status: 401 });
    }

    const uid = decodedToken.uid;

    // Step 2: Query all memberships for this UID
    const memberDocs = await getMembershipDocsForUser(uid);

    // Step 3: Build membership list with shop info
    const memberships: ShopMembership[] = [];
    for (const doc of memberDocs) {
      const data = doc.data();
      if (!data) continue;
      // doc.ref.parent.parent is the shop document
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

    // Step 4: Determine redirect path
    const activeMemberships = memberships.filter((m) => m.status === "active");
    const pendingMemberships = memberships.filter((m) => m.status === "pending");

    let redirect = "/onboarding";

    if (activeMemberships.length === 0 && pendingMemberships.length === 0) {
      redirect = "/onboarding";
    } else if (activeMemberships.length === 0 && pendingMemberships.length > 0) {
      redirect = "/pending";
    } else if (activeMemberships.length === 1) {
      redirect = "/dashboard";
    } else if (activeMemberships.length > 1 && shopId) {
      redirect = "/dashboard";
    } else if (activeMemberships.length > 1) {
      redirect = "/select-shop";
    }

    // Step 5: Create session cookie
    const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    });

    const cookieStore = await cookies();

    cookieStore.set("__session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expiresIn / 1000,
      path: "/",
    });

    // Step 6: Set shop context if we have exactly one active shop, or a specific shopId was chosen
    let selectedShopId: string | null = null;
    let selectedMembership: ShopMembership | null = null;

    if (activeMemberships.length === 1) {
      selectedShopId = activeMemberships[0].shopId;
      selectedMembership = activeMemberships[0];
    } else if (shopId && activeMemberships.find((m) => m.shopId === shopId)) {
      selectedShopId = shopId;
      selectedMembership = activeMemberships.find((m) => m.shopId === shopId)!;
    }

    if (selectedShopId && selectedMembership) {
      // Fetch the member's actual role from Firestore
      const memberDoc = await adminDb
        .collection("shops")
        .doc(selectedShopId)
        .collection("members")
        .doc(uid)
        .get();

      const role = memberDoc.data()?.role || selectedMembership.role;

      cookieStore.set(
        "__shop_context",
        JSON.stringify({
          shopId: selectedShopId,
          role,
          shopDisplayName: selectedMembership.shopName,
        }),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: expiresIn / 1000,
          path: "/",
        }
      );
    } else if (redirect === "/select-shop" || redirect === "/pending") {
      // Clear any stale shop context
      cookieStore.delete("__shop_context");
    }

    return Response.json({
      success: true,
      redirect,
      memberships,
    });
  } catch (error) {
    console.error("Login error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
