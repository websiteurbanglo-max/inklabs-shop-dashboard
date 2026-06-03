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
