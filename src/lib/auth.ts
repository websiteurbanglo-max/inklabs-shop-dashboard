import { cookies } from "next/headers";
import { adminAuth, adminDb } from "./firebase-admin";
import type { ShopSession } from "@/models/types";

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function verifyShopUser(): Promise<ShopSession> {
  const cookieStore = await cookies();

  // 1. Verify Firebase session cookie
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) {
    throw new AuthError("Not authenticated", 401);
  }

  let decoded;
  try {
    decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    throw new AuthError("Invalid or expired session", 401);
  }

  // 2. Read shop context
  const shopContextRaw = cookieStore.get("__shop_context")?.value;
  if (!shopContextRaw) {
    throw new AuthError("No shop selected", 401);
  }

  let shopContext: { shopId: string; role: string; shopDisplayName: string };
  try {
    shopContext = JSON.parse(shopContextRaw);
  } catch {
    throw new AuthError("Invalid shop context", 401);
  }

  const { shopId, shopDisplayName } = shopContext;

  // 3. Verify membership is still active (re-check on every request)
  const memberDoc = await adminDb
    .collection("shops")
    .doc(shopId)
    .collection("members")
    .doc(decoded.uid)
    .get();

  if (!memberDoc.exists || memberDoc.data()?.status !== "active") {
    throw new AuthError("Membership is not active", 403);
  }

  const memberData = memberDoc.data()!;

  return {
    uid: decoded.uid,
    email: decoded.email!,
    shopId,
    role: memberData.role as ShopSession["role"],
    shopDisplayName,
  };
}

const roleHierarchy: Record<ShopSession["role"], number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
  owner: 3,
};

export function requireRole(
  session: ShopSession,
  minRole: ShopSession["role"]
): void {
  if (roleHierarchy[session.role] < roleHierarchy[minRole]) {
    throw new AuthError(
      `Requires ${minRole} role or higher. Current role: ${session.role}`,
      403
    );
  }
}

export async function verifySessionOnly(): Promise<{
  uid: string;
  email: string;
  name?: string;
  picture?: string;
}> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;

  if (!sessionCookie) {
    throw new AuthError("Not authenticated", 401);
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return {
      uid: decoded.uid,
      email: decoded.email!,
      name: decoded.name,
      picture: decoded.picture,
    };
  } catch {
    throw new AuthError("Invalid or expired session", 401);
  }
}

export function handleAuthError(error: unknown): Response {
  if (error instanceof AuthError) {
    return Response.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }
  console.error("Unexpected auth error:", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
