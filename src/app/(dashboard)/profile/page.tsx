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

const roleColors: Record<string, string> = {
  owner: "bg-purple-50 text-purple-600 border-purple-200/60",
  admin: "bg-blue-50 text-blue-600 border-blue-200/60",
  operator: "bg-emerald-50 text-emerald-600 border-emerald-200/60",
  viewer: "bg-gray-50 text-gray-500 border-gray-200/60",
};

export default async function ProfilePage() {
  let session;
  try {
    session = await verifyShopUser();
  } catch {
    redirect("/login");
  }

  const shopDoc = await adminDb
    .collection("shops")
    .doc(session.shopId)
    .get();

  if (!shopDoc.exists) {
    redirect("/login");
  }

  const shop = { ...shopDoc.data(), shopId: shopDoc.id } as Shop;

  const memberDoc = await adminDb
    .collection("shops")
    .doc(session.shopId)
    .collection("members")
    .doc(session.uid)
    .get();

  const member = memberDoc.exists
    ? ({ ...memberDoc.data(), uid: memberDoc.id, shopId: session.shopId } as ShopMember)
    : null;

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
      <Card className="p-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <div className="flex items-start justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-900 tracking-tight">
            Shop Profile
          </h2>
          {!shop.isActive && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-50 text-amber-600 border border-amber-200/60">
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
              className="w-16 h-16 rounded-2xl object-cover border border-gray-100 shadow-sm"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center text-2xl font-bold text-indigo-700 shadow-sm">
              {shop.displayName?.charAt(0)?.toUpperCase() || "S"}
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold text-gray-900 tracking-tight">
              {shop.displayName}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border ${
                  shop.shopType === "shopify"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200/60"
                    : "bg-purple-50 text-purple-600 border-purple-200/60"
                }`}
              >
                {shop.shopType === "shopify" ? "Shopify" : "Studio"}
              </span>
              <span className="text-sm text-gray-400 font-mono">/{shop.slug}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Display Name
            </label>
            <p className="text-sm text-gray-900">{shop.displayName}</p>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Slug
            </label>
            <p className="text-sm text-gray-900 font-mono">{shop.slug}</p>
          </div>
          {shop.contact?.email && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Contact Email
              </label>
              <p className="text-sm text-gray-900">{shop.contact.email}</p>
            </div>
          )}
          {shop.contact?.phone && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Phone
              </label>
              <p className="text-sm text-gray-900">{shop.contact.phone}</p>
            </div>
          )}
          {shop.contact?.address && (
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
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
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Description
              </label>
              <p className="text-sm text-gray-900 leading-relaxed">
                {shop.metadata.description as string}
              </p>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-[11px] text-gray-300">
              To update shop information, please contact the platform administrator.
            </p>
          </div>
        )}
      </Card>

      {/* Account Info */}
      <Card className="p-6 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <h2 className="text-sm font-semibold text-gray-900 mb-5 tracking-tight">
          Your Account
        </h2>
        <div className="flex items-center gap-4 mb-5">
          {userRecord.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={userRecord.photoURL}
              alt={userRecord.displayName || ""}
              className="w-14 h-14 rounded-2xl border border-gray-100 shadow-sm object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center text-xl font-bold text-indigo-700 shadow-sm">
              {(userRecord.displayName || session.email)
                ?.charAt(0)
                ?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900 tracking-tight text-lg">
              {userRecord.displayName || "—"}
            </p>
            <p className="text-sm text-gray-400">{session.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Role
            </label>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium capitalize border ${
                roleColors[session.role] || "bg-gray-50 text-gray-500 border-gray-200/60"
              }`}
            >
              {session.role}
            </span>
          </div>
          {member && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
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
      <Card className="p-6 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
        <h2 className="text-sm font-semibold text-gray-900 mb-4 tracking-tight">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="/select-shop"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 text-sm font-medium active:scale-[0.97]"
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
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 text-red-600 rounded-xl hover:bg-red-100 hover:border-red-200 transition-all duration-200 text-sm font-medium active:scale-[0.97]"
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
