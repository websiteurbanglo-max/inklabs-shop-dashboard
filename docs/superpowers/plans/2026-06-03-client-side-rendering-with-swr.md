# Client-Side Rendering with SWR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert all dashboard pages from blocking Server Components to client-side SWR-powered components so navigation is instant (no server round-trip), data loads asynchronously behind skeletons, and pages are never blank during transitions.

**Architecture:** Each page becomes a `"use client"` component that calls a dedicated SWR hook. The hooks fetch from existing API routes (with a few additions). The dashboard layout stays a Server Component (reads cookies — already fast). SWR's global cache means navigating back to a page you've already visited renders instantly from cache while revalidating in the background.

**Tech Stack:** Next.js 15 App Router, SWR v2 (`swr/infinite` for paginated orders), Firebase Admin SDK (server side only), TypeScript, Tailwind CSS

---

## File Map

### New files to create
| File | Purpose |
|------|---------|
| `src/app/api/dashboard/route.ts` | Dashboard stats (counts + recent 10 orders) in one request |
| `src/app/api/platform-config/route.ts` | Variant groups + default pipeline ID |
| `src/hooks/use-dashboard.ts` | SWR hook wrapping `/api/dashboard` |
| `src/hooks/use-team.ts` | SWR hook wrapping `/api/team` |
| `src/hooks/use-profile.ts` | SWR hook wrapping `/api/profile` |
| `src/hooks/use-platform-config.ts` | SWR hook wrapping `/api/platform-config` |

### Files to modify
| File | Change |
|------|--------|
| `src/app/api/orders/route.ts` | Add `cursor` param (startAfter pagination) + `today` date filter; fix `nextCursor` to return `null` when last page |
| `src/hooks/use-orders.ts` | Replace `useSWR` with `useSWRInfinite` for load-more; add `today` filter |
| `src/app/(dashboard)/dashboard/page.tsx` | `"use client"`, use `useDashboard` + `useAuth` hooks |
| `src/app/(dashboard)/orders/page.tsx` | `"use client"`, use `useOrders` (infinite), add Today/Load More UI |
| `src/app/(dashboard)/orders/[orderId]/page.tsx` | `"use client"`, use existing `useOrder` hook |
| `src/app/(dashboard)/orders/create/page.tsx` | `"use client"`, use `usePlatformConfig` hook |
| `src/app/(dashboard)/team/page.tsx` | `"use client"`, use `useTeam` hook |
| `src/app/(dashboard)/profile/page.tsx` | `"use client"`, use `useAuth` + `useProfile` hooks |
| `src/app/(dashboard)/pricing/page.tsx` | `"use client"`, use existing `usePricing` hook |

---

## Task 1: Update `/api/orders` — cursor pagination + today filter

**Files:**
- Modify: `src/app/api/orders/route.ts`

- [ ] **Step 1: Replace the route with cursor + today support**

```typescript
// src/app/api/orders/route.ts
import { NextRequest } from "next/server";
import { verifyShopUser, handleAuthError } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import type { Order } from "@/models/types";

export async function GET(request: NextRequest) {
  try {
    const session = await verifyShopUser();

    const { searchParams } = new URL(request.url);
    const stage = searchParams.get("stage");
    const source = searchParams.get("source");
    const search = searchParams.get("search");
    const today = searchParams.get("today") === "true";
    const cursor = searchParams.get("cursor");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(limitParam ? parseInt(limitParam, 10) : 25, 100);

    const ordersRef = adminDb
      .collection("shops")
      .doc(session.shopId)
      .collection("orders");

    // Resolve cursor document once (needed for startAfter)
    let cursorDoc: FirebaseFirestore.DocumentSnapshot | null = null;
    if (cursor) {
      cursorDoc = await ordersRef.doc(cursor).get();
    }

    // Build base query
    let query: FirebaseFirestore.Query = ordersRef
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (today) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      query = ordersRef
        .where("createdAt", ">=", startOfToday)
        .orderBy("createdAt", "desc")
        .limit(limit);
    } else if (stage) {
      query = ordersRef
        .where("currentStageKey", "==", stage)
        .orderBy("createdAt", "desc")
        .limit(limit);
    } else if (source === "shopify" || source === "studio") {
      query = ordersRef
        .where("source", "==", source)
        .orderBy("createdAt", "desc")
        .limit(limit);
    }

    if (cursorDoc?.exists) {
      query = query.startAfter(cursorDoc);
    }

    const snap = await query.get();
    let orders = snap.docs.map((doc) => ({
      ...doc.data(),
      orderId: doc.id,
    })) as Order[];

    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(
        (o) =>
          o.customerName?.toLowerCase().includes(q) ||
          o.customerEmail?.toLowerCase().includes(q) ||
          o.orderId?.toLowerCase().includes(q)
      );
    }

    // Only return cursor when there are likely more pages
    const hasMore = snap.docs.length >= limit;
    const nextCursor = hasMore ? snap.docs[snap.docs.length - 1].id : null;

    return Response.json({ orders, nextCursor });
  } catch (error) {
    return handleAuthError(error);
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd shop-dashboard && npx tsc --noEmit
```

