import { adminDb } from "@/lib/firebase-admin";
import type { Pipeline } from "./types";

export async function getPipeline(
  pipelineId: string
): Promise<Pipeline | null> {
  const doc = await adminDb.collection("pipelines").doc(pipelineId).get();
  if (!doc.exists) return null;
  return { ...doc.data(), pipelineId: doc.id } as Pipeline;
}

export async function getDefaultPipeline(): Promise<Pipeline | null> {
  // Try to get default pipeline ID from platform config
  try {
    const configDoc = await adminDb
      .collection("platform_config")
      .doc("settings")
      .get();

    if (configDoc.exists && configDoc.data()?.defaultPipelineId) {
      return getPipeline(configDoc.data()!.defaultPipelineId);
    }
  } catch {
    // ignore
  }

  // Fallback: get the first pipeline marked as default
  try {
    const snap = await adminDb
      .collection("pipelines")
      .where("isDefault", "==", true)
      .limit(1)
      .get();

    if (!snap.empty) {
      return {
        ...snap.docs[0].data(),
        pipelineId: snap.docs[0].id,
      } as Pipeline;
    }
  } catch {
    // ignore
  }

  return null;
}
