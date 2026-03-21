import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { verifyShopUser, requireRole, handleAuthError } from "@/lib/auth";
import { adminStorage } from "@/lib/firebase-admin";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

export async function POST(request: NextRequest) {
  try {
    const session = await verifyShopUser();
    requireRole(session, "operator");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        {
          error: "Invalid file type. Only PNG and JPEG images are allowed.",
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "File too large. Maximum size is 20 MB." },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.type === "image/png" ? "png" : "jpg";
    const uuid = uuidv4();
    const fileName = `${uuid}.${ext}`;
    const storagePath = `uploads/${session.shopId}/raw/${fileName}`;

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Firebase Storage
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(storagePath);

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          uploadedBy: session.uid,
          shopId: session.shopId,
          originalName: file.name,
        },
      },
    });

    // Generate a signed URL (7 days)
    const [signedUrl] = await fileRef.getSignedUrl({
      action: "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Also make the file publicly accessible
    await fileRef.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    return Response.json({
      url: publicUrl,
      signedUrl,
      fileName,
      storagePath,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