Expected: no errors

---

## Task 2: Create `/api/dashboard` endpoint

**Files:**
- Create: `src/app/api/dashboard/route.ts`

- [ ] **Step 1: Create the endpoint**

```typescript
// src/app/api/dashboard/route.ts
import { getShopSession, handleAuthError } from "@/lib/auth";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import type { Order } from "@/models/types";

export async function GET() {
  try {
    const session = await getShopSession();

    const ordersRef = adminDb
      .collection("shops")
      .doc(session.shopId)
      .collection("orders");

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      recentSnap,
      statsSnap,
      totalCountSnap,
      monthCountSnap,
      pendingCountSnap,
    ] = await Promise.all([
      ordersRef.orderBy("createdAt", "desc").limit(10).get(),
      ordersRef.orderBy("createdAt", "desc").limit(200).get(),
      ordersRef.count().get(),
      ordersRef.where("createdAt", ">=", startOfMonth).count().get(),
      ordersRef.where("currentStageKey", "==", "received").count().get(),
    ]);

    const recentOrders = recentSnap.docs.map((doc) => ({
      ...doc.data(),
      orderId: doc.id,
    })) as Order[];

    const statsOrders = statsSnap.docs.map((d) => d.data() as Order);

    const stats = {
      totalOrders: totalCountSnap.data().count,
      totalRevenue: statsOrders.reduce(
        (sum, o) => sum + (o.billingSnapshot?.total || 0),
        0
      ),
      ordersThisMonth: monthCountSnap.data().count,
      pendingOrders: pendingCountSnap.data().count,
    };

    const stageCounts: Record<string, number> = {};
    for (const order of statsOrders) {
      const key = order.currentStageKey || "unknown";
      stageCounts[key] = (stageCounts[key] || 0) + 1;
    }

    return Response.json({ stats, recentOrders, stageCounts });
  } catch (error) {
    return handleAuthError(error);
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

---

## Task 3: Create `/api/platform-config` endpoint

**Files:**
- Create: `src/app/api/platform-config/route.ts`

- [ ] **Step 1: Create the endpoint**

```typescript
// src/app/api/platform-config/route.ts
import { getShopSession, handleAuthError } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import type { VariantGroupDef } from "@/models/types";

const DEFAULT_VARIANT_GROUPS: VariantGroupDef[] = [
  { key: "small", label: "Small (2-4 inch)", sizes: [2, 3, 4] },
  { key: "medium", label: "Medium (5-7 inch)", sizes: [5, 6, 7] },
  { key: "large", label: "Large (8-10 inch)", sizes: [8, 9, 10] },
];

