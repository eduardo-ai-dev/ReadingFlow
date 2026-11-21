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
}): Edition | undefined {
  const { workId, preferredEditionId, editions, editionsById } = params;
  const preferred = preferredEditionId
    ? (editionsById?.get(preferredEditionId) ??
      editions.find((e) => e.id === preferredEditionId))
    : undefined;

  if (preferred && resolvePersistedCoverUrl(preferred)) {
    return preferred;
  }

  const siblingWithCover = editions.find(
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

  return siblingWithCover ?? editions.find((e) => e.workId === workId);
}
