import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyShopUser, requireRole, handleAuthError } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import type { Shop } from "@/models/types";

export async function GET() {
  try {
    const session = await verifyShopUser();

    const shopDoc = await adminDb
      .collection("shops")
      .doc(session.shopId)
      .get();

    if (!shopDoc.exists) {
      return Response.json({ error: "Shop not found" }, { status: 404 });
    }

    const shop = { ...shopDoc.data(), shopId: shopDoc.id } as Shop;

    return Response.json({ shop });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await verifyShopUser();
    requireRole(session, "admin");

    const body = await request.json();
    const { displayName, contact, metadata } = body as {
      displayName?: string;
      contact?: Partial<Shop["contact"]>;
      metadata?: Partial<NonNullable<Shop["metadata"]>>;
    };

    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (displayName) updateData.displayName = displayName;
    if (contact) {
      // Merge contact fields
      Object.entries(contact).forEach(([key, value]) => {
        updateData[`contact.${key}`] = value;
      });
    }
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        updateData[`metadata.${key}`] = value;
      });
    }

    await adminDb
      .collection("shops")
      .doc(session.shopId)
      .update(updateData);

    const updatedDoc = await adminDb
      .collection("shops")
      .doc(session.shopId)
      .get();

    const shop = { ...updatedDoc.data(), shopId: updatedDoc.id } as Shop;

    return Response.json({ shop });
  } catch (error) {
    return handleAuthError(error);
  }
}
