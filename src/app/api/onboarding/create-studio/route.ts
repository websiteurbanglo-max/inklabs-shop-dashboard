import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifySessionOnly, handleAuthError } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { isValidSlug } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const user = await verifySessionOnly();

    const body = await request.json();
    const { name, slug, email, phone, description } = body as {
      name: string;
      slug: string;
      email: string;
      phone?: string;
      description?: string;
    };

    // Validate required fields
    if (!name || !slug || !email) {
      return Response.json(
        { error: "name, slug, and email are required" },
        { status: 400 }
      );
    }

    // Validate slug format
    if (!isValidSlug(slug)) {
      return Response.json(
        {
          error:
            "Invalid slug. Must be 3-30 characters, lowercase alphanumeric and hyphens only.",
        },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existingShop = await adminDb.collection("shops").doc(slug).get();
    if (existingShop.exists) {
      return Response.json(
        { error: "This slug is already taken. Please choose a different one." },
        { status: 409 }
      );
    }

    const now = FieldValue.serverTimestamp();

    // Batch write: shop + membership
    const batch = adminDb.batch();

    const shopRef = adminDb.collection("shops").doc(slug);
    batch.set(shopRef, {
      shopId: slug,
      shopType: "studio",
      displayName: name,
      slug,
      isActive: false, // awaiting superadmin activation
      contact: {
        email,
        ...(phone ? { phone } : {}),
      },
      metadata: {
        ...(description ? { description } : {}),
      },
      createdAt: now,
      updatedAt: now,
    });

    const memberRef = shopRef.collection("members").doc(user.uid);
    batch.set(memberRef, {
      uid: user.uid,
      shopId: slug,
      email: user.email,
      displayName: user.name || user.email,
      photoURL: user.picture || null,
      role: "owner",
      status: "pending",
      requestedAt: now,
    });

    await batch.commit();

    // Fetch the created documents to return
    const shopDoc = await shopRef.get();
    const memberDoc = await memberRef.get();

    return Response.json(
      {
        shop: { ...shopDoc.data(), shopId: shopDoc.id },
        membership: { ...memberDoc.data(), uid: memberDoc.id },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleAuthError(error);
  }
}
