import { NextResponse, type NextRequest } from "next/server";
import {
  getAuthenticatedWorkspace,
  readUserUploadedCover,
} from "@/server/store/memory-repository";

type RouteParams = {
  params: Promise<{
    userId: string;
    editionId: string;
    fileName: string;
  }>;
};

/**
 * Entrega autenticada e privada de capas enviadas pelo próprio usuário.
 * - Valida sessão ativa (401) e propriedade exclusiva da pasta `{userId}` (403).
 * - Responde com `Cache-Control: private` + `ETag` para URL estável e cache seguro no navegador.
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const ws = await getAuthenticatedWorkspace();
  if (!ws) {
    return NextResponse.json(
      { error: "Sessão não autenticada." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const { userId, editionId, fileName } = await context.params;
  if (ws.profile.id !== userId) {
    return NextResponse.json(
      { error: "Acesso negado a arquivo de capa de outro usuário." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const record = readUserUploadedCover(ws, userId, editionId, fileName);
  if (!record) {
    return NextResponse.json(
      { error: "Arquivo de capa não encontrado." },
      { status: 404, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === record.etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: record.etag,
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const binary = Buffer.from(record.bytesBase64, "base64");
  return new NextResponse(binary, {
    status: 200,
    headers: {
      "Content-Type": record.mimeType,
      "Content-Length": String(binary.byteLength),
      ETag: record.etag,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
