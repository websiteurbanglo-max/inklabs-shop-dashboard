import { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyShopUser } from "@/lib/auth";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import PageHeader from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { Shop, ShopMember } from "@/models/types";

export const metadata: Metadata = {
  title: "Profile — Inklabs Shop Dashboard",
};

export default async function ProfilePage() {
  let session;
  try {
    session = await verifyShopUser();
  } catch {
    redirect("/login");
  }

  // Fetch shop profile
  const shopDoc = await adminDb
    .collection("shops")
    .doc(session.shopId)
    .get();

  if (!shopDoc.exists) {
    redirect("/login");
  }

  const shop = { ...shopDoc.data(), shopId: shopDoc.id } as Shop;

  // Fetch member info
  const memberDoc = await adminDb
    .collection("shops")
    .doc(session.shopId)
    .collection("members")
    .doc(session.uid)
    .get();

  const member = memberDoc.exists
    ? ({ ...memberDoc.data(), uid: memberDoc.id, shopId: session.shopId } as ShopMember)
    : null;

  // Fetch Firebase Auth user info
  let userRecord: { displayName?: string; email?: string; photoURL?: string } = {};
  try {
    const record = await adminAuth.getUser(session.uid);
    userRecord = {
      displayName: record.displayName,
      email: record.email,
      photoURL: record.photoURL,
    };
  } catch {
    // ignore
  }

  const canEdit =
    session.role === "admin" || session.role === "owner";

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Profile"
        description="View your shop profile and account information"
      />

      {/* Shop Profile */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Shop Profile
          </h2>
          {!shop.isActive && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              Pending Activation
            </span>
          )}
        </div>

        <div className="flex items-start gap-4 mb-6">
          {shop.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shop.logoUrl}
              alt={shop.displayName}
              className="w-16 h-16 rounded-xl object-cover border border-gray-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-700">
              {shop.displayName?.charAt(0)?.toUpperCase() || "S"}
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {shop.displayName}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  shop.shopType === "shopify"
                    ? "bg-green-100 text-green-700"
                    : "bg-purple-100 text-purple-700"
                }`}
              >
                {shop.shopType === "shopify" ? "Shopify" : "Studio"}
              </span>
              <span className="text-sm text-gray-500">/{shop.slug}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Display Name
            </label>
            <p className="text-sm text-gray-900">{shop.displayName}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Slug
            </label>
            <p className="text-sm text-gray-900 font-mono">{shop.slug}</p>
          </div>
          {shop.contact?.email && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Contact Email
              </label>
              <p className="text-sm text-gray-900">{shop.contact.email}</p>
            </div>
          )}
          {shop.contact?.phone && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Phone
              </label>
              <p className="text-sm text-gray-900">{shop.contact.phone}</p>
            </div>
          )}
          {shop.contact?.address && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Address
              </label>
              <p className="text-sm text-gray-900">
                {[
                  shop.contact.address,
                  shop.contact.city,
                  shop.contact.state,
                  shop.contact.pincode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          )}
          {shop.metadata?.description && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Description
              </label>
              <p className="text-sm text-gray-900">
                {shop.metadata.description as string}
              </p>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              To update shop information, please contact the platform administrator.
            </p>
          </div>
        )}
      </Card>

      {/* Account Info */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Your Account
        </h2>
        <div className="flex items-center gap-4 mb-4">
          {userRecord.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={userRecord.photoURL}
              alt={userRecord.displayName || ""}
              className="w-12 h-12 rounded-full border border-gray-200"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-lg font-bold text-indigo-700">
              {(userRecord.displayName || session.email)
                ?.charAt(0)
                ?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900">
              {userRecord.displayName || "—"}
            </p>
            <p className="text-sm text-gray-500">{session.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Role
            </label>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                session.role === "owner"
                  ? "bg-purple-100 text-purple-700"
                  : session.role === "admin"
                    ? "bg-blue-100 text-blue-700"
                    : session.role === "operator"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
              }`}
            >
              {session.role}
            </span>
          </div>
          {member && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Member Since
              </label>
              <p className="text-sm text-gray-900">
                {formatDate(member.approvedAt || member.requestedAt)}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Actions */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="/select-shop"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
            Switch Shop
          </a>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign Out
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
