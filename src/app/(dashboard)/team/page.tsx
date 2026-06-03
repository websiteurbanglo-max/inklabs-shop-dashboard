"use client";

import { useEffect } from "react";
import { useTeam } from "@/hooks/use-team";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/utils";
import PageHeader from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const roleColors: Record<string, string> = {
  owner: "bg-purple-50 text-purple-600 border-purple-200/60",
  admin: "bg-blue-50 text-blue-600 border-blue-200/60",
  operator: "bg-emerald-50 text-emerald-600 border-emerald-200/60",
  viewer: "bg-gray-50 text-gray-500 border-gray-200/60",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-600 border-emerald-200/60",
  pending: "bg-amber-50 text-amber-600 border-amber-200/60",
  suspended: "bg-red-50 text-red-600 border-red-200/60",
};

function TeamSkeleton() {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function TeamPage() {
  const { user } = useAuth();
  const { members, isLoading } = useTeam();

  useEffect(() => {
    document.title = "Team — Inklabs";
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description={isLoading ? "Loading…" : `${members.length} member${members.length !== 1 ? "s" : ""} in your shop`}
      />

      <Card className="p-4 bg-amber-50/60 border-amber-100/80">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-amber-800 pt-1.5">To add or manage team members, contact the platform administrator.</p>
        </div>
      </Card>

      {isLoading ? (
        <TeamSkeleton />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-100/80">
                <tr>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Member</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {members.map((member) => (
                  <tr key={member.uid} className={`transition-colors ${member.uid === user?.uid ? "bg-indigo-50/40" : "hover:bg-gray-50/60"}`}>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {member.photoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.photoURL} alt={member.displayName || ""} className="w-9 h-9 rounded-xl border border-gray-100 object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-700">
                            {(member.displayName || member.email || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <p className="font-medium text-gray-900">
                          {member.displayName || "Unknown"}
                          {member.uid === user?.uid && (
                            <span className="ml-1.5 text-[10px] text-indigo-500 font-semibold px-1.5 py-px rounded-md bg-indigo-50 border border-indigo-200/40">you</span>
                          )}
                        </p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">{member.email}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium capitalize border ${roleColors[member.role] ?? "bg-gray-50 text-gray-500 border-gray-200/60"}`}>
                        {member.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium capitalize border ${statusColors[member.status] ?? "bg-gray-50 text-gray-500 border-gray-200/60"}`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-400 text-xs">{formatDate(member.approvedAt || member.requestedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
