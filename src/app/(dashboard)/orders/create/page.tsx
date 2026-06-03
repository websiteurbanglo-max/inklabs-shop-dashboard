"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePlatformConfig } from "@/hooks/use-platform-config";
import PageHeader from "@/components/layout/page-header";
import OrderForm from "@/components/create-order/order-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const OPERATOR_ROLES = new Set(["operator", "admin", "owner"]);

function CreateOrderSkeleton() {
  return (
    <div className="max-w-2xl space-y-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-24 w-full" />
        </Card>
      ))}
    </div>
  );
}

export default function CreateOrderPage() {
  const { shop, isLoading: authLoading } = useAuth();
  const { variantGroups, defaultPipelineId, isLoading: configLoading } = usePlatformConfig();

  useEffect(() => {
    document.title = "Create Order — Inklabs";
  }, []);

  const isLoading = authLoading || configLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Create Order" description="Create a new custom studio order" />
        <CreateOrderSkeleton />
      </div>
    );
  }

  if (!shop || !OPERATOR_ROLES.has(shop.role)) {
    return (
      <div className="text-center py-24">
        <p className="text-gray-500 text-sm">You don&apos;t have permission to create orders.</p>
      </div>
    );
  }

  const platformConfig = { variantGroups, defaultPipelineId };

  return (
    <div className="space-y-6">
      <PageHeader title="Create Order" description="Create a new custom studio order" />
      <OrderForm platformConfig={platformConfig} />
    </div>
  );
}
