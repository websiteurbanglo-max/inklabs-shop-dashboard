import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getShopSession, requireRole } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import PageHeader from "@/components/layout/page-header";
import OrderForm from "@/components/create-order/order-form";
import type { PlatformConfig } from "@/models/types";

export const metadata: Metadata = {
  title: "Create Order — Inklabs Shop Dashboard",
};

export default async function CreateOrderPage() {
  let session;
  try {
    session = await getShopSession();
    requireRole(session, "operator");
  } catch {
    redirect("/orders");
  }

  // Fetch platform config for variant groups
  let platformConfig: PlatformConfig = {
    defaultPipelineId: "default",
    variantGroups: [
      { key: "small", label: "Small (2-4 inch)", sizes: [2, 3, 4] },
      { key: "medium", label: "Medium (5-7 inch)", sizes: [5, 6, 7] },
      { key: "large", label: "Large (8-10 inch)", sizes: [8, 9, 10] },
    ],
  };

  try {
    const configDoc = await adminDb
      .collection("platform_config")
      .doc("settings")
      .get();
    if (configDoc.exists) {
      const data = configDoc.data();
      // Only extract serializable fields — Firestore Timestamps (updatedAt etc.)
      // cannot be passed as props to client components
      if (data?.variantGroups) {
        platformConfig.variantGroups = data.variantGroups;
      }
      if (data?.defaultPipelineId) {
        platformConfig.defaultPipelineId = data.defaultPipelineId;
      }
    }
  } catch {
    // Use defaults if fetch fails
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Order"
        description="Create a new custom studio order"
      />
      <OrderForm platformConfig={platformConfig} />
    </div>
  );
}