export async function GET() {
  try {
    await getShopSession(); // auth check only

    const configDoc = await adminDb
      .collection("platform_config")
      .doc("settings")
      .get();

    const data = configDoc.exists ? configDoc.data() : null;

    return Response.json({
      variantGroups: data?.variantGroups ?? DEFAULT_VARIANT_GROUPS,
      defaultPipelineId: data?.defaultPipelineId ?? "default",
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

---

## Task 4: Update `use-orders.ts` — `useSWRInfinite` for load-more + today filter

**Files:**
- Modify: `src/hooks/use-orders.ts`

- [ ] **Step 1: Replace the hook**

```typescript
// src/hooks/use-orders.ts
"use client";

import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import type { Order, OrderEvent, Pipeline } from "@/models/types";

interface OrdersPage {
  orders: Order[];
  nextCursor: string | null;
}

interface OrderDetailData {
  order: Order;
  events: OrderEvent[];
  pipeline: Pipeline | null;
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

interface UseOrdersOptions {
  stage?: string;
  source?: string;
  search?: string;
  today?: boolean;
  limit?: number;
}

export function useOrders(options: UseOrdersOptions = {}) {
  const { stage, source, search, today, limit = 25 } = options;

  const getKey = (pageIndex: number, previousPageData: OrdersPage | null) => {
    // No more pages
    if (previousPageData && !previousPageData.nextCursor) return null;

    const params = new URLSearchParams();
    if (stage) params.set("stage", stage);
    if (source) params.set("source", source);
    if (search) params.set("search", search);
    if (today) params.set("today", "true");
    params.set("limit", String(limit));

    if (pageIndex > 0 && previousPageData?.nextCursor) {
      params.set("cursor", previousPageData.nextCursor);
    }

    return `/api/orders?${params.toString()}`;
  };

  const { data, error, isLoading, isValidating, size, setSize } =
    useSWRInfinite<OrdersPage>(getKey, fetcher, {
      revalidateOnFocus: false,
      revalidateFirstPage: false,
    });

  const orders = data ? data.flatMap((page) => page.orders) : [];
  const lastPage = data ? data[data.length - 1] : null;
  const hasMore = !!lastPage?.nextCursor;
  const isLoadingMore = isValidating && size > (data?.length ?? 0);

  return {
    orders,
    isLoading,
    isError: !!error,
    hasMore,
    isLoadingMore,
    loadMore: () => setSize(size + 1),
  };
}

export function useOrder(orderId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<OrderDetailData>(
    orderId ? `/api/orders/${orderId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    order: data?.order ?? null,
    events: data?.events ?? [],
    pipeline: data?.pipeline ?? null,
    isLoading,
    isError: !!error,
    mutate,
  };
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

---

## Task 5: Create new SWR hooks

**Files:**
- Create: `src/hooks/use-dashboard.ts`
- Create: `src/hooks/use-team.ts`
- Create: `src/hooks/use-profile.ts`
- Create: `src/hooks/use-platform-config.ts`

- [ ] **Step 1: Create `use-dashboard.ts`**

```typescript
// src/hooks/use-dashboard.ts
"use client";

import useSWR from "swr";
import type { Order } from "@/models/types";

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  ordersThisMonth: number;
  pendingOrders: number;
}

interface DashboardData {
  stats: DashboardStats;
  recentOrders: Order[];
  stageCounts: Record<string, number>;
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch dashboard data");
  return res.json();
}

export function useDashboard() {
  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    "/api/dashboard",
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    stats: data?.stats ?? null,
    recentOrders: data?.recentOrders ?? [],
    stageCounts: data?.stageCounts ?? {},
    isLoading,
    isError: !!error,
    mutate,
  };
}
```

- [ ] **Step 2: Create `use-team.ts`**

```typescript
// src/hooks/use-team.ts
"use client";

import useSWR from "swr";
import type { ShopMember } from "@/models/types";

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch team");
  return res.json();
}

export function useTeam() {
  const { data, error, isLoading, mutate } = useSWR<{ members: ShopMember[] }>(
    "/api/team",
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    members: data?.members ?? [],
    isLoading,
    isError: !!error,
    mutate,
  };
}
```

- [ ] **Step 3: Create `use-profile.ts`**

```typescript
// src/hooks/use-profile.ts
"use client";

import useSWR from "swr";
import type { Shop } from "@/models/types";

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export function useProfile() {
  const { data, error, isLoading, mutate } = useSWR<{ shop: Shop }>(
    "/api/profile",
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    shop: data?.shop ?? null,
    isLoading,
    isError: !!error,
    mutate,
  };
}
```

- [ ] **Step 4: Create `use-platform-config.ts`**

```typescript
// src/hooks/use-platform-config.ts
"use client";

import useSWR from "swr";
import type { VariantGroupDef } from "@/models/types";

interface PlatformConfigData {
  variantGroups: VariantGroupDef[];
  defaultPipelineId: string;
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch platform config");
  return res.json();
}

export function usePlatformConfig() {
  const { data, error, isLoading } = useSWR<PlatformConfigData>(
    "/api/platform-config",
    fetcher,
    {
      revalidateOnFocus: false,
      // Platform config is stable — keep cached for the session
      dedupingInterval: 60_000,
    }
  );

  return {
    variantGroups: data?.variantGroups ?? [],
    defaultPipelineId: data?.defaultPipelineId ?? "default",
    isLoading,
    isError: !!error,
  };
}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

---

## Task 6: Convert dashboard page to client component

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

The page becomes a `"use client"` component. It removes all direct Firestore imports and server-side data fetching. Data comes from `useDashboard` and `useAuth`. A skeleton renders while loading.

- [ ] **Step 1: Replace the page**

```typescript
// src/app/(dashboard)/dashboard/page.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useDashboard } from "@/hooks/use-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import PageHeader from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const stageIcons: Record<string, string> = {
  received: "bg-blue-100 text-blue-600",
  processing: "bg-amber-100 text-amber-600",
  printing: "bg-orange-100 text-orange-600",
  quality_check: "bg-purple-100 text-purple-600",
  shipped: "bg-emerald-100 text-emerald-600",
  delivered: "bg-green-100 text-green-600",
  cancelled: "bg-red-100 text-red-600",
};

const stageColors: Record<string, string> = {
  received: "bg-blue-50 text-blue-700 border-blue-200/60",
  processing: "bg-amber-50 text-amber-700 border-amber-200/60",
  printing: "bg-orange-50 text-orange-700 border-orange-200/60",
  quality_check: "bg-purple-50 text-purple-700 border-purple-200/60",
  shipped: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  delivered: "bg-green-50 text-green-700 border-green-200/60",
  cancelled: "bg-red-50 text-red-700 border-red-200/60",
};

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-6 space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-9 rounded-xl" />
            </div>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-16" />
          </Card>
        ))}
      </div>
      <Card className="p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const { user, shop } = useAuth();
  const { stats, recentOrders, stageCounts, isLoading } = useDashboard();

  useEffect(() => {
    document.title = "Dashboard — Inklabs";
  }, []);

  const canCreateOrder =
    shop?.role === "operator" ||
    shop?.role === "admin" ||
    shop?.role === "owner";

  if (isLoading) return <DashboardSkeleton />;

  const firstName = (user?.displayName || user?.email || "there").split(" ")[0];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={`${shop?.displayName ?? ""} — Shop Dashboard`}
        actions={
          canCreateOrder ? (
            <Link
              href="/orders/create"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-b from-indigo-500 to-indigo-600 text-white rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md hover:shadow-indigo-200/50 active:scale-[0.97] border border-indigo-600/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Order
            </Link>
          ) : undefined
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <Card className="p-6 group hover:border-indigo-200/60 transition-all duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-400">Total Orders</p>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <svg className="w-[18px] h-[18px] text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2 tabular-nums">{stats?.totalOrders ?? 0}</p>
          <p className="text-[11px] text-gray-300 mt-1">All time</p>
        </Card>

        <Card className="p-6 group hover:border-emerald-200/60 transition-all duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-400">Total Revenue</p>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <svg className="w-[18px] h-[18px] text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2 tabular-nums">{formatCurrency(stats?.totalRevenue ?? 0)}</p>
          <p className="text-[11px] text-gray-300 mt-1">All time</p>
        </Card>

        <Card className="p-6 group hover:border-blue-200/60 transition-all duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-400">This Month</p>
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg className="w-[18px] h-[18px] text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2 tabular-nums">{stats?.ordersThisMonth ?? 0}</p>
          <p className="text-[11px] text-gray-300 mt-1">Orders placed</p>
        </Card>

        <Card className="p-6 group hover:border-amber-200/60 transition-all duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-400">Pending</p>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <svg className="w-[18px] h-[18px] text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-indigo-600 mt-2 tabular-nums">{stats?.pendingOrders ?? 0}</p>
          <p className="text-[11px] text-gray-300 mt-1">Awaiting processing</p>
        </Card>
      </div>

      {/* Orders by Stage */}
      {Object.keys(stageCounts).length > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 tracking-tight">Orders by Stage</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {Object.entries(stageCounts).map(([key, count]) => (
              <Link
                key={key}
                href={`/orders?stage=${key}`}
                className="flex flex-col items-center p-3.5 rounded-xl border border-gray-100/80 hover:border-indigo-200/60 hover:bg-indigo-50/30 transition-all duration-200 group active:scale-[0.98]"
              >
                <span className={`text-2xl font-bold tabular-nums ${stageIcons[key]?.split(" ")[1] ?? "text-gray-600"}`}>
                  {count}
                </span>
                <span className="text-[11px] text-gray-400 mt-1.5 capitalize font-medium">
                  {key.replace(/_/g, " ")}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Orders */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-900 tracking-tight">Recent Orders</h2>
          <Link href="/orders" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors flex items-center gap-1 group">
            View all
            <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-14">
            <p className="text-gray-500 text-sm font-medium">No orders yet</p>
            {canCreateOrder && (
              <Link href="/orders/create" className="mt-4 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                Create your first order
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100/80">
                  <th className="text-left py-2.5 px-6 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Order ID</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Size</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Qty</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Stage</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total</th>
                  <th className="text-left py-2.5 px-6 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentOrders.map((order) => (
                  <tr key={order.orderId} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-6">
                      <Link href={`/orders/${order.orderId}`} className="text-indigo-600 hover:text-indigo-700 font-mono text-xs font-medium">
                        {order.orderId.substring(0, 8)}...
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-gray-900 font-medium">{order.customerName || "—"}</td>
                    <td className="py-3.5 px-4 text-gray-500">{order.sizeInInches}&quot;</td>
                    <td className="py-3.5 px-4 text-gray-500 tabular-nums">{order.quantity}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border ${stageColors[order.currentStageKey] ?? "bg-gray-50 text-gray-600 border-gray-200/60"}`}>
                        {order.currentStageKey?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-900 font-medium tabular-nums">{formatCurrency(order.billingSnapshot?.total || 0)}</td>
                    <td className="py-3.5 px-6 text-gray-400 text-xs">{formatRelativeTime(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

---

## Task 7: Convert orders list page — client component + pagination

**Files:**
- Modify: `src/app/(dashboard)/orders/page.tsx`

The page manages filter state locally. The Today button is a quick-select toggle. Load More appears when `hasMore` is true.

- [ ] **Step 1: Replace the page**

```typescript
// src/app/(dashboard)/orders/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useOrders } from "@/hooks/use-orders";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import PageHeader from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const stageColors: Record<string, string> = {
  received: "bg-blue-50 text-blue-700 border-blue-200/60",
  processing: "bg-amber-50 text-amber-700 border-amber-200/60",
  printing: "bg-orange-50 text-orange-700 border-orange-200/60",
  quality_check: "bg-purple-50 text-purple-700 border-purple-200/60",
  shipped: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  delivered: "bg-green-50 text-green-700 border-green-200/60",
  cancelled: "bg-red-50 text-red-700 border-red-200/60",
};

function OrdersTableSkeleton() {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b border-gray-100 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </Card>
  );
}

export default function OrdersPage() {
  const { shop } = useAuth();

  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [today, setToday] = useState(false);

  useEffect(() => {
    document.title = "Orders — Inklabs";
  }, []);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset other filters when Today is toggled
  const handleTodayToggle = useCallback(() => {
    setToday((prev) => {
      if (!prev) {
        setStage("");
        setSource("");
        setSearchInput("");
        setSearch("");
      }
      return !prev;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setStage("");
    setSource("");
    setSearchInput("");
    setSearch("");
    setToday(false);
  }, []);

  const { orders, isLoading, hasMore, isLoadingMore, loadMore } = useOrders({
    stage: stage || undefined,
    source: source || undefined,
    search: search || undefined,
    today,
  });

  const canCreateOrder =
    shop?.role === "operator" ||
    shop?.role === "admin" ||
    shop?.role === "owner";

  const hasActiveFilters = stage || source || search || today;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="View and manage your shop orders"
        actions={
          canCreateOrder ? (
            <Link
              href="/orders/create"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-b from-indigo-500 to-indigo-600 text-white rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all duration-200 text-sm font-medium shadow-sm active:scale-[0.97] border border-indigo-600/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Order
            </Link>
          ) : undefined
        }
      />

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Today toggle */}
          <button
            onClick={handleTodayToggle}
            className={`h-10 px-4 rounded-xl text-sm font-medium border transition-all duration-200 active:scale-95 ${
              today
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            Today
          </button>

          <div className="flex-1 min-w-48">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (today) setToday(false);
              }}
              placeholder="Search by name, email, order ID..."
              className="w-full h-10 px-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 hover:border-gray-300 transition-all"
            />
          </div>

          <select
            value={stage}
            onChange={(e) => { setStage(e.target.value); if (today) setToday(false); }}
            className="h-10 px-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white hover:border-gray-300 transition-all"
          >
            <option value="">All Stages</option>
            <option value="received">Received</option>
            <option value="processing">Processing</option>
            <option value="printing">Printing</option>
            <option value="quality_check">Quality Check</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={source}
            onChange={(e) => { setSource(e.target.value); if (today) setToday(false); }}
            className="h-10 px-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white hover:border-gray-300 transition-all"
          >
            <option value="">All Sources</option>
            <option value="shopify">Shopify</option>
            <option value="studio">Studio</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="h-10 px-4 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 text-sm font-medium border border-gray-200 hover:border-gray-300 transition-all active:scale-95"
            >
              Clear
            </button>
          )}
        </div>
      </Card>

      {/* Orders Table */}
      {isLoading ? (
        <OrdersTableSkeleton />
      ) : (
        <Card className="p-0 overflow-hidden">
          {orders.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-sm font-medium">No orders found</p>
              <p className="text-gray-300 text-xs mt-1">
                {hasActiveFilters ? "Try adjusting your filters" : "Orders will appear here once created"}
              </p>
              {canCreateOrder && !hasActiveFilters && (
                <Link href="/orders/create" className="mt-4 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  Create your first order
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 border-b border-gray-100/80">
                  <tr>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Order ID</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Customer</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Size</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Qty</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Stage</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Source</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Created</th>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Design</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((order) => (
                    <tr key={order.orderId} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link href={`/orders/${order.orderId}`} className="text-indigo-600 hover:text-indigo-700 font-mono text-xs font-medium">
                          {order.orderId.substring(0, 12)}...
                        </Link>
                        {order.shopifyOrderNumber && (
                          <p className="text-[11px] text-gray-300 mt-0.5">#{order.shopifyOrderNumber}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-gray-900 font-medium">{order.customerName || "—"}</p>
                        {order.customerEmail && (
                          <p className="text-[11px] text-gray-300 truncate max-w-40">{order.customerEmail}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500">{order.sizeInInches}&quot;</td>
                      <td className="py-3.5 px-4 text-gray-500 tabular-nums">{order.quantity}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border ${stageColors[order.currentStageKey] ?? "bg-gray-50 text-gray-600 border-gray-200/60"}`}>
                          {order.currentStageKey?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border ${order.source === "shopify" ? "bg-emerald-50 text-emerald-600 border-emerald-200/60" : "bg-purple-50 text-purple-600 border-purple-200/60"}`}>
                          {order.source}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-900 font-medium tabular-nums">{formatCurrency(order.billingSnapshot?.total || 0)}</td>
                      <td className="py-3.5 px-4 text-gray-400 text-xs">{formatRelativeTime(order.createdAt)}</td>
                      <td className="py-3.5 px-4">
                        {order.designAssets?.thumbnailUrl || order.designAssets?.designImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={order.designAssets.thumbnailUrl || order.designAssets.designImageUrl}
                            alt="Design"
                            className="w-10 h-10 object-cover rounded-lg border border-gray-100"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Load More */}
      {!isLoading && hasMore && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 text-sm font-medium transition-all duration-200 disabled:opacity-50 active:scale-95"
          >
            {isLoadingMore ? "Loading…" : "Load more orders"}
          </button>
        </div>
      )}

      {!isLoading && orders.length > 0 && (
        <p className="text-[11px] text-gray-300 text-center">
          Showing {orders.length} order{orders.length !== 1 ? "s" : ""}
          {hasActiveFilters ? " (filtered)" : ""}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

---

## Task 8: Convert order detail page to client component

**Files:**
- Modify: `src/app/(dashboard)/orders/[orderId]/page.tsx`

The `useOrder` hook already exists in `use-orders.ts` and fetches `/api/orders/:orderId` which returns `{ order, events, pipeline }`. The page just needs to use it.

- [ ] **Step 1: Replace the page**

```typescript
// src/app/(dashboard)/orders/[orderId]/page.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useOrder } from "@/hooks/use-orders";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils";
import PageHeader from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Pipeline } from "@/models/types";

const stageColors: Record<string, string> = {
  received: "bg-blue-50 text-blue-700 border-blue-200/60",
  processing: "bg-amber-50 text-amber-700 border-amber-200/60",
  printing: "bg-orange-50 text-orange-700 border-orange-200/60",
  quality_check: "bg-purple-50 text-purple-700 border-purple-200/60",
  shipped: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  delivered: "bg-green-50 text-green-700 border-green-200/60",
  cancelled: "bg-red-50 text-red-700 border-red-200/60",
};

const eventIcons: Record<string, string> = {
  ORDER_CREATED: "bg-green-100 text-green-600",
  STATUS_CHANGED: "bg-blue-100 text-blue-600",
  NOTE_ADDED: "bg-amber-100 text-amber-600",
  FILE_UPLOADED: "bg-purple-100 text-purple-600",
  PAYMENT_UPDATED: "bg-emerald-100 text-emerald-600",
};

const eventSvgPaths: Record<string, string> = {
  ORDER_CREATED: "M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z",
  STATUS_CHANGED: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  NOTE_ADDED: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  FILE_UPLOADED: "M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13",
  PAYMENT_UPDATED: "M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z",
};

function OrderDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Card className="p-6">
            <Skeleton className="h-5 w-24 mb-4" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </Card>
        </div>
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId ?? null;
  const { order, events, pipeline, isLoading, isError } = useOrder(orderId);

  useEffect(() => {
    if (order) document.title = `Order #${order.orderId.substring(0, 8)} — Inklabs`;
    else document.title = "Order — Inklabs";
  }, [order]);

  if (isLoading) return <OrderDetailSkeleton />;

  if (isError || !order) {
    return (
      <div className="text-center py-24">
        <p className="text-gray-500 text-sm font-medium">Order not found</p>
        <Link href="/orders" className="mt-3 inline-flex text-sm text-indigo-600 hover:text-indigo-700 font-medium">
          ← Back to Orders
        </Link>
      </div>
    );
  }

  const stages = pipeline?.stages
    ? [...pipeline.stages].sort((a, b) => a.order - b.order)
    : [];
  const currentStageIndex = stages.findIndex((s) => s.key === order.currentStageKey);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order #${orderId?.substring(0, 8)}...`}
        description={`Created ${formatDate(order.createdAt)} — ${formatRelativeTime(order.createdAt)}`}
        actions={
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium active:scale-[0.97]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Orders
          </Link>
        }
      />

      {/* Stage indicator */}
      {stages.length > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-5 tracking-tight">Order Progress</h2>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {stages.map((stage, index) => {
              const isPast = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;
              return (
                <div key={stage.key} className="flex items-center gap-1 min-w-0">
                  <div className="flex flex-col items-center min-w-16">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${isCurrent ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-200/50 scale-110" : isPast ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-400"}`}>
                      {isPast ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : index + 1}
                    </div>
                    <span className={`text-[11px] mt-1.5 text-center leading-tight font-medium ${isCurrent ? "text-indigo-600" : isPast ? "text-emerald-600" : "text-gray-300"}`}>
                      {stage.label}
                    </span>
                  </div>
                  {index < stages.length - 1 && (
                    <div className={`h-0.5 flex-1 min-w-4 mt-[-20px] rounded-full ${isPast ? "bg-emerald-400" : "bg-gray-100"}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${stageColors[order.currentStageKey] ?? "bg-gray-50 text-gray-600 border-gray-200/60"}`}>
              Current: {order.currentStageKey?.replace(/_/g, " ")}
            </span>
            <span className="text-[11px] text-gray-300">Stage changes are managed by the platform</span>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Design */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 tracking-tight">Design</h2>
            {order.designAssets?.designImageUrl ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={order.designAssets.designImageUrl} alt="Design" className="max-w-full max-h-96 object-contain rounded-xl border border-gray-100" />
                <a href={order.designAssets.designImageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-all active:scale-[0.97]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Design
                </a>
              </div>
            ) : (
              <div className="h-48 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
                <p className="text-gray-300 text-sm">No design image available</p>
              </div>
            )}
          </Card>
        </div>

        {/* Details */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 tracking-tight">Customer</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
                {(order.customerName || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-gray-900 font-semibold">{order.customerName || "—"}</p>
                {order.customerEmail && <p className="text-xs text-gray-400">{order.customerEmail}</p>}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 tracking-tight">Product Details</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Title</span><span className="text-gray-900 font-medium">{order.productTitle || "Custom Order"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Size</span><span className="text-gray-900">{order.sizeInInches}&quot; inches</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Quantity</span><span className="text-gray-900 font-medium tabular-nums">{order.quantity}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Source</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border ${order.source === "shopify" ? "bg-emerald-50 text-emerald-600 border-emerald-200/60" : "bg-purple-50 text-purple-600 border-purple-200/60"}`}>
                  {order.source}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 tracking-tight">Billing</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Unit Price</span><span className="tabular-nums">{formatCurrency(order.billingSnapshot?.unitPrice || 0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Quantity</span><span className="tabular-nums">&times;{order.quantity}</span></div>
              <div className="flex justify-between pt-3 border-t border-gray-100">
                <span className="font-semibold text-gray-800">Total</span>
                <span className="font-bold text-lg text-gray-900 tabular-nums">{formatCurrency(order.billingSnapshot?.total || 0)}</span>
              </div>
            </div>
          </Card>

          {order.notes && (
            <Card className="p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-2 tracking-tight">Notes</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{order.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {/* Timeline */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-5 tracking-tight">Order Timeline</h2>
        {events.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-300">No events recorded</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event, i) => (
              <div key={event.eventId} className="flex gap-4">
                <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${eventIcons[event.type] ?? "bg-gray-100 text-gray-500"}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={eventSvgPaths[event.type] ?? "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{event.description}</p>
                  {event.performedByName && <p className="text-[11px] text-gray-400 mt-0.5">by {event.performedByName}</p>}
                  {event.type === "STATUS_CHANGED" && event.fromStageKey && event.toStageKey && (
                    <p className="text-[11px] text-gray-400 mt-0.5">{event.fromStageKey.replace(/_/g, " ")} → {event.toStageKey.replace(/_/g, " ")}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-[11px] text-gray-300 pt-0.5">{formatRelativeTime(event.timestamp)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

---

## Task 9: Convert create order page to client component

**Files:**
- Modify: `src/app/(dashboard)/orders/create/page.tsx`

The server Firestore call is removed. Platform config loads via the `usePlatformConfig` hook.

- [ ] **Step 1: Replace the page**

```typescript
// src/app/(dashboard)/orders/create/page.tsx
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
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

---

## Task 10: Convert team page to client component

**Files:**
- Modify: `src/app/(dashboard)/team/page.tsx`

- [ ] **Step 1: Replace the page**

```typescript
// src/app/(dashboard)/team/page.tsx
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
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

---

## Task 11: Convert profile page to client component

**Files:**
- Modify: `src/app/(dashboard)/profile/page.tsx`

`useAuth` provides user + shop + role. `useProfile` provides the full shop document (contact info, slug, etc.). The `/api/profile` GET endpoint already exists.

- [ ] **Step 1: Replace the page**

```typescript
// src/app/(dashboard)/profile/page.tsx
"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
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

function ProfileSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="p-6 space-y-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </Card>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const { user, shop: authShop, isLoading: authLoading } = useAuth();
  const { shop, isLoading: profileLoading } = useProfile();

  useEffect(() => {
    document.title = "Profile — Inklabs";
  }, []);

  if (authLoading || profileLoading) return <ProfileSkeleton />;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Profile" description="View your shop profile and account information" />

      {/* Shop Profile */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-900 tracking-tight">Shop Profile</h2>
          {shop && !shop.isActive && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-50 text-amber-600 border border-amber-200/60">
              Pending Activation
            </span>
          )}
        </div>

        <div className="flex items-start gap-4 mb-6">
          {shop?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.logoUrl} alt={shop.displayName} className="w-16 h-16 rounded-2xl object-cover border border-gray-100 shadow-sm" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center text-2xl font-bold text-indigo-700 shadow-sm">
              {shop?.displayName?.charAt(0)?.toUpperCase() ?? "S"}
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold text-gray-900 tracking-tight">{shop?.displayName}</h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border ${shop?.shopType === "shopify" ? "bg-emerald-50 text-emerald-600 border-emerald-200/60" : "bg-purple-50 text-purple-600 border-purple-200/60"}`}>
                {shop?.shopType === "shopify" ? "Shopify" : "Studio"}
              </span>
              {shop?.slug && <span className="text-sm text-gray-400 font-mono">/{shop.slug}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shop?.contact?.email && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Contact Email</label>
              <p className="text-sm text-gray-900">{shop.contact.email}</p>
            </div>
          )}
          {shop?.contact?.phone && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Phone</label>
              <p className="text-sm text-gray-900">{shop.contact.phone}</p>
            </div>
          )}
          {shop?.contact?.address && (
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Address</label>
              <p className="text-sm text-gray-900">
                {[shop.contact.address, shop.contact.city, shop.contact.state, shop.contact.pincode].filter(Boolean).join(", ")}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Account Info */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-5 tracking-tight">Your Account</h2>
        <div className="flex items-center gap-4 mb-5">
          {user?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt={user.displayName || ""} className="w-14 h-14 rounded-2xl border border-gray-100 shadow-sm object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center text-xl font-bold text-indigo-700 shadow-sm">
              {(user?.displayName || user?.email)?.charAt(0)?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900 tracking-tight text-lg">{user?.displayName || "—"}</p>
            <p className="text-sm text-gray-400">{user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role</label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium capitalize border ${roleColors[authShop?.role ?? ""] ?? "bg-gray-50 text-gray-500 border-gray-200/60"}`}>
              {authShop?.role}
            </span>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 tracking-tight">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/select-shop" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium active:scale-[0.97]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Switch Shop
          </a>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 text-red-600 rounded-xl hover:bg-red-100 hover:border-red-200 transition-all text-sm font-medium active:scale-[0.97]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

---

## Task 12: Convert pricing page to client component

**Files:**
- Modify: `src/app/(dashboard)/pricing/page.tsx`

The `usePricing` hook already exists and wraps `/api/pricing`. The page just needs to use it and render a skeleton.

- [ ] **Step 1: Replace the page**

```typescript
// src/app/(dashboard)/pricing/page.tsx
"use client";

import { useEffect } from "react";
import { usePricing } from "@/hooks/use-pricing";
import { useAuth } from "@/hooks/use-auth";
import PageHeader from "@/components/layout/page-header";
import PricingMatrix from "@/components/pricing/pricing-matrix";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function PricingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Card className="p-0 overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function PricingPage() {
  const { shop } = useAuth();
  const { effectiveRules, variantGroups, isLoading } = usePricing();

  useEffect(() => {
    document.title = "Pricing — Inklabs";
  }, []);

  // Redirect non-admins: show a plain message (layout already hides nav item)
  if (!isLoading && shop && shop.role !== "admin" && shop.role !== "owner") {
    return (
      <div className="text-center py-24">
        <p className="text-gray-500 text-sm">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Pricing" description="View the effective pricing for your shop" />

      <Card className="p-4 bg-indigo-50/60 border-indigo-100/80">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="pt-1">
            <p className="text-sm font-medium text-indigo-900">Read-only Pricing</p>
            <p className="text-sm text-indigo-700/80 mt-0.5 leading-relaxed">
              These are the prices applied to your orders. Contact the platform administrator to request changes.
            </p>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <PricingSkeleton />
      ) : (
        <PricingMatrix effectiveRules={effectiveRules} variantGroups={variantGroups} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

---

## Task 13: Final type check + smoke test

- [ ] **Step 1: Full TypeScript check**

```bash
cd shop-dashboard && npx tsc --noEmit
```

Expected: zero errors

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Verify each page loads**

1. Open `http://localhost:3001/dashboard` — should show skeleton then data
2. Click **Orders** in sidebar — navigation should be instant, skeleton appears, data loads
3. Click **Today** button — orders for today appear without page reload
4. Scroll to bottom → click **Load more** — next 25 orders append to the list
5. Click an order row — order detail shows skeleton then content
6. Click **Create Order** — form shows with size/variant options from platform config
7. Click **Team** — team table loads
8. Click **Profile** — shop + user info loads
9. Click **Pricing** — pricing matrix loads
10. Navigate between multiple pages rapidly — each page renders instantly on second visit (SWR cache)

- [ ] **Step 4: Verify SWR cache works**

Navigate Dashboard → Orders → Dashboard. The second visit to Dashboard should render immediately (no loading skeleton) because SWR serves the cached data while revalidating in the background.

---

## Notes

**Composite Firestore index for Today + Stage filter:** If users need to filter by Today AND Stage simultaneously, a composite index on `(currentStageKey ASC, createdAt DESC)` would be required. The current implementation treats them as mutually exclusive to avoid this. Add the index via Firebase Console if combined filtering is needed later.

**Search accuracy:** Search is applied in-memory on the current page's 25 orders. It won't find orders outside the current page. Full-text search across all orders would require Algolia or a similar service.

**SWR `revalidateFirstPage: false`** in `useSWRInfinite` prevents the first page from re-fetching when `loadMore` is called (i.e., when navigating page 2+). This avoids re-rendering already-loaded orders.
