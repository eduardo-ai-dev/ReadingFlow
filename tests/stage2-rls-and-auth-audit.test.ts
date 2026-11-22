import fs from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";

const cookieJar = new Map<string, string>();
let mockHeadersMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
  headers: async () => ({
    get: (name: string) => mockHeadersMap.get(name.toLowerCase()) ?? null,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  signInWithEmailAction,
  signOutAction,
  signUpAction,
} from "@/features/auth/actions";
import {
  addBookToLibraryAction,
  updateEditionCoverAction,
} from "@/features/catalog/actions";
import { getAllEnrichedItems } from "@/features/shelves/queries";
import { GET as getPrivateCoverRoute } from "@/app/api/covers/file/[userId]/[editionId]/[fileName]/route";
import { GET as getExportRoute } from "@/app/api/export/route";
import { GET as getSessionRoute } from "@/app/api/session/route";
import { GET as getSuggestionsRoute } from "@/app/api/suggestions/route";
import { GET as getCoverSearchRoute } from "@/app/api/covers/search/route";
import {
  SESSION_COOKIE_NAME,
  getMemoryStore,
} from "@/server/store/memory-repository";
import { truncateIpForLog } from "@/server/security/secrets";
import { subscribeAuthLogSink } from "@/server/security/auth-logger";
import { resetAllAuthThrottleStateForTests } from "@/server/security/auth-throttle";

let sampleCoverDataUrl = "";

beforeAll(async () => {
  const buf = await sharp({
    create: {
      width: 120,
      height: 180,
      channels: 3,
      background: { r: 114, g: 47, b: 62 },
    },
  })
    .webp({ quality: 80 })
    .toBuffer();
  sampleCoverDataUrl = `data:image/webp;base64,${buf.toString("base64")}`;
});

async function registerUser(prefix: string, password: string) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
  cookieJar.clear();
  const res = await signUpAction({
    displayName: `Usuário ${prefix}`,
    email,
    password,
    acceptTerms: true,
    confirmMinimumAge16: true,
  });
  expect(res.ok).toBe(true);
  const store = getMemoryStore();
  const userId = store.userIdByEmail.get(email)!;
  const sessionCookie = cookieJar.get(SESSION_COOKIE_NAME)!;
  return { email, password, userId, sessionCookie };
}

