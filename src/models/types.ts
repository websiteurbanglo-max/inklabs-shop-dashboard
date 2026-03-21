import type { Timestamp } from "firebase-admin/firestore";

// ─── Shop ────────────────────────────────────────────────────────────────────

export interface Shop {
  shopId: string;
  shopType: "shopify" | "studio";
  displayName: string;
  slug: string;
  isActive: boolean;
  logoUrl?: string;
  contact: {
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  metadata?: {
    description?: string;
    website?: string;
    [key: string]: unknown;
  };
  defaultPipelineId?: string;
  createdAt: Timestamp | Date | string;
  updatedAt: Timestamp | Date | string;
}

// ─── Shop Member ─────────────────────────────────────────────────────────────

export type MemberRole = "owner" | "admin" | "operator" | "viewer";
export type MemberStatus = "active" | "pending" | "suspended";

export interface ShopMember {
  uid: string;
  shopId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: MemberRole;
  status: MemberStatus;
  requestedAt: Timestamp | Date | string;
  approvedAt?: Timestamp | Date | string;
  approvedBy?: string;
}

// ─── Order ───────────────────────────────────────────────────────────────────

export type OrderSource = "shopify" | "studio";

export interface DesignAssets {
  rawImageUrl?: string;
  designImageUrl?: string;
  canvasJson?: string | null;
  thumbnailUrl?: string | null;
}

export interface BillingSnapshot {
  unitPrice: number; // in paisa
  subtotal: number; // in paisa
  total: number; // in paisa
  currency: "INR";
  appliedRuleId?: string;
  ruleSource?: "global" | "shop";
  calculatedAt: Timestamp | Date | string;
}

export interface Order {
  orderId: string;
  shopId: string;
  source: OrderSource;
  shopifyOrderId?: string | null;
  shopifyOrderNumber?: string | null;
  shopifyLineItemId?: string | null;
  customerName: string;
  customerEmail?: string;
  productTitle: string;
  sizeInInches: number;
  variantGroup: string;
  quantity: number;
  designAssets: DesignAssets;
  billingSnapshot: BillingSnapshot;
  pipelineId: string;
  currentStageKey: string;
  currentStageUpdatedAt: Timestamp | Date | string;
  notes?: string;
  createdBy?: string;
  createdAt: Timestamp | Date | string;
  updatedAt: Timestamp | Date | string;
}

// ─── Order Event ─────────────────────────────────────────────────────────────

export type OrderEventType =
  | "ORDER_CREATED"
  | "STATUS_CHANGED"
  | "NOTE_ADDED"
  | "FILE_UPLOADED"
  | "PAYMENT_UPDATED";

export interface OrderEvent {
  eventId: string;
  orderId: string;
  shopId: string;
  type: OrderEventType;
  description: string;
  fromStageKey?: string;
  toStageKey?: string;
  performedBy?: string;
  performedByName?: string;
  metadata?: Record<string, unknown>;
  timestamp: Timestamp | Date | string;
}

// ─── Pricing Rule ────────────────────────────────────────────────────────────

export interface PricingRule {
  ruleId: string;
  shopId?: string; // undefined for global rules
  variantGroup: string;
  minQty: number;
  maxQty: number;
  unitPrice: number; // in paisa
  isActive: boolean;
  createdAt: Timestamp | Date | string;
  updatedAt: Timestamp | Date | string;
}

export interface EffectivePricingRule extends PricingRule {
  source: "global" | "shop";
}

// ─── Price Calculation ───────────────────────────────────────────────────────

export interface PriceCalculation {
  unitPrice: number; // in paisa
  subtotal: number; // in paisa
  total: number; // in paisa
  currency: "INR";
  appliedRuleId: string;
  ruleSource: "global" | "shop";
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

export interface PipelineStage {
  key: string;
  label: string;
  color: string;
  order: number;
  isTerminal?: boolean;
}

export interface Pipeline {
  pipelineId: string;
  name: string;
  stages: PipelineStage[];
  isDefault: boolean;
  createdAt: Timestamp | Date | string;
  updatedAt: Timestamp | Date | string;
}

// ─── Shop Session ────────────────────────────────────────────────────────────

export interface ShopSession {
  uid: string;
  email: string;
  shopId: string;
  role: MemberRole;
  shopDisplayName: string;
}

// ─── Shop Membership (for listing/selection) ─────────────────────────────────

export interface ShopMembership {
  shopId: string;
  shopName: string;
  shopType: "shopify" | "studio";
  logoUrl?: string;
  role: MemberRole;
  status: MemberStatus;
  requestedAt?: string;
}

// ─── Variant Group ───────────────────────────────────────────────────────────

export interface VariantGroupDef {
  key: string;
  label: string;
  sizes: number[]; // sizes in inches
}

// ─── Platform Config ─────────────────────────────────────────────────────────

export interface PlatformConfig {
  defaultPipelineId: string;
  variantGroups: VariantGroupDef[];
  [key: string]: unknown;
}
