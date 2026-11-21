import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedWorkspace } from "@/server/store/memory-repository";
import { createPortableBackupJson } from "@/features/portability/rules";
import { serializeRowsToSafeCsv } from "@/server/security/csv";
import { formatDateInTimezone } from "@/lib/dates";

const exportQuerySchema = z.object({
  format: z
    .enum(["json", "csv", "template"], {
      error:
        "Formato de exportação inválido. Utilize 'json', 'csv' ou 'template'.",
    })
    .default("json"),
  entity: z
    .enum(["all", "books", "readings", "wishlist"], {
      error:
        "Entidade de exportação inválida. Utilize 'all', 'books', 'readings' ou 'wishlist'.",
    })
    .default("all"),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const queryParams = {
    format: request.nextUrl.searchParams.get("format") ?? "json",
    entity: request.nextUrl.searchParams.get("entity") ?? "all",
  };

  const parsed = exportQuerySchema.safeParse(queryParams);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Parâmetros de rota inválidos.",
      },
      { status: 400 }
    );
  }

  const { format, entity } = parsed.data;

  if (format === "template") {
    const csvTemplate = serializeRowsToSafeCsv(
      [
        "titulo",
        "autor",
        "isbn13",
        "formato",
        "paginas",
        "estado",
        "concluido_em",
        "nota",
      ],
      [
        [
          "Memórias Póstumas de Brás Cubas",
          "Machado de Assis",
          "9788535911664",
          "paperback",
          "368",
          "finished",
          "2026-08-15",
          "5",
        ],
      ]
    );
    return new NextResponse(csvTemplate, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="readingflow-modelo-importacao.csv"',
      },
    });
  }

  const ws = await getAuthenticatedWorkspace();
  if (!ws) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const dateStamp = formatDateInTimezone(new Date(), ws.profile.timezone);
  const privateCacheHeader = { "Cache-Control": "private, no-store" };

  if (format === "csv") {
    const worksById = new Map(ws.works.map((w) => [w.id, w]));
    const editionsById = new Map(ws.editions.map((e) => [e.id, e]));
    const shelvesById = new Map(ws.shelves.map((s) => [s.id, s]));
    const reviewsByWorkId = new Map(ws.reviews.map((r) => [r.workId, r]));

    // Exportação específica por entidade ou padrão de livros
    if (entity === "readings") {
      const headers = [
        "id_obra",
        "titulo",
        "formato",
        "estado",
        "iniciado_em",
        "concluido_em",
        "progresso_unidade",
        "progresso_valor",
      ];
      const rows = ws.readings.map((r) => {
        const work = worksById.get(r.workId);
        return [
          r.workId,
          work?.title ?? "",
          r.format,
          r.status,
          r.startedOn ?? "",
          r.finishedOn ?? "",
          r.progressUnit,
          String(r.progressValue),
        ];
      });
      const csv = serializeRowsToSafeCsv(headers, rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          ...privateCacheHeader,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="readingflow-leituras-${dateStamp}.csv"`,
        },
      });
    }

    if (entity === "wishlist") {
      const headers = [
        "id_desejo",
        "titulo",
        "prioridade",
        "preco_alvo",
        "moeda",
        "notas",
      ];
      const rows = ws.wishlist.map((w) => {
        const work = worksById.get(w.workId);
        return [
          w.id,
          work?.title ?? "",
          String(w.priority),
          w.targetPrice ? String(w.targetPrice) : "",
          w.currency,
          w.notes ?? "",
        ];
      });
      const csv = serializeRowsToSafeCsv(headers, rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          ...privateCacheHeader,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="readingflow-desejos-${dateStamp}.csv"`,
        },
      });
    }

    // Padrão: livros
    const rows = ws.items.map((item) => {
      const edition = editionsById.get(item.editionId);
      const work = edition ? worksById.get(edition.workId) : undefined;
      const shelf = shelvesById.get(item.shelfId);
      const primaryAuthor =
        work?.contributors.find((c) => c.role === "author")?.name ?? "";
      const review = work ? reviewsByWorkId.get(work.id) : undefined;

      return [
        work?.title ?? edition?.title ?? "Sem título",
        primaryAuthor,
        edition?.isbn13 ?? "",
        edition?.format ?? "paperback",
        shelf?.name ?? "Estante",
        item.status,
        edition?.pages ? String(edition.pages) : "",
        item.pricePaid !== undefined ? String(item.pricePaid) : "",
        item.currency,
        item.notes ?? "",
        review?.rating ? String(review.rating) : "",
      ];
    });

    const headers = [
      "titulo",
      "autor",
      "isbn13",
      "formato",
      "estante",
      "posse",
      "paginas",
      "preco_pago",
      "moeda",
      "notas",
      "avaliacao",
    ];

    const csvContent = serializeRowsToSafeCsv(headers, rows);
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        ...privateCacheHeader,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="readingflow-livros-${dateStamp}.csv"`,
      },
    });
  }

  // Backup JSON completo e restaurável
  const backupJson = createPortableBackupJson({
    exportedAtIso: new Date().toISOString(),
    state: {
      works: ws.works,
      editions: ws.editions,
      items: ws.items,
      readings: ws.readings,
      reviews: ws.reviews,
      goals: ws.goals,
      wishlist: ws.wishlist,
      shelves: ws.shelves,
    },
  });
  return new NextResponse(backupJson, {
    status: 200,
    headers: {
      ...privateCacheHeader,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="readingflow-backup-${dateStamp}.json"`,
    },
  });
}
