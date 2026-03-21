import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifySessionOnly, handleAuthError } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const user = await verifySessionOnly();

    const body = await request.json();
    const { shopId } = body as { shopId: string };

    if (!shopId) {
      return Response.json({ error: "shopId is required" }, { status: 400 });
    }

    // Verify shop exists
    const shopDoc = await adminDb.collection("shops").doc(shopId).get();
    if (!shopDoc.exists) {
      return Response.json({ error: "Shop not found" }, { status: 404 });
    }

    // Check if user already has a membership for this shop
    const existingMember = await adminDb
      .collection("shops")
      .doc(shopId)
      .collection("members")
      .doc(user.uid)
      .get();

    if (existingMember.exists) {
      const existingStatus = existingMember.data()?.status;
      if (existingStatus === "active") {
        return Response.json(
          {
            error: "You already have active membership in this shop.",
            membership: { ...existingMember.data(), uid: existingMember.id },
          },
          { status: 409 }
        );
      }
      if (existingStatus === "pending") {
        return Response.json(
          {
            error: "You already have a pending request for this shop.",
            membership: { ...existingMember.data(), uid: existingMember.id },
          },
          { status: 409 }
        );
      }
    }

    const now = FieldValue.serverTimestamp();

    // Create membership doc
    const memberRef = adminDb
      .collection("shops")
      .doc(shopId)
      .collection("members")
      .doc(user.uid);

    await memberRef.set({
      uid: user.uid,
      shopId,
      email: user.email,
      displayName: user.name || user.email,
      photoURL: user.picture || null,
      role: "viewer",
      status: "pending",
      requestedAt: now,
    });

    const memberDoc = await memberRef.get();

    return Response.json(
      {
        membership: { ...memberDoc.data(), uid: memberDoc.id },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function GET(request: NextRequest) {
  // Lookup shop by slug/domain for the onboarding form
  try {
    await verifySessionOnly();

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return Response.json({ error: "slug is required" }, { status: 400 });
    }

    const shopDoc = await adminDb.collection("shops").doc(slug).get();
    if (!shopDoc.exists) {
      return Response.json({ error: "Shop not found" }, { status: 404 });
    }

    const data = shopDoc.data()!;
    return Response.json({
      shop: {
        shopId: shopDoc.id,
        displayName: data.displayName,
        shopType: data.shopType,
        slug: data.slug || shopDoc.id,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
