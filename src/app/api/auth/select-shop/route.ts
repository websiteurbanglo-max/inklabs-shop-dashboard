import { NextRequest } from "next/server";
import { cookies } from "next/headers";
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

    // Verify the user has an active membership for this shop
    const memberDoc = await adminDb
      .collection("shops")
      .doc(shopId)
      .collection("members")
      .doc(user.uid)
      .get();

    if (!memberDoc.exists || memberDoc.data()?.status !== "active") {
      return Response.json(
        { error: "You do not have active access to this shop" },
        { status: 403 }
      );
    }

    // Get shop info
    const shopDoc = await adminDb.collection("shops").doc(shopId).get();
    if (!shopDoc.exists) {
      return Response.json({ error: "Shop not found" }, { status: 404 });
    }

    const shopDisplayName = shopDoc.data()?.displayName || shopId;
    const role = memberDoc.data()!.role;

    // Update shop context cookie
    const cookieStore = await cookies();
    const expiresIn = 60 * 60 * 24 * 14; // 14 days in seconds

    cookieStore.set(
      "__shop_context",
      JSON.stringify({
        shopId,
        role,
        shopDisplayName,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: expiresIn,
        path: "/",
      }
    );

    return Response.json({ success: true, redirect: "/dashboard" });
  } catch (error) {
    return handleAuthError(error);
  }
}
