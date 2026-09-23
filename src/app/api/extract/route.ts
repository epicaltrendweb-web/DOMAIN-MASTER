import { NextResponse } from "next/server";
import { existsSync, statSync, readdirSync } from "fs";
import { join, extname } from "path";

export const runtime = "nodejs";

const UPLOAD_DIR = "/home/z/my-project/upload";

type Entry = {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  ext: string;
};

function walk(dir: string, base = ""): Entry[] {
  const out: Entry[] = [];
  let items: string[];
  try {
    items = readdirSync(dir);
  } catch {
    return out;
  }
  for (const item of items) {
    const full = join(dir, item);
    const rel = base ? `${base}/${item}` : item;
    try {
      const st = statSync(full);
      if (st.isDirectory()) {
        out.push({
          name: rel,
          path: full,
          size: st.size,
          isDir: true,
          ext: "",
        });
        out.push(...walk(full, rel));
      } else {
        out.push({
          name: rel,
          path: full,
          size: st.size,
          isDir: false,
          ext: extname(item).toLowerCase().slice(1),
        });
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name: string | undefined = body?.name;
    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Falta el nombre del archivo" },
        { status: 400 }
      );
    }

    const zipPath = join(UPLOAD_DIR, name);
    if (!existsSync(zipPath)) {
      return NextResponse.json(
        { ok: false, error: `No existe ${zipPath}` },
        { status: 404 }
      );
    }

    const targetDir = join(UPLOAD_DIR, `${name}.extracted`);

    // Usar unzip nativo si es zip, si no solo listamos el archivo.
    const ext = extname(name).toLowerCase();
    const isZip = ext === ".zip";

    let entries: Entry[] = [];

    if (isZip) {
      // Intentar extraer con el binario del sistema (más confiable en sandbox)
      const { exec } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(exec);

      try {
        // Limpiar si ya existe
        try {
          await execAsync(`rm -rf "${targetDir}"`);
        } catch {
          /* ignore */
        }
        await execAsync(`mkdir -p "${targetDir}"`);
        const { stdout, stderr } = await execAsync(
          `unzip -o -q "${zipPath}" -d "${targetDir}"`
        );
        if (stderr) {
          console.log("unzip stderr:", stderr);
        }
        entries = walk(targetDir);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json(
          {
            ok: false,
            error: `unzip falló: ${msg}. ¿Está instalado unzip?`,
            zipPath,
            targetDir,
          },
          { status: 500 }
        );
      }
    } else {
      // No es zip, solo devolvemos el archivo como única entrada
      const st = statSync(zipPath);
      entries = [
        {
          name,
          path: zipPath,
          size: st.size,
          isDir: false,
          ext: ext.slice(1),
        },
      ];
    }

    const totalFiles = entries.filter((e) => !e.isDir).length;
    const totalSize = entries.reduce((acc, e) => acc + e.size, 0);

    return NextResponse.json({
      ok: true,
      name,
      zipPath,
      targetDir,
      totalFiles,
      totalSize,
      entries: entries.slice(0, 200), // límite para la respuesta
      truncated: entries.length > 200,
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
    endpoint: "POST JSON { name: 'archivo.zip' } para extraer y listar",
  });
}