describe("Etapa 2 — Auditoria RLS SQL, isolamento A/B na API, persistência de capa pós-logout/dispositivo e logs com IP truncado", () => {
  beforeEach(() => {
    cookieJar.clear();
    mockHeadersMap = new Map();
    resetAllAuthThrottleStateForTests();
    process.env.AUTH_MIN_RESPONSE_MS = "0";
    process.env.AUTH_RESPONSE_JITTER_MS = "0";
    process.env.AUTH_HIBP_CHECK_ENABLED = "false";
    process.env.AUTH_REQUIRE_EMAIL_CONFIRMATION = "false";
  });

  it("valida migração canônica SQL: user_id + cascata + RLS (select auth.uid()) + índices + FK composta em shelf_books + user_settings + cover_locked", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20261122000000_user_data_rls_cover_lock_and_settings.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    const requiredTables = [
      "profiles",
      "works",
      "editions",
      "shelves",
      "library_items",
      "shelf_books",
      "readings",
      "reviews",
      "goals",
      "wishlist",
      "user_settings",
    ];
    for (const tbl of requiredTables) {
      expect(sql).toContain(`'${tbl}'`);
      expect(sql).toContain(`idx_${tbl}_user_id`);
    }

    expect(sql).toMatch(
      /user_id UUID NOT NULL DEFAULT auth\.uid\(\) REFERENCES auth\.users\(id\) ON DELETE CASCADE/i
    );
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("USING (user_id = (select auth.uid()))");
    expect(sql).toContain("WITH CHECK (user_id = (select auth.uid()))");
    expect(sql).toMatch(
      /FOREIGN KEY \(book_id, user_id\)\s+REFERENCES public\.editions \(id, user_id\)/i
    );
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.user_settings \(\s*user_id UUID PRIMARY KEY DEFAULT auth\.uid\(\) REFERENCES auth\.users\(id\) ON DELETE CASCADE/i
    );
    expect(sql).toContain("cover_locked BOOLEAN NOT NULL DEFAULT FALSE");
    expect(sql).toContain("trg_guard_locked_edition_cover");

    const rlsTestSql = fs.readFileSync(
      path.join(process.cwd(), "supabase/tests/rls_two_users_isolation.sql"),
      "utf8"
    );
    expect(rlsTestSql).toContain("request.jwt.claim.sub");
    expect(rlsTestSql).toContain("shelf_books");
  });

  it("garante isolamento total A/B nas rotas API, Cache-Control private/no-store e persistência de capa travada após logout e login em outro dispositivo sem buscas na abertura", async () => {
    const pwdA = "SenhaSeguraEtapa2-Alpha!";
    const pwdB = "SenhaSeguraEtapa2-Bravo!";

    const userA = await registerUser("etapa2-a", pwdA);
    cookieJar.set(SESSION_COOKIE_NAME, userA.sessionCookie);

    const added = await addBookToLibraryAction({
      title: "Memórias Póstumas de Brás Cubas",
      primaryAuthor: "Machado de Assis",
      format: "hardcover",
      pages: 320,
      coverUrl: sampleCoverDataUrl,
      coverSource: "upload",
      skipAutoCover: true,
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const initialItemsA = await getAllEnrichedItems();
    expect(initialItemsA).toHaveLength(1);
    const persistedCoverUrl = initialItemsA[0]!.edition.coverUrl!;
    expect(initialItemsA[0]!.edition.coverLocked).toBe(true);
    expect(persistedCoverUrl).toMatch(
      new RegExp(`^/api/covers/file/${userA.userId}/${added.editionId}/`)
    );

    // 1. Logout completo de A (simula encerrar dispositivo 1)
    await signOutAction();
    cookieJar.clear();

    // 2. Novo login de A em "outro dispositivo" (sem cookie anterior, nova sessão)
    const reloginA = await signInWithEmailAction({
      email: userA.email,
      password: pwdA,
      rememberMe: false,
    });
    expect(reloginA.ok).toBe(true);
    const device2SessionA = cookieJar.get(SESSION_COOKIE_NAME)!;
    expect(device2SessionA).toBeTruthy();
    expect(device2SessionA).not.toBe(userA.sessionCookie);

    // Leitura após login no 2º dispositivo: zero fetch externo e mesma capa permanente travada
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const itemsAfterRelogin = await getAllEnrichedItems();
      expect(itemsAfterRelogin).toHaveLength(1);
      expect(itemsAfterRelogin[0]!.edition.coverUrl).toBe(persistedCoverUrl);
      expect(itemsAfterRelogin[0]!.edition.coverLocked).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }

    // Backfill não altera capa travada após relogin
    const backfillAttempt = await updateEditionCoverAction({
      editionId: added.editionId,
      coverUrl: "https://covers.openlibrary.org/b/id/987654-L.jpg",
      coverSource: "openlibrary",
      sourceAction: "backfill",
    });
    expect(backfillAttempt.ok).toBe(false);

    // 3. Usuário B entra em sessão própria e tenta ler dados de A pelas APIs HTTP
    const userB = await registerUser("etapa2-b", pwdB);
    cookieJar.set(SESSION_COOKIE_NAME, userB.sessionCookie);

    // 3a. /api/covers/file/{userA}/... -> 403 com private, no-store
    const parts = persistedCoverUrl.split("/");
    const coverResB = await getPrivateCoverRoute(
      new NextRequest(`http://localhost:3000${persistedCoverUrl}`),
      {
        params: Promise.resolve({
          userId: parts[4]!,
          editionId: parts[5]!,
          fileName: parts[6]!,
        }),
      }
    );
    expect(coverResB.status).toBe(403);
    expect(coverResB.headers.get("cache-control")).toContain("private");
    expect(coverResB.headers.get("cache-control")).toContain("no-store");

    // 3b. /api/export como B -> apenas dados de B (0 obras de A) e private, no-store
    const exportResB = await getExportRoute(
      new NextRequest("http://localhost:3000/api/export?format=json")
    );
    expect(exportResB.status).toBe(200);
    expect(exportResB.headers.get("cache-control")).toBe("private, no-store");
    const exportTextB = await exportResB.text();
    expect(exportTextB).not.toContain("Memórias Póstumas de Brás Cubas");
    expect(exportTextB).not.toContain(userA.userId);

    // 3c. /api/session como B -> identifica B e nunca cache público
    const sessionResB = await getSessionRoute();
    expect(sessionResB.status).toBe(200);
    expect(sessionResB.headers.get("cache-control")).toContain("private");
    expect(sessionResB.headers.get("cache-control")).toContain("no-store");

    // 3d. /api/export em CSV como B -> apenas dados de B e private, no-store
    const exportCsvB = await getExportRoute(
      new NextRequest("http://localhost:3000/api/export?format=csv")
    );
    expect(exportCsvB.status).toBe(200);
    expect(exportCsvB.headers.get("cache-control")).toBe("private, no-store");
    const csvTextB = await exportCsvB.text();
    expect(csvTextB).not.toContain("Memórias Póstumas de Brás Cubas");

    // 3e. /api/suggestions e /api/covers/search sem sessão -> 401
    cookieJar.clear();
    const unauthSuggestions = await getSuggestionsRoute(
      new NextRequest("http://localhost:3000/api/suggestions?mode=new_books")
    );
    expect(unauthSuggestions.status).toBe(401);

    const unauthCoverSearch = await getCoverSearchRoute(
      new NextRequest("http://localhost:3000/api/covers/search?title=Dom")
    );
    expect(unauthCoverSearch.status).toBe(401);
    expect(unauthCoverSearch.headers.get("cache-control")).toBe(
      "private, no-store"
    );
  });

  it("emite ip_truncated (/24 IPv4 e /64 IPv6), account_hash e retention_days nos logs sem expor IP completo ou senhas", async () => {
    expect(truncateIpForLog("198.51.100.42")).toBe("198.51.100.0/24");
    expect(truncateIpForLog("::ffff:203.0.113.99")).toBe("203.0.113.0/24");
    expect(truncateIpForLog("2001:db8:abcd:12:1111:2222:3333:4444")).toBe(
      "2001:0db8:abcd:0012::/64"
    );
    expect(truncateIpForLog(null)).toBeNull();

    process.env.AUTH_TRUST_PROXY = "1";
    const logs: string[] = [];
    const unsub = subscribeAuthLogSink((line) => logs.push(line));
    const secretPwd = "SenhaDeTesteUltraSecreta-LogCheck!";

    try {
      await signInWithEmailAction(
        {
          email: "ghost-ip-check@example.test",
          password: secretPwd,
        },
        {
          clientIp: "198.51.100.77",
          userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/131.0",
        }
      );

      expect(logs.length).toBeGreaterThanOrEqual(1);
      const blob = logs.join("\n");
      expect(blob).not.toContain(secretPwd);
      expect(blob).not.toContain("198.51.100.77");
      expect(blob).not.toContain("ghost-ip-check@example.test");

      const entry = JSON.parse(logs[0]!) as Record<string, unknown>;
      expect(entry.ip_truncated).toBe("198.51.100.0/24");
      expect(typeof entry.account_hash).toBe("string");
      expect(entry.retention_days).toBe(90);
    } finally {
      unsub();
      process.env.AUTH_TRUST_PROXY = "0";
    }
  });
});
