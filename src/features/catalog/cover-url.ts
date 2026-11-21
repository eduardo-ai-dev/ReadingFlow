import type { Edition } from "@/lib/domain";

/**
 * Selo e logs de diagnóstico de capa só são habilitados quando o desenvolvedor
 * define explicitamente `NEXT_PUBLIC_COVER_DEBUG=1` fora de produção.
 */
export function isCoverDebugEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_COVER_DEBUG === "1"
  );
}

const PRIVATE_COVER_ROUTE_PATTERN =
  /^\/api\/covers\/file\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

/**
 * Indica se a URL aponta para a rota privada autenticada de entrega de capas
 * (`/api/covers/file/{userId}/{editionId}/{fileName}`).
 */
export function isPrivateCoverRouteUrl(url?: string | null): boolean {
  if (!url) return false;
  return PRIVATE_COVER_ROUTE_PATTERN.test(url.trim());
}

/**
 * Regra canônica de proteção de capa escolhida pelo usuário:
 * nenhum backfill ou job automático pode alterar uma edição com `coverLocked === true`.
 */
export function canAutoUpdateEditionCover(
  edition?: Pick<Edition, "coverLocked"> | null
): boolean {
  return !edition?.coverLocked;
}

/**
 * Helper único para normalizar e ler exclusivamente a `cover_url` persistida
 * de uma edição (sem disparar buscas em rede durante a exibição).
 */
export function resolvePersistedCoverUrl(
  edition?: Pick<Edition, "coverUrl"> | null
): string | undefined {
  const raw = edition?.coverUrl?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

/**
 * Indexa edições por `workId` em O(N) para evitar varreduras lineares O(N²)
 * ao resolver capas para centenas ou milhares de livros.
 */
export function indexEditionsByWorkId(
  editions: readonly Edition[]
): Map<string, Edition[]> {
  const map = new Map<string, Edition[]>();
  for (const ed of editions) {
    const list = map.get(ed.workId);
    if (list) {
      list.push(ed);
    } else {
      map.set(ed.workId, [ed]);
    }
  }
  return map;
}

/**
 * Resolve a edição canônica de uma obra para exibição consistente da capa persistida
 * entre Painel, Estante 3D, Ficha Rápida, Leitura e Lista de Desejos.
 *
 * Se a edição preferida ainda não tiver `coverUrl`, herda a `coverUrl` persistida
 * de outra edição da mesma obra (`workId`) para eliminar divergências entre telas.
 */
export function resolveWorkCoverEdition(params: {
  workId: string;
  preferredEditionId?: string | null;
  editions: readonly Edition[];
  editionsById?: ReadonlyMap<string, Edition>;
  editionsByWorkId?: ReadonlyMap<string, readonly Edition[]>;
}): Edition | undefined {
  const {
    workId,
    preferredEditionId,
    editions,
    editionsById,
    editionsByWorkId,
  } = params;
  const preferred = preferredEditionId
    ? (editionsById?.get(preferredEditionId) ??
      editions.find((e) => e.id === preferredEditionId))
    : undefined;

  if (preferred && resolvePersistedCoverUrl(preferred)) {
    return preferred;
  }

  const workEditions = editionsByWorkId ? editionsByWorkId.get(workId) : null;
  const siblingWithCover = workEditions
    ? workEditions.find((e) => Boolean(resolvePersistedCoverUrl(e)))
    : editions.find(
        (e) => e.workId === workId && Boolean(resolvePersistedCoverUrl(e))
      );

  if (preferred) {
    if (!siblingWithCover) return preferred;
    return {
      ...preferred,
      coverUrl: siblingWithCover.coverUrl,
      coverSource: preferred.coverSource ?? siblingWithCover.coverSource,
      coverColor: preferred.coverColor ?? siblingWithCover.coverColor,
      coverAccentColor:
        preferred.coverAccentColor ?? siblingWithCover.coverAccentColor,
    };
  }

  return (
    siblingWithCover ??
    (workEditions ? workEditions[0] : editions.find((e) => e.workId === workId))
  );
}
