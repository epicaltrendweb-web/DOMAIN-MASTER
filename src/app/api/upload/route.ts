import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";

const UPLOAD_DIR = "/home/z/my-project/upload";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "No se recibió ningún archivo" },
        { status: 400 }
      );
    }

    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = join(UPLOAD_DIR, safeName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    return NextResponse.json({
      ok: true,
      name: safeName,
      originalName: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      path: filePath,
      savedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "POST multipart/form-data con campo 'file'",
  });
}
