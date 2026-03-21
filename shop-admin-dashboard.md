# Shop Admin Dashboard — Detailed Implementation Plan

> **Project**: `inklabs-shop-dashboard`
> **Purpose**: Shop-scoped dashboard for merchants (Shopify shops) and print studios (non-Shopify studios) to view orders, create custom orders, and track production status.
> **Tech stack**: Next.js 15 (App Router) · TypeScript · Firebase Admin SDK · Firebase Client SDK · Firestore · Firebase Storage · Tailwind CSS 4 · Vercel
> **Shares Firestore with**: `inkcanvas-customizer` (Shopify app), `inklabs-superadmin` (superadmin dashboard)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Key Differences from Superadmin Dashboard](#2-key-differences-from-superadmin-dashboard)
3. [Data Model Reference](#3-data-model-reference)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Onboarding Flows](#5-onboarding-flows)
6. [Project Structure](#6-project-structure)
7. [Environment Variables](#7-environment-variables)
8. [Firebase SDK Setup](#8-firebase-sdk-setup)
9. [Middleware](#9-middleware)
10. [Pages — Detailed Specifications](#10-pages--detailed-specifications)
11. [API Routes — Detailed Specifications](#11-api-routes--detailed-specifications)
12. [Order Creation & Pricing Logic](#12-order-creation--pricing-logic)
13. [Firestore Indexes](#13-firestore-indexes)
14. [UI Component Library](#14-ui-component-library)
15. [State Management & Data Fetching](#15-state-management--data-fetching)
16. [Error Handling](#16-error-handling)
17. [Deployment to Vercel](#17-deployment-to-vercel)
18. [Dependencies](#18-dependencies)

---

## 1. Architecture Overview

```
Browser (Shop User)
    │
    ▼
┌─────────────────────────────────────────────┐
│  Next.js 15 App (Vercel)                    │
│  ┌────────────────┐  ┌───────────────────┐  │
│  │ Client-side    │  │ Server-side       │  │
│  │ Firebase Auth  │  │ Firebase Admin    │  │
│  │ (Google login) │  │ (all Firestore    │  │
│  │                │  │  reads/writes)    │  │
│  └───────┬────────┘  └───────┬───────────┘  │
│          │                   │              │
│  ┌───────▼───────────────────▼────────────┐ │
│  │ API Routes                             │ │
│  │ - Verify ID token (Firebase session)   │ │
│  │ - Check shop membership + role         │ │
│  │ - Scope ALL queries to current shopId  │ │
│  └────────────────────┬───────────────────┘ │
└───────────────────────┼─────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────┐
│  Firebase (Shared Project)                  │
│  ┌────────────┐  ┌───────────────────────┐  │
│  │ Firestore  │  │ Firebase Storage      │  │
│  │            │  │                       │  │
│  │ shops/     │  │ uploads/{shopId}/     │  │
│  │  {shopId}/ │  │   raw/{uuid}.png     │  │
│  │  members/  │  │   design/{uuid}.png  │  │
│  │  orders/   │  │                       │  │
│  │  pricing/  │  │ shop-assets/{shopId}/ │  │
│  │            │  │   logo/{uuid}.png    │  │
│  │ pricing/   │  │                       │  │
│  │  global/   │  │                       │  │
│  │ pipelines/ │  │                       │  │
│  └────────────┘  └───────────────────────┘  │
│  ┌────────────┐                             │
│  │ Firebase   │                             │
│  │ Auth       │                             │
│  └────────────┘                             │
└─────────────────────────────────────────────┘
```

### Data access scope

This app ONLY reads/writes data within the user's approved shop scope:
- `shops/{shopId}/**` — orders, members, pricing overrides
- `pricing/global/**` — read-only (for pricing calculation fallback)
- `pipelines/**` — read-only (for stage labels/colors)

This app NEVER reads/writes:
- `orders_global` — superadmin-only projection
- `admin_users` — superadmin-only whitelist
- Other shops' data — strictly forbidden by server-side authorization

---

## 2. Key Differences from Superadmin Dashboard

| Aspect | Superadmin | Shop Dashboard |
|--------|-----------|----------------|
| **Scope** | All shops, all orders | Single shop only |
| **Auth** | Google + admin whitelist | Google + shop membership approval |
| **Order stages** | Can change any order to any stage | Read-only (cannot change stages) |
| **Bulk actions** | Bulk stage updates | None |
| **Pricing** | Create/edit global + shop rules | View only (effective prices shown) |
| **Pipelines** | Create/edit stages | Read-only (stage labels/colors) |
| **Members** | Approve/assign roles | View own membership, see team (if owner/admin) |
| **Create orders** | No (orders come from shops) | Yes (studio orders via file upload) |
| **Shop creation** | Yes | Yes (studio onboarding only) |

---

## 3. Data Model Reference

This app uses the same shared Firestore data model defined in `superadmin-dashboard.md` (section 2). Key collections this app interacts with:

### Collections read/written by this app:

| Collection | Access | Purpose |
|-----------|--------|---------|
| `shops/{shopId}` | Read | Shop profile and metadata |
| `shops/{shopId}/members/{uid}` | Read + Write (limited) | Membership check, onboarding |
| `shops/{shopId}/orders/{orderId}` | Read + Write (create only) | View orders, create custom orders |
| `shops/{shopId}/orders/{orderId}/events/{eventId}` | Read + Write (append only) | View event timeline, write ORDER_CREATED |
| `shops/{shopId}/pricing/rules/{ruleId}` | Read | Shop-specific pricing overrides |
| `pricing/global/rules/{ruleId}` | Read | Global pricing fallback |
| `pipelines/{pipelineId}` | Read | Stage labels and colors for display |
| `platform_config/settings` | Read | Variant groups, default pipeline ID |

### TypeScript interfaces (re-export from shared types)

All interfaces (`Shop`, `Order`, `ShopMember`, `PricingRule`, `Pipeline`, `OrderEvent`, etc.) are identical to those defined in `superadmin-dashboard.md` section 2. Copy the same `types.ts` file.

---

## 4. Authentication & Authorization

### 4.1 Auth flow (Google sign-in + membership check)

```
1.  User visits shop dashboard
2.  Middleware checks for session cookie → if missing, redirect to /login
3.  /login: user clicks "Sign in with Google"
4.  Firebase Client SDK handles Google OAuth popup
5.  Client receives Firebase ID token
6.  Client POSTs ID token to /api/auth/login
7.  Server verifies ID token using Admin SDK
8.  Server queries: which shops does this user belong to?
    → Collection group query on "members" where uid == user.uid AND status == "active"
9.  Results:
    a) No memberships at all → show onboarding (create studio / request access)
    b) One active membership → auto-select that shop, create session
    c) Multiple active memberships → show shop selector
    d) Only pending memberships → show "Awaiting Approval" screen
10. Session cookie created with { uid, shopId, role } encoded
11. All subsequent requests are scoped to that shopId
```

### 4.2 Session cookie

Use **Firebase Auth Session Cookies** (same approach as superadmin), but the session also tracks the selected `shopId`:

```typescript
// After successful login + shop selection:
const sessionData = {
  uid: decodedToken.uid,
  email: decodedToken.email,
  shopId: selectedShopId,
  role: memberDoc.role,
};

// Store shopId and role in a separate httpOnly cookie alongside the Firebase session
// (Firebase session cookie stores auth state; custom cookie stores shop context)
const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 days

// Firebase session cookie
const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
cookies().set("__session", sessionCookie, {
  httpOnly: true, secure: true, sameSite: "lax",
  maxAge: expiresIn / 1000, path: "/",
});

// Shop context cookie (JSON-encoded, httpOnly)
cookies().set("__shop_context", JSON.stringify({
  shopId: selectedShopId,
  role: memberDoc.role,
  shopDisplayName: shopDoc.displayName,
}), {
  httpOnly: true, secure: true, sameSite: "lax",
  maxAge: expiresIn / 1000, path: "/",
});
```

### 4.3 Authorization helper

```typescript
interface ShopSession {
  uid: string;
  email: string;
  shopId: string;
  role: "owner" | "admin" | "operator" | "viewer";
  shopDisplayName: string;
}

async function verifyShopUser(request?: Request): Promise<ShopSession> {
  // 1. Verify Firebase session cookie
  const sessionCookie = cookies().get("__session")?.value;
  if (!sessionCookie) throw new AuthError("Not authenticated");

  const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);

  // 2. Read shop context
  const shopContext = cookies().get("__shop_context")?.value;
  if (!shopContext) throw new AuthError("No shop selected");

  const { shopId, role, shopDisplayName } = JSON.parse(shopContext);

  // 3. Verify membership is still active (re-check on every request)
  const memberDoc = await adminDb
    .collection("shops").doc(shopId)
    .collection("members").doc(decoded.uid)
    .get();

  if (!memberDoc.exists || memberDoc.data()?.status !== "active") {
    throw new AuthError("Membership is not active");
  }

  return {
    uid: decoded.uid,
    email: decoded.email!,
    shopId,
    role: memberDoc.data()!.role,
    shopDisplayName,
  };
}
```

### 4.4 Role-based access control (RBAC)

```typescript
function requireRole(session: ShopSession, minRole: "viewer" | "operator" | "admin" | "owner") {
  const hierarchy = { viewer: 0, operator: 1, admin: 2, owner: 3 };
  if (hierarchy[session.role] < hierarchy[minRole]) {
    throw new AuthError(`Requires ${minRole} role or higher`);
  }
}
```

**Per-page role requirements:**

| Page | Minimum role |
|------|-------------|
| Overview / Profile | viewer |
| Orders list | viewer |
| Order detail | viewer |
| Create order | operator |
| Pricing view | admin |
| Members view | admin |

---

## 5. Onboarding Flows

### 5.1 Studio onboarding (new studio, no existing shop)

This flow is for non-Shopify studios that want to use the platform.

```
1.  User signs in with Google
2.  Server finds no memberships for this user
3.  Show onboarding page with two options:
    a) "Create a new studio" → studio setup form
    b) "Join an existing shop" → enter shop slug/code to request access
4.  If creating a studio:
    a) User fills in: studio name, slug, contact email, phone (optional)
    b) Server creates:
       - shops/{slug} document with shopType: "studio", isActive: false (awaiting superadmin activation)
       - shops/{slug}/members/{uid} with role: "owner", status: "pending"
    c) User sees: "Your studio has been registered. Awaiting platform approval."
    d) Superadmin reviews in superadmin dashboard, approves shop + member
    e) User refreshes → now has active membership → enters dashboard
5.  If joining existing shop:
    a) User enters the shop slug (e.g., "xyz-tattoo")
    b) Server checks shop exists
    c) Server creates: shops/{shopId}/members/{uid} with role: "viewer", status: "pending"
    d) User sees: "Access request sent. Awaiting approval from shop admin."
    e) Superadmin (or shop owner in future) approves membership
```

### 5.2 Shopify shop onboarding (shop already exists via extension install)

```
1.  Shopify extension installation creates shops/{domain} via inkcanvas-customizer
2.  User (merchant) visits shop dashboard, signs in with Google
3.  Server finds no memberships for this user
4.  User sees onboarding: "Join an existing shop"
5.  User enters their Shopify domain (e.g., "cool-store.myshopify.com")
6.  Server finds the shop doc (shopType: "shopify", created by extension install)
7.  Server creates membership request: shops/{domain}/members/{uid} with status: "pending"
8.  Superadmin reviews and approves in superadmin dashboard
9.  User refreshes → enters dashboard
```

### 5.3 Returning user with pending membership

```
1.  User signs in with Google
2.  Server finds membership(s) but all are status: "pending"
3.  Show "Awaiting Approval" screen:
    - Message: "Your access request is being reviewed"
    - Show which shop(s) they requested access to
    - "Check again" button (re-queries membership status)
    - "Request access to another shop" link
```

---

## 6. Project Structure

```
shop-admin-dashboard/
├── .env.local
├── .env.example
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── public/
│   └── favicon.ico
│
└── src/
    ├── app/
    │   ├── layout.tsx                         # root layout: html, body, Toaster, font imports
    │   ├── globals.css                        # Tailwind imports + custom CSS variables
    │   ├── page.tsx                           # redirect to /dashboard or /login
    │   │
    │   ├── (auth)/
    │   │   ├── layout.tsx                     # centered card layout, no sidebar
    │   │   ├── login/
    │   │   │   └── page.tsx                   # Google sign-in
    │   │   ├── onboarding/
    │   │   │   └── page.tsx                   # create studio / join shop
    │   │   ├── pending/
    │   │   │   └── page.tsx                   # "Awaiting approval" screen
    │   │   └── select-shop/
    │   │       └── page.tsx                   # shop picker (if user has multiple shops)
    │   │
    │   ├── (dashboard)/
    │   │   ├── layout.tsx                     # sidebar + topbar + main content area
    │   │   │
    │   │   ├── dashboard/
    │   │   │   └── page.tsx                   # overview: stats, recent orders
    │   │   │
    │   │   ├── orders/
    │   │   │   ├── page.tsx                   # orders list (shop-scoped)
    │   │   │   ├── [orderId]/
    │   │   │   │   └── page.tsx               # order detail (read-only stage)
    │   │   │   └── create/
    │   │   │       └── page.tsx               # create custom order (studio flow)
    │   │   │
    │   │   ├── pricing/
    │   │   │   └── page.tsx                   # view effective pricing (read-only)
    │   │   │
    │   │   ├── team/
    │   │   │   └── page.tsx                   # view team members (admin/owner only)
    │   │   │
    │   │   └── profile/
    │   │       └── page.tsx                   # shop profile + account settings
    │   │
    │   └── api/
    │       ├── auth/
    │       │   ├── login/route.ts             # POST: exchange ID token for session
    │       │   ├── logout/route.ts            # POST: clear session
    │       │   ├── me/route.ts                # GET: current user + shop context
    │       │   └── memberships/route.ts       # GET: list user's shop memberships
    │       │
    │       ├── onboarding/
    │       │   ├── create-studio/route.ts     # POST: create studio shop + owner membership
    │       │   └── request-access/route.ts    # POST: request access to existing shop
    │       │
    │       ├── orders/
    │       │   ├── route.ts                   # GET: list shop orders (paginated)
    │       │   ├── [orderId]/
    │       │   │   └── route.ts               # GET: order detail
    │       │   └── create/route.ts            # POST: create custom order (with file upload)
    │       │
    │       ├── pricing/
    │       │   └── route.ts                   # GET: effective pricing for this shop
    │       │
    │       ├── pricing/calculate/route.ts     # POST: calculate price for given size + qty
    │       │
    │       ├── team/
    │       │   └── route.ts                   # GET: list shop members
    │       │
    │       ├── profile/
    │       │   └── route.ts                   # GET: shop profile | PATCH: update (owner/admin)
    │       │
    │       └── upload/
    │           └── route.ts                   # POST: upload design file to Firebase Storage
    │
    ├── lib/
    │   ├── firebase-admin.ts                  # Firebase Admin SDK singleton
    │   ├── firebase-client.ts                 # Firebase Client SDK (browser, auth only)
    │   ├── auth.ts                            # verifyShopUser(), requireRole() helpers
    │   ├── pricing.ts                         # calculateOrderPrice() with fallback logic
    │   └── utils.ts                           # formatCurrency(), formatDate(), cn(), etc.
    │
    ├── models/
    │   ├── types.ts                           # shared TypeScript interfaces
    │   ├── shop.ts                            # Firestore reads for shop profile
    │   ├── member.ts                          # Firestore reads for members
    │   ├── order.ts                           # Firestore CRUD for shop orders
    │   ├── pricing.ts                         # Firestore reads for pricing rules
    │   └── pipeline.ts                        # Firestore reads for pipeline stages
    │
    ├── hooks/
    │   ├── use-auth.ts                        # auth state, login/logout
    │   ├── use-orders.ts                      # SWR hooks for orders
    │   └── use-pricing.ts                     # SWR hooks for pricing
    │
    ├── components/
    │   ├── ui/                                # primitive UI components (same as superadmin)
    │   │   ├── button.tsx
    │   │   ├── input.tsx
    │   │   ├── select.tsx
    │   │   ├── badge.tsx
    │   │   ├── card.tsx
    │   │   ├── table.tsx
    │   │   ├── dialog.tsx
    │   │   ├── tabs.tsx
    │   │   ├── toast.tsx
    │   │   ├── skeleton.tsx
    │   │   ├── avatar.tsx
    │   │   ├── file-upload.tsx                # drag-and-drop file upload zone
    │   │   ├── pagination.tsx
    │   │   └── search-input.tsx
    │   │
    │   ├── layout/
    │   │   ├── sidebar.tsx                    # collapsible sidebar
    │   │   ├── topbar.tsx                     # shop name, user avatar, switch shop
    │   │   └── page-header.tsx                # title + description + actions
    │   │
    │   ├── auth/
    │   │   ├── login-form.tsx                 # Google sign-in button + error states
    │   │   ├── pending-approval.tsx           # awaiting approval card
    │   │   ├── onboarding-form.tsx            # create studio / join shop forms
    │   │   └── shop-selector.tsx              # multi-shop picker
    │   │
    │   ├── orders/
    │   │   ├── order-table.tsx                # orders data table
    │   │   ├── order-detail-card.tsx          # order detail view
    │   │   ├── stage-badge.tsx                # colored stage badge (read-only)
    │   │   ├── stage-timeline.tsx             # event history timeline
    │   │   ├── design-preview.tsx             # design image viewer
    │   │   └── order-filters.tsx              # filter bar (stage, date, search)
    │   │
    │   ├── create-order/
    │   │   ├── order-form.tsx                 # full order creation form
    │   │   ├── design-upload.tsx              # file upload zone with preview
    │   │   ├── size-selector.tsx              # size/variant picker (visual grid)
    │   │   ├── quantity-input.tsx             # quantity input with +/- buttons
    │   │   └── price-preview.tsx              # live price calculation display
    │   │
    │   └── pricing/
    │       └── pricing-matrix.tsx             # read-only pricing table
    │
    └── middleware.ts                          # auth check on dashboard routes
```

---

## 7. Environment Variables

### `.env.example`

```bash
# ─── Firebase Admin SDK (server-side) ───
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app

# ─── Firebase Client SDK (browser-side, for Auth only) ───
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id

# ─── App ───
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

All values are the SAME Firebase project as the superadmin dashboard and inkcanvas-customizer. Only `NEXT_PUBLIC_APP_URL` differs.

---

## 8. Firebase SDK Setup

Identical to `superadmin-dashboard.md` section 7. Copy `firebase-admin.ts` and `firebase-client.ts` as-is.

---

## 9. Middleware

```typescript
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes
  const publicPaths = ["/login", "/onboarding", "/pending", "/select-shop",
                        "/api/auth/login", "/api/auth/logout", "/api/auth/memberships",
                        "/api/onboarding"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for both session cookie AND shop context cookie
  const session = request.cookies.get("__session");
  const shopContext = request.cookies.get("__shop_context");

  if (!session?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!shopContext?.value) {
    // Authenticated but no shop selected — redirect to shop selection
    return NextResponse.redirect(new URL("/select-shop", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

---

## 10. Pages — Detailed Specifications

### 10.1 `/login` — Sign In

**Route:** `src/app/(auth)/login/page.tsx`
**Layout:** Centered card, clean background with inklabs branding
**Auth:** Public

**UI elements:**
- inklabs logo
- Heading: "Shop Dashboard"
- Subheading: "Sign in with your Google account to manage your shop"
- "Sign in with Google" button
- Error states: network error, popup blocked

**Behavior:**
1. User clicks "Sign in with Google"
2. Firebase popup → Google OAuth
3. On success: get ID token
4. POST to `/api/auth/login` with `{ idToken }`
5. Server checks memberships for this UID
6. Response includes: `{ memberships: [...], redirect: "/dashboard" | "/onboarding" | "/pending" | "/select-shop" }`
7. Client navigates to the returned redirect path

---

### 10.2 `/onboarding` — First-Time Setup

**Route:** `src/app/(auth)/onboarding/page.tsx`
**Layout:** Centered card, multi-step
**Auth:** Authenticated (session cookie) but no shop membership

**UI elements:**

**Step 1: Choose path**
- Card A: "Create a New Studio"
  - Description: "I want to create a new print studio account"
  - Button → goes to step 2A
- Card B: "Join an Existing Shop"
  - Description: "I have a shop slug or code from an existing shop"
  - Button → goes to step 2B

**Step 2A: Create Studio form**
- Studio name: text input (required)
- Studio slug: auto-generated from name, editable, with availability check
  - Show green checkmark if available, red X if taken
  - Validate: lowercase, alphanumeric + hyphens, 3-30 chars
- Contact email: pre-filled from Google account, editable
- Phone: text input (optional)
- Description: text area (optional)
- "Create Studio" button

On submit:
1. POST to `/api/onboarding/create-studio`
2. Server creates shop doc + owner membership (status: pending)
3. Redirect to `/pending`

**Step 2B: Join Shop form**
- Shop slug or domain: text input
  - Real-time lookup as user types (debounced)
  - Show shop name + type badge when found
  - Show "Shop not found" if no match
- "Request Access" button (only enabled when valid shop found)

On submit:
1. POST to `/api/onboarding/request-access`
2. Server creates membership doc (status: pending, role: viewer)
3. Redirect to `/pending`

---

### 10.3 `/pending` — Awaiting Approval

**Route:** `src/app/(auth)/pending/page.tsx`
**Layout:** Centered card
**Auth:** Authenticated, has pending membership(s)

**UI elements:**
- Clock/hourglass illustration
- Heading: "Awaiting Approval"
- Subheading: "Your access request is being reviewed by the platform administrator"
- List of pending memberships:
  - Shop name, shop type badge, requested date
- "Check Status" button → re-queries memberships
  - If any membership is now active → redirect to `/dashboard` (or `/select-shop` if multiple)
  - If still pending → show "Still waiting..." message
- "Request Access to Another Shop" link → back to onboarding
- "Sign Out" link

**Auto-poll:** Optionally poll every 30 seconds to check if approval happened.

---

### 10.4 `/select-shop` — Shop Picker

**Route:** `src/app/(auth)/select-shop/page.tsx`
**Layout:** Centered card
**Auth:** Authenticated, has multiple active memberships

**UI elements:**
- Heading: "Select a Shop"
- List of shops the user belongs to:
  - Shop logo/avatar
  - Shop name
  - Shop type badge (Shopify/Studio)
  - User's role in that shop
  - "Select" button
- Clicking a shop:
  1. POST to `/api/auth/login` with `{ shopId }` (sets shop context cookie)
  2. Redirect to `/dashboard`

---

### 10.5 `/dashboard` — Overview

**Route:** `src/app/(dashboard)/dashboard/page.tsx`
**Layout:** Sidebar + topbar
**Auth:** Active membership required, minimum role: viewer

**Data fetched (server component, scoped to current shopId):**
- Shop profile (name, type, logo)
- Total orders count (from `shops/{shopId}/orders`)
- Total revenue (sum of `billingSnapshot.total` from orders)
- Orders by stage (count per `currentStageKey`)
- Recent 10 orders (ordered by `createdAt desc`)

**UI sections:**

1. **Welcome banner:**
   - "Welcome back, {user.displayName}" with shop name and type badge

2. **Stats row** (3-4 cards):
   - Total Orders (all time)
   - Total Revenue (₹ formatted, all time)
   - Orders This Month (count)
   - Pending Orders (count where stage is "received")

3. **Orders by Stage** (horizontal stage cards):
   - One card per active pipeline stage showing count
   - Colored by stage color
   - Clickable → `/orders?stage={key}`

4. **Recent Orders** table (last 10):
   - Columns: Order ID, Customer, Size, Qty, Stage (badge), Total, Created
   - Row click → `/orders/{orderId}`
   - "View All Orders" link

5. **Quick Actions** (for operator+ roles):
   - "Create New Order" button → `/orders/create`
   - Only shown if user role is operator, admin, or owner

---

### 10.6 `/orders` — Orders List

**Route:** `src/app/(dashboard)/orders/page.tsx`
**Auth:** Minimum role: viewer

**Data:** From `shops/{shopId}/orders`, ordered by `createdAt desc`, paginated (25 per page)

**UI elements:**
- Page header: "Orders" + "Create Order" button (if role >= operator)
- Filter bar:
  - Stage: dropdown (from pipeline stages)
  - Source: All / Shopify / Studio
  - Date range: from/to date pickers
  - Search: text input (customer name, email, order ID)
- Orders table:
  - Columns:
    - Order ID (truncated, clickable → detail)
    - Shopify # (shown only for Shopify orders, if present)
    - Customer name
    - Size (e.g., "5 inch")
    - Qty
    - Stage (colored badge) — **read-only, no controls to change**
    - Total (₹ formatted)
    - Created (relative time)
    - Design thumbnail (40×40px)
  - Sortable by: Created, Total
- Pagination: prev/next + page numbers
- Empty state: "No orders yet" with "Create your first order" CTA (if applicable)

---

### 10.7 `/orders/[orderId]` — Order Detail

**Route:** `src/app/(dashboard)/orders/[orderId]/page.tsx`
**Auth:** Minimum role: viewer

**Data:**
- Order from `shops/{shopId}/orders/{orderId}`
- Events from `shops/{shopId}/orders/{orderId}/events`, ordered by `timestamp desc`
- Pipeline from `pipelines/{pipelineId}`

**UI sections:**

1. **Header:**
   - Order ID + source badge (Shopify/Studio)
   - Shopify order number (if Shopify order)
   - Created date (absolute + relative)

2. **Stage indicator** (read-only):
   - Horizontal pipeline progress bar showing all stages
   - Current stage highlighted with filled circle, past stages with checkmarks
   - Stage label and color displayed prominently
   - **No dropdown, no buttons to change stage** — shops are read-only for stages

3. **Design Preview** (left column, 60% width):
   - Design image (large, max 600px wide, aspect-ratio preserved)
   - "Download Design" button (opens in new tab / triggers download)
   - Raw upload image (smaller, below design)
   - "Download Original" button

4. **Order Details** (right column, 40% width):
   - **Customer:** name, email
   - **Product:** title, size (X inches), variant group
   - **Quantity:** number
   - **Billing breakdown:**
     - Unit price: ₹XX.XX
     - Quantity: ×N
     - Subtotal: ₹XX.XX
     - **Total: ₹XX.XX** (bold, larger)

5. **Event Timeline** (below, full width):
   - Vertical timeline, most recent at top
   - Each event: icon, description, timestamp, who performed it
   - Events the shop user sees:
     - ORDER_CREATED: "Order created"
     - STATUS_CHANGED: "Status changed from {from} to {to}"
     - (notes added by superadmin are visible but marked as "Platform update")

---

### 10.8 `/orders/create` — Create Custom Order

**Route:** `src/app/(dashboard)/orders/create/page.tsx`
**Auth:** Minimum role: operator

This is the studio order creation flow. Simple file upload (no canvas editor).

**UI: Multi-step form (single page, sections revealed progressively)**

**Step 1: Upload Design**
- Drag-and-drop zone (or click to browse)
  - Accepts: PNG, JPG, JPEG
  - Max file size: 20 MB
  - Shows upload progress bar
- After upload:
  - Preview of uploaded image (max 400px)
  - File name and size displayed
  - "Remove" button to re-upload
- Upload goes to `/api/upload` → stored at `uploads/{shopId}/raw/{uuid}.{ext}`
- The uploaded URL is stored in form state

**Step 2: Select Size**
- Visual grid of size options:
  - Each option is a card showing: size in inches (e.g., "3 inch"), variant group label
  - Available sizes fetched from `platform_config/settings` → variantGroups → all sizes
  - Cards are arranged in a grid (3-4 columns)
  - Selected card has highlighted border
- Selecting a size auto-determines the `variantGroup`

**Step 3: Enter Quantity**
- Number input with +/- stepper buttons
- Minimum: 1
- Common presets as quick-select buttons: 1, 5, 10, 25, 50, 100

**Step 4: Price Preview (auto-calculated, shown after size + qty are selected)**
- Calls `/api/pricing/calculate` with `{ shopId, variantGroup, quantity }`
- Displays:
  - Unit price: ₹XX.XX
  - Quantity: ×N
  - **Estimated Total: ₹XX.XX** (large, bold)
  - Pricing source badge: "Shop pricing" or "Standard pricing" (global)
  - Applied rule info (variant group + quantity range)
- If no pricing rule matches: show warning "No pricing rule found for this combination. Contact the platform administrator."

**Step 5: Customer Details (optional)**
- Customer name: text input (optional, defaults to "Studio Order")
- Customer email: text input (optional)
- Notes: text area (optional, internal note)

**Submit: "Place Order" button**
- Disabled until: design uploaded + size selected + quantity entered + pricing available
- Shows confirmation dialog:
  - Design thumbnail
  - Size, quantity, total
  - "Confirm" / "Cancel"
- On confirm: POST to `/api/orders/create`
- On success: redirect to `/orders/{newOrderId}` with success toast

---

### 10.9 `/pricing` — View Effective Pricing

**Route:** `src/app/(dashboard)/pricing/page.tsx`
**Auth:** Minimum role: admin

**Data:**
- Shop pricing rules from `shops/{shopId}/pricing/rules`
- Global pricing rules from `pricing/global/rules`
- Variant groups from `platform_config/settings`

**UI elements:**
- Page header: "Pricing"
- Info banner: "These are the prices applied to your orders. Contact the platform administrator to request changes."
- Pricing matrix table:
  - Rows: variant groups (2-4, 5-7, 8-10)
  - Columns: quantity tiers (derived from existing rules)
  - Cell: unit price (₹ formatted)
  - Cell color: blue if shop-specific override, gray if using global default
  - Legend: "Blue = Custom pricing for your shop" / "Gray = Standard platform pricing"
- **No edit controls** — pricing is read-only for shops

---

### 10.10 `/team` — Team Members

**Route:** `src/app/(dashboard)/team/page.tsx`
**Auth:** Minimum role: admin

**Data:** Members from `shops/{shopId}/members`

**UI elements:**
- Page header: "Team"
- Members table:
  - Columns: Avatar, Name, Email, Role (badge), Status (badge), Joined At
  - No action buttons — role changes and approvals are handled by superadmin
- Info banner: "To add or manage team members, contact the platform administrator."
- Current user's row is highlighted

---

### 10.11 `/profile` — Shop Profile & Account

**Route:** `src/app/(dashboard)/profile/page.tsx`
**Auth:** Minimum role: viewer (view), admin (edit)

**UI sections:**

1. **Shop Profile** (read-only for viewer/operator, editable for admin/owner):
   - Shop logo (with upload button for admin+)
   - Display name
   - Shop type (badge, not editable)
   - Slug (not editable after creation)
   - Description
   - Contact info: email, phone, address, city, state, pincode
   - "Save Changes" button (only shown for admin/owner)

2. **Account Info** (read-only, always visible):
   - Your name (from Google)
   - Your email (from Google)
   - Your role in this shop
   - Member since (requestedAt/approvedAt)

3. **Switch Shop** (if user has multiple memberships):
   - "Switch to another shop" button → redirects to `/select-shop`

4. **Sign Out:**
   - "Sign Out" button → POST to `/api/auth/logout` → redirect to `/login`

---

## 11. API Routes — Detailed Specifications

Every API route verifies the session cookie AND shop membership before processing. All data queries are scoped to `shopId` from the shop context cookie.

### 11.1 Auth

#### `POST /api/auth/login`
```
Request body: { idToken: string, shopId?: string }
Response 200: {
  success: true,
  redirect: "/dashboard" | "/onboarding" | "/pending" | "/select-shop",
  memberships: ShopMembership[]    // { shopId, shopName, role, status }[]
}

Steps:
1. Verify Firebase ID token
2. Query all memberships for this UID:
   - Collection group query on "members" where uid == decoded.uid
3. Filter to active and pending memberships
4. Determine redirect:
   - No memberships → "/onboarding"
   - All pending → "/pending"
   - One active → set shop context cookie, return "/dashboard"
   - Multiple active + shopId provided → set that shop context, return "/dashboard"
   - Multiple active + no shopId → return "/select-shop"
5. Create session cookie + shop context cookie
```

#### `POST /api/auth/logout`
```
Response 200: { success: true }

Steps:
1. Clear __session cookie
2. Clear __shop_context cookie
```

#### `GET /api/auth/me`
```
Response 200: {
  user: { uid, email, displayName, photoURL },
  shop: { shopId, displayName, shopType, role }
}
```

#### `GET /api/auth/memberships`
```
Response 200: { memberships: ShopMembership[] }

Steps:
1. Verify Firebase session cookie (not shop context — user might not have a shop yet)
2. Collection group query on "members" subcollections where uid == user.uid
3. For each membership, fetch shop doc for displayName
4. Return list
```

### 11.2 Onboarding

#### `POST /api/onboarding/create-studio`
```
Request body: {
  name: string,
  slug: string,
  email: string,
  phone?: string,
  description?: string
}
Response 201: { shop: Shop, membership: ShopMember }

Steps:
1. Verify Firebase session cookie
2. Validate slug (format, uniqueness):
   - Query shops where slug == input → must be empty
3. Create shop doc at shops/{slug}:
   - shopId: slug
   - shopType: "studio"
   - displayName: name
   - slug: slug
   - isActive: false (awaiting superadmin activation)
   - contact: { email, phone }
   - metadata: { description }
   - createdAt: now, updatedAt: now
4. Create membership doc at shops/{slug}/members/{uid}:
   - uid: current user UID
   - email: current user email
   - displayName: current user name
   - photoURL: current user photo
   - role: "owner"
   - status: "pending"
   - requestedAt: now
5. Use batch write for atomicity
```

#### `POST /api/onboarding/request-access`
```
Request body: { shopId: string }
Response 201: { membership: ShopMember }

Steps:
1. Verify Firebase session cookie
2. Verify shop exists: read shops/{shopId}
3. Check user doesn't already have a membership for this shop
4. Create membership doc at shops/{shopId}/members/{uid}:
   - role: "viewer" (default for requests)
   - status: "pending"
   - requestedAt: now
```

### 11.3 Orders

#### `GET /api/orders`
```
Query params:
  ?stage=received
  &source=shopify|studio
  &dateFrom=2026-03-01
  &dateTo=2026-03-20
  &search=john
  &limit=25
  &startAfter=xxx     (cursor pagination)

Response 200: {
  orders: Order[],
  nextCursor: string | null
}

Steps:
1. verifyShopUser() → get shopId
2. Query shops/{shopId}/orders with filters
3. Firestore compound query: stage + createdAt desc (requires index)
4. Search filter applied client-side (customerName/email contains)
5. Return paginated results
```

#### `GET /api/orders/[orderId]`
```
Response 200: {
  order: Order,
  events: OrderEvent[],
  pipeline: Pipeline
}

Steps:
1. verifyShopUser() → get shopId
2. Read shops/{shopId}/orders/{orderId}
3. Verify the order's shopId matches the session shopId (defense in depth)
4. Read events subcollection, ordered by timestamp desc
5. Read pipeline doc
```

#### `POST /api/orders/create`
```
Request body: {
  rawImageUrl: string,          // from prior upload
  designImageUrl: string,       // same as raw for simple upload (no canvas processing)
  sizeInInches: number,
  quantity: number,
  customerName?: string,
  customerEmail?: string,
  notes?: string
}
Response 201: { order: Order }

Steps:
1. verifyShopUser() → get shopId, requireRole("operator")
2. Determine variantGroup from sizeInInches
3. Calculate pricing:
   a. Query shops/{shopId}/pricing/rules where variantGroup matches AND minQty <= qty AND maxQty >= qty
   b. If no match → query pricing/global/rules with same criteria
   c. If still no match → return 400 "No pricing rule found"
4. Build order document:
   - orderId: auto-generated Firestore ID
   - shopId: from session
   - source: "studio"
   - shopifyOrderId: null
   - shopifyOrderNumber: null
   - shopifyLineItemId: null
   - customerName: input or "Studio Order"
   - customerEmail: input or ""
   - sizeInInches: input
   - variantGroup: computed
   - quantity: input
   - productTitle: "Custom Order"
   - designAssets: { rawImageUrl: input, designImageUrl: input, canvasJson: null, thumbnailUrl: null }
   - billingSnapshot: { unitPrice, subtotal, total, currency: "INR", appliedRuleId, ruleSource, calculatedAt }
   - pipelineId: default pipeline ID (from platform_config)
   - currentStageKey: "received"
   - currentStageUpdatedAt: now
   - notes: input or ""
   - createdBy: current user UID
   - createdAt: now, updatedAt: now
5. Batch write:
   a. shops/{shopId}/orders/{orderId} — canonical doc
   b. shops/{shopId}/orders/{orderId}/events/{auto-id} — ORDER_CREATED event
   c. orders_global/{orderId} — projection for superadmin
6. Return created order
```

### 11.4 Pricing

#### `GET /api/pricing`
```
Response 200: {
  effectiveRules: EffectivePricingRule[],
  variantGroups: VariantGroupDef[]
}

Steps:
1. verifyShopUser() → get shopId, requireRole("admin")
2. Read platform_config/settings for variant groups
3. Read shops/{shopId}/pricing/rules (shop overrides)
4. Read pricing/global/rules (global defaults)
5. Merge: for each variantGroup + qty range, prefer shop rule; fallback to global
6. Return merged list with source indicator per rule
```

Each effective rule includes:

```typescript
interface EffectivePricingRule extends PricingRule {
  source: "global" | "shop";     // indicates where this rule came from
}
```

#### `POST /api/pricing/calculate`
```
Request body: { variantGroup: string, quantity: number }
Response 200: {
  unitPrice: number,
  subtotal: number,
  total: number,
  currency: "INR",
  appliedRuleId: string,
  ruleSource: "global" | "shop"
}

Steps:
1. verifyShopUser() → get shopId, requireRole("operator")
2. Find matching rule (shop first, then global)
3. Calculate: subtotal = unitPrice × quantity; total = subtotal
4. Return breakdown
```

### 11.5 Upload

#### `POST /api/upload`
```
Request: multipart/form-data with "file" field
Response 200: { url: string, fileName: string }

Steps:
1. verifyShopUser() → get shopId, requireRole("operator")
2. Validate file:
   - Type: image/png, image/jpeg
   - Max size: 20 MB
3. Generate UUID filename
4. Upload to Firebase Storage: uploads/{shopId}/raw/{uuid}.{ext}
5. Generate token-based download URL
6. Return URL
```

### 11.6 Team

#### `GET /api/team`
```
Response 200: { members: ShopMember[] }

Steps:
1. verifyShopUser() → get shopId, requireRole("admin")
2. Read all docs from shops/{shopId}/members
```

### 11.7 Profile

#### `GET /api/profile`
```
Response 200: { shop: Shop }

Steps:
1. verifyShopUser() → get shopId
2. Read shops/{shopId}
```

#### `PATCH /api/profile`
```
Request body: {
  displayName?: string,
  contact?: Partial<Shop["contact"]>,
  metadata?: Partial<Shop["metadata"]>
}
Response 200: { shop: Shop }

Steps:
1. verifyShopUser() → get shopId, requireRole("admin")
2. Merge update into shops/{shopId}
3. Set updatedAt = now
```

---

## 12. Order Creation & Pricing Logic

### 12.1 Pricing calculation algorithm

```typescript
async function calculateOrderPrice(
  shopId: string,
  variantGroup: string,
  quantity: number
): Promise<PriceCalculation> {
  // Step 1: Try shop-specific pricing
  const shopRules = await adminDb
    .collection("shops").doc(shopId)
    .collection("pricing").doc("rules")
    .collection("items")  // or however rules are structured
    .where("variantGroup", "==", variantGroup)
    .where("minQty", "<=", quantity)
    .where("isActive", "==", true)
    .get();

  let matchedRule = shopRules.docs
    .map(d => d.data() as PricingRule)
    .find(r => quantity >= r.minQty && quantity <= r.maxQty);

  let ruleSource: "shop" | "global" = "shop";

  // Step 2: Fallback to global pricing
  if (!matchedRule) {
    const globalRules = await adminDb
      .collection("pricing").doc("global")
      .collection("rules")
      .where("variantGroup", "==", variantGroup)
      .where("minQty", "<=", quantity)
      .where("isActive", "==", true)
      .get();

    matchedRule = globalRules.docs
      .map(d => d.data() as PricingRule)
      .find(r => quantity >= r.minQty && quantity <= r.maxQty);

    ruleSource = "global";
  }

  // Step 3: No rule found
  if (!matchedRule) {
    throw new PricingError("No pricing rule found for this variant group and quantity");
  }

  // Step 4: Calculate
  const unitPrice = matchedRule.unitPrice;      // in paisa
  const subtotal = unitPrice * quantity;
  const total = subtotal;                       // no taxes/discounts for now

  return {
    unitPrice,
    subtotal,
    total,
    currency: "INR" as const,
    appliedRuleId: matchedRule.ruleId,
    ruleSource,
  };
}
```

### 12.2 Variant group derivation

```typescript
function deriveVariantGroup(sizeInInches: number, variantGroups: VariantGroupDef[]): string {
  for (const group of variantGroups) {
    if (group.sizes.includes(sizeInInches)) {
      return group.key;
    }
  }
  throw new Error(`Size ${sizeInInches} does not belong to any variant group`);
}
```

### 12.3 Writing the orders_global projection on studio order create

When a shop user creates a studio order, the API also writes to `orders_global/{orderId}` so the superadmin can see it immediately. This is the same dual-write pattern used by the Shopify webhook handler.

```typescript
// Inside POST /api/orders/create handler, as part of the batch write:

const projRef = adminDb.collection("orders_global").doc(orderId);
batch.set(projRef, {
  orderId,
  shopId,
  shopDisplayName: session.shopDisplayName,
  shopType: shopDoc.shopType,
  source: "studio",
  variantGroup: order.variantGroup,
  sizeInInches: order.sizeInInches,
  quantity: order.quantity,
  productTitle: "Custom Order",
  currentStageKey: "received",
  currentStageUpdatedAt: FieldValue.serverTimestamp(),
  pipelineId: order.pipelineId,
  billingTotal: order.billingSnapshot.total,
  currency: "INR",
  customerName: order.customerName,
  customerEmail: order.customerEmail,
  designThumbnailUrl: order.designAssets.designImageUrl,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});
```

---

## 13. Firestore Indexes

In addition to indexes defined in `superadmin-dashboard.md`, the shop dashboard requires these composite indexes for shop-scoped queries:

```json
{
  "indexes": [
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "currentStageKey", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "source", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "rules",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "variantGroup", "order": "ASCENDING" },
        { "fieldPath": "minQty", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "members",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

These are in addition to the superadmin indexes. All indexes should be consolidated into a single `firestore.indexes.json` and deployed together.

---

## 14. UI Component Library

Same design system as the superadmin dashboard (Tailwind CSS 4, hand-written components). The `src/components/ui/` directory can be copied directly.

### Additional component: `file-upload.tsx`

```typescript
// Drag-and-drop file upload zone for order creation
interface FileUploadProps {
  accept: string;                    // e.g., "image/png,image/jpeg"
  maxSizeMB: number;                 // e.g., 20
  onUpload: (file: File) => Promise<string>;  // returns URL
  preview?: string;                  // current preview URL
  onRemove?: () => void;
}
```

**Appearance:**
- Dashed border box (200px tall)
- Upload icon + "Drag and drop or click to upload" text
- File type + size constraints shown below
- After upload: shows image preview, file name, file size, "Remove" button
- During upload: progress bar overlay

### Sidebar navigation items (shop dashboard):

| Icon | Label | Path | Min Role |
|------|-------|------|----------|
| LayoutDashboard | Dashboard | `/dashboard` | viewer |
| Package | Orders | `/orders` | viewer |
| PlusCircle | Create Order | `/orders/create` | operator |
| IndianRupee | Pricing | `/pricing` | admin |
| Users | Team | `/team` | admin |
| User | Profile | `/profile` | viewer |

### Design differences from superadmin:
- Primary color: use a different shade (e.g., indigo `#4F46E5` instead of blue `#2563EB`) to visually distinguish from superadmin
- Topbar shows: shop name + type badge, user avatar, "Switch Shop" button (if multi-shop), sign out
- No "Shops" navigation (shop dashboard is single-shop scoped)

---

## 15. State Management & Data Fetching

Same patterns as `superadmin-dashboard.md` section 15:

- **Server Components** for initial data loading (orders list, pricing, profile)
- **Client Components** (`"use client"`) for interactive UI (filters, forms, file upload)
- **SWR** for client-side data fetching and revalidation
- **`revalidatePath()`** after mutations (order creation)

### Specific data fetching patterns:

**Orders list page:**
```typescript
// Server component fetches initial data
export default async function OrdersPage({ searchParams }: Props) {
  const session = await verifyShopUser();
  const { orders, nextCursor } = await getShopOrders(session.shopId, searchParams);
  const pipeline = await getDefaultPipeline();
  return <OrdersPageClient orders={orders} pipeline={pipeline} nextCursor={nextCursor} />;
}
```

**Order creation form (client component):**
```typescript
// Client component with local state + API calls
"use client";

// 1. File upload → POST /api/upload → get URL
// 2. Size selection → local state
// 3. Quantity input → local state
// 4. Price calculation → POST /api/pricing/calculate (on size/qty change, debounced)
// 5. Submit → POST /api/orders/create
```

---

## 16. Error Handling

Same patterns as `superadmin-dashboard.md` section 16:

- **API routes:** try/catch with typed error responses
- **Client-side:** `sonner` toasts for success/error feedback
- **Form validation:** inline error messages below fields
- **Auth errors:** redirect to `/login` with error query param

### Shop-specific error cases:

| Scenario | Handling |
|----------|----------|
| Membership revoked mid-session | `verifyShopUser()` re-checks membership → 401 → redirect to `/pending` |
| Shop deactivated by superadmin | `verifyShopUser()` checks `shop.isActive` → show "Shop Inactive" page |
| No pricing rule for size/qty | Show warning in order form, disable submit button |
| File upload exceeds 20 MB | Client-side validation before upload, server-side validation as backup |
| Firestore quota/timeout | Retry with exponential backoff, show error toast |

---

## 17. Deployment to Vercel

### 17.1 Project setup

```bash
npx create-next-app@latest shop-admin-dashboard --typescript --tailwind --app --src-dir
cd shop-admin-dashboard
npm install firebase firebase-admin swr sonner lucide-react clsx
```

### 17.2 Vercel configuration

1. Connect Git repo to Vercel (separate Vercel project from superadmin)
2. Root directory: `shop-admin-dashboard/`
3. Framework preset: Next.js
4. Add environment variables (same Firebase project, different app URL)
5. Deploy

### 17.3 Domain

Set up a custom domain like `dashboard.inklabs.in` (or `app.inklabs.in`) for the shop-facing dashboard.

### 17.4 Build settings

Same as superadmin: `next build`, Node.js 20.x.

---

## 18. Dependencies

### `package.json` (key dependencies)

```json
{
  "dependencies": {
    "next": "^15.2",
    "react": "^19.0",
    "react-dom": "^19.0",
    "firebase": "^11.4",
    "firebase-admin": "^13.0",
    "swr": "^2.3",
    "sonner": "^2.0",
    "lucide-react": "^0.474",
    "clsx": "^2.1",
    "tailwind-merge": "^3.0",
    "uuid": "^11.0"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "@types/node": "^22.0",
    "@types/react": "^19.0",
    "@types/react-dom": "^19.0",
    "tailwindcss": "^4.0",
    "@tailwindcss/postcss": "^4.0",
    "eslint": "^9.0",
    "eslint-config-next": "^15.2"
  }
}
```

Note: `uuid` is used for generating unique filenames during upload.

---

## Implementation Order

Recommended build sequence:

| Phase | What to build | Depends on |
|-------|--------------|-----------|
| 1 | Firebase SDK setup + Google auth flow (login page, session cookies) | Nothing |
| 2 | Membership query + routing logic (onboarding vs pending vs dashboard) | Phase 1 |
| 3 | Onboarding flow: create studio + request access | Phase 2 |
| 4 | Pending approval page with polling | Phase 2 |
| 5 | Shop selector (multi-shop) | Phase 2 |
| 6 | Dashboard layout (sidebar, topbar, page structure) | Phase 2 |
| 7 | Dashboard overview page (stats, recent orders) | Phase 6 |
| 8 | Orders list page with filters and pagination | Phase 6 |
| 9 | Order detail page with event timeline | Phase 8 |
| 10 | File upload API endpoint | Phase 6 |
| 11 | Order creation form (upload + size + qty + pricing) | Phase 8 + 10 |
| 12 | Pricing view page | Phase 6 |
| 13 | Team page | Phase 6 |
| 14 | Profile page with shop editing | Phase 6 |
| 15 | Polish: responsive design, loading states, empty states, error handling | All |

---

## Cross-App Data Flow Summary

```
                    Shopify Storefront
                          │
                    (customer places order)
                          │
                          ▼
              ┌───────────────────────┐
              │ inkcanvas-customizer  │
              │ (Shopify App)         │
              │                       │
              │ Webhook: orders/create│
              │ ┌───────────────────┐ │
              │ │ Dual-write:       │ │
              │ │ 1. orders/{id}    │ │  ← legacy flat collection
              │ │ 2. shops/{s}/     │ │  ← new nested structure
              │ │    orders/{id}    │ │
              │ │ 3. orders_global/ │ │  ← superadmin projection
              │ │    {id}           │ │
              │ └───────────────────┘ │
              └───────────┬───────────┘
                          │
                    writes to Firestore
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Shop         │  │ orders_global│  │ orders       │
│ Dashboard    │  │ (projection) │  │ (legacy)     │
│              │  │              │  │              │
│ Reads:       │  │ Read by:     │  │ Read by:     │
│ shops/{s}/   │  │ Superadmin   │  │ inkcanvas-   │
│  orders/{id} │  │ Dashboard    │  │ customizer   │
│              │  │              │  │ (existing)   │
│ Creates:     │  │              │  │              │
│ studio orders│  │              │  │              │
│ (also writes │  │              │  │              │
│  to orders_  │  │              │  │              │
│  global)     │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
        │                 ▲
        │                 │
        │         ┌───────┴────────┐
        │         │  Superadmin    │
        │         │  Dashboard     │
        │         │                │
        │         │  Reads:        │
        │         │  orders_global │
        │         │  All shops     │
        │         │                │
        │         │  Writes:       │
        │         │  Stage changes │──── also updates orders_global
        │         │  Pricing rules │
        │         │  Pipelines     │
        │         │  Members       │
        │         └────────────────┘
        │
        └── reads pipeline stages for display (read-only)
```
