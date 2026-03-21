import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import type { MemberRole } from "@/models/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const shopContextRaw = cookieStore.get("__shop_context")?.value;

  if (!shopContextRaw) {
    redirect("/login");
  }

  let shopContext: {
    shopId: string;
    role: MemberRole;
    shopDisplayName: string;
  };

  try {
    shopContext = JSON.parse(shopContextRaw);
  } catch {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-[#f8f9fb] overflow-hidden">
      {/* Sidebar */}
      <Sidebar role={shopContext.role} />

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <Topbar
          shopDisplayName={shopContext.shopDisplayName}
          shopId={shopContext.shopId}
          role={shopContext.role}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
