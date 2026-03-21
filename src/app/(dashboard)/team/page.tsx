import { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyShopUser, requireRole } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import PageHeader from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { ShopMember } from "@/models/types";

export const metadata: Metadata = {
  title: "Team — Inklabs Shop Dashboard",
};

const roleColors: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  operator: "bg-green-100 text-green-700",
  viewer: "bg-gray-100 text-gray-700",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-yellow-100 text-yellow-700",
  suspended: "bg-red-100 text-red-700",
};

export default async function TeamPage() {
  let session;
  try {
    session = await verifyShopUser();
    requireRole(session, "admin");
  } catch {
    redirect("/dashboard");
  }

  const membersSnap = await adminDb
    .collection("shops")
    .doc(session.shopId)
    .collection("members")
    .get();

  const members = membersSnap.docs.map((doc) => ({
    ...doc.data(),
    uid: doc.id,
    shopId: session.shopId,
  })) as ShopMember[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description={`${members.length} member${members.length !== 1 ? "s" : ""} in your shop`}
      />

      <Card className="p-4 bg-amber-50 border-amber-100">
        <div className="flex gap-3">
          <svg
            className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-amber-800">
            To add or manage team members, contact the platform administrator.
          </p>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map((member) => (
                <tr
                  key={member.uid}
                  className={`transition-colors ${
                    member.uid === session.uid ? "bg-indigo-50" : "hover:bg-gray-50"
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {member.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.photoURL}
                          alt={member.displayName || ""}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                          {(member.displayName || member.email || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          {member.displayName || "Unknown"}
                          {member.uid === session.uid && (
                            <span className="ml-1 text-xs text-indigo-600">
                              (you)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{member.email}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        roleColors[member.role] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {member.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        statusColors[member.status] ||
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {member.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {formatDate(member.approvedAt || member.requestedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
