import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  getAuthenticatedWorkspace,
  getMemoryStore,
  invalidateUserWorkspaceCache,
  SESSION_COOKIE_NAME,
  type UserWorkspaceData,
} from "@/server/store/memory-repository";
import { getDatabase } from "@/server/db/connection";
import {
  ormCreateSession,
  ormDeleteSession,
  ormDeleteUser,
  ormSeedWorkspace,
} from "@/server/db/orm-repository";
import { signInWithEmailAction, signOutAction } from "@/features/auth/actions";
import {
  addBookToLibraryAction,
  updateEditionCoverAction,
} from "@/features/catalog/actions";
import {
  finishReadingAction,
  updateReadingProgressAction,
} from "@/features/reading/actions";
import { reorderShelfBooksAction } from "@/features/shelves/actions";
import { saveShelfCustomizationAction } from "@/features/settings/actions";
import { getDashboardEditorialData } from "@/features/dashboard/queries";
import { getAllEnrichedItems } from "@/features/shelves/queries";

const LOADTEST_EMAIL_RE = /^loadtest\+\d+@example\.test$/i;
const ALLOWED_LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function verifyLocalLoadtestGuard(request: NextRequest): NextResponse | null {
  if (process.env.LOADTEST_ALLOW !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const hostname = request.nextUrl.hostname.toLowerCase();
  if (!ALLOWED_LOCAL_HOSTS.has(hostname)) {
    return NextResponse.json(
      {
        error: `[SAFETY ABORT] Host "${hostname}" não autorizado para /api/internal/loadtest.`,
      },
      { status: 403 }
    );
  }
  return null;
}

function collectSqliteDiagnostics(sampleUserId?: string) {
  const sqlite = getDatabase();
  sqlite.exec("ANALYZE;");

  const tables = [
    "users",
    "works",
    "editions",
    "shelves",
    "library_items",
    "readings",
    "reviews",
    "goals",
    "wishlist",
    "sessions",
  ];

  const tableStats: Record<
    string,
    { rowCount: number; estimatedBytes: number }
  > = {};

  for (const tbl of tables) {
    const countRow = sqlite
      .prepare(`SELECT COUNT(*) as cnt FROM ${tbl}`)
      .get() as { cnt?: number } | undefined;
    const rowCount = Number(countRow?.cnt ?? 0);
    tableStats[tbl] = {
      rowCount,
      estimatedBytes: rowCount * 380,
    };
  }

  const pageCountRow = sqlite.prepare("PRAGMA page_count;").get() as
    { page_count?: number } | undefined;
  const pageSizeRow = sqlite.prepare("PRAGMA page_size;").get() as
    { page_size?: number } | undefined;
  const totalSqliteBytes =
    Number(pageCountRow?.page_count ?? 0) *
    Number(pageSizeRow?.page_size ?? 4096);

  const queryPlans: Record<
    string,
    { durationMs: number; plan: string[]; rowsReturned: number }
  > = {};

  if (sampleUserId) {
    const queries: Array<{ name: string; sql: string; params: string[] }> = [
      {
        name: "dashboard_active_readings",
        sql: "SELECT * FROM readings WHERE user_id = ? AND status IN ('reading', 'paused') ORDER BY updated_at DESC",
        params: [sampleUserId],
      },
      {
        name: "shelves_items_ordered",
        sql: "SELECT * FROM library_items WHERE user_id = ? ORDER BY shelf_id ASC, shelf_position ASC",
        params: [sampleUserId],
      },
      {
        name: "catalog_works_by_user",
        sql: "SELECT * FROM works WHERE user_id = ? ORDER BY created_at DESC",
        params: [sampleUserId],
      },
      {
        name: "metrics_finished_readings",
        sql: "SELECT * FROM readings WHERE user_id = ? AND status = 'finished' ORDER BY finished_on DESC",
        params: [sampleUserId],
      },
    ];

    for (const q of queries) {
      const planRows = sqlite
        .prepare(`EXPLAIN QUERY PLAN ${q.sql}`)
        .all(...q.params) as Array<{ detail?: string }>;
      const t0 = performance.now();
      const rows = sqlite.prepare(q.sql).all(...q.params);
      const durationMs = Math.round((performance.now() - t0) * 1000) / 1000;
      queryPlans[q.name] = {
        durationMs,
        plan: planRows.map((r) => String(r.detail ?? "")),
        rowsReturned: rows.length,
      };
    }
  }

  return {
    totalSqliteBytes,
    tableStats,
    queryPlans,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = verifyLocalLoadtestGuard(request);
  if (denied) return denied;

  const mode = request.nextUrl.searchParams.get("mode");
  if (mode === "whoami") {
    const ws = await getAuthenticatedWorkspace();
    if (!ws) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const [dashboard, enrichedItems] = await Promise.all([
      getDashboardEditorialData(),
      getAllEnrichedItems(),
    ]);
    return NextResponse.json({
      ok: true,
      userId: ws.profile.id,
      email: ws.profile.email,
      displayName: ws.profile.displayName,
      totalItems: enrichedItems.length,
      allItemOwnersMatch: enrichedItems.every(
        (entry) => entry.item.userId === ws.profile.id
      ),
      dashboardOwnedWorks: dashboard.collectionOverview.counts.ownedWorks,
      activeReadingCount: dashboard.collectionOverview.counts.reading,
    });
  }

  const store = getMemoryStore();
  const sampleUserId =
    request.nextUrl.searchParams.get("sampleUserId") ?? undefined;
  const mem = process.memoryUsage();

  let loadtestUserCount = 0;
  for (const email of store.userIdByEmail.keys()) {
    if (LOADTEST_EMAIL_RE.test(email)) loadtestUserCount += 1;
  }

  return NextResponse.json({
    ok: true,
    loadtestUserCount,
    totalUsersInStore: store.usersById.size,
    activeSessionsInStore: store.sessions.size,
    serverMemoryMb: {
      rss: Math.round((mem.rss / (1024 * 1024)) * 10) / 10,
      heapUsed: Math.round((mem.heapUsed / (1024 * 1024)) * 10) / 10,
      heapTotal: Math.round((mem.heapTotal / (1024 * 1024)) * 10) / 10,
    },
    sqlite: collectSqliteDiagnostics(sampleUserId),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = verifyLocalLoadtestGuard(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body || typeof body.action !== "string") {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  const store = getMemoryStore();

  switch (body.action) {
    case "cleanup": {
      let removedUsers = 0;
      let removedSessions = 0;
      const removedUserIds = new Set<string>();

      for (const [email, userId] of Array.from(store.userIdByEmail.entries())) {
        if (LOADTEST_EMAIL_RE.test(email)) {
          store.userIdByEmail.delete(email);
          store.usersById.delete(userId);
          invalidateUserWorkspaceCache(userId);
          removedUserIds.add(userId);
          removedUsers += 1;
          await ormDeleteUser(userId).catch(() => {});
        }
      }

      for (const [token, uid] of Array.from(store.sessions.entries())) {
        if (removedUserIds.has(uid) || token.startsWith("lt-sess-")) {
          store.sessions.delete(token);
          removedSessions += 1;
        }
      }

      return NextResponse.json({
        ok: true,
        removedUsers,
        removedSessions,
      });
    }

    case "seed_batch": {
      const entries =
        (body.workspaces as Array<{
          workspace: UserWorkspaceData;
          sessionToken?: string;
          syncSqlite?: boolean;
        }>) ?? [];
      let seededCount = 0;
      let firstUserId: string | undefined;

      for (const item of entries) {
        const ws = item.workspace;
        const email = ws?.profile?.email?.toLowerCase()?.trim();
        if (!ws || !email || !LOADTEST_EMAIL_RE.test(email)) {
          return NextResponse.json(
            {
              error: `[SAFETY ABORT] E-mail "${String(email)}" recusado. Apenas loadtest+N@example.test é permitido.`,
            },
            { status: 400 }
          );
        }

        ws.uploadedCovers = ws.uploadedCovers ?? {};
        store.usersById.set(ws.profile.id, ws);
        store.userIdByEmail.set(email, ws.profile.id);
        invalidateUserWorkspaceCache(ws.profile.id);

        if (item.sessionToken) {
          store.sessions.set(item.sessionToken, ws.profile.id);
        }
        if (item.syncSqlite) {
          await ormSeedWorkspace(ws);
        }
        if (!firstUserId) firstUserId = ws.profile.id;
        seededCount += 1;
      }

      return NextResponse.json({
        ok: true,
        seededCount,
        firstUserId,
      });
    }

    case "signIn": {
      const res = await signInWithEmailAction({
        email: String(body.email ?? ""),
        password: String(body.password ?? ""),
        rememberMe: Boolean(body.rememberMe ?? true),
      });
      return NextResponse.json(res, { status: res.ok ? 200 : 401 });
    }

    case "signOut": {
      const res = await signOutAction();
      return NextResponse.json(res);
    }

    case "refreshSession": {
      const ws = await getAuthenticatedWorkspace();
      if (!ws) {
        return NextResponse.json(
          { ok: false, error: "Sessão expirada." },
          { status: 401 }
        );
      }
      const cookieStore = await cookies();
      const oldToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      const newToken = `lt-sess-${crypto.randomBytes(18).toString("hex")}`;
      store.sessions.set(newToken, ws.profile.id);
      await ormCreateSession(newToken, ws.profile.id).catch(() => {});
      if (oldToken && !Boolean(body.keepOldSession)) {
        store.sessions.delete(oldToken);
        await ormDeleteSession(oldToken).catch(() => {});
      }
      cookieStore.set(SESSION_COOKIE_NAME, newToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return NextResponse.json({
        ok: true,
        userId: ws.profile.id,
        email: ws.profile.email,
      });
    }

    case "updateReadingProgress": {
      const res = await updateReadingProgressAction(
        body.payload as Parameters<typeof updateReadingProgressAction>[0]
      );
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }

    case "finishReading": {
      const res = await finishReadingAction(
        body.payload as Parameters<typeof finishReadingAction>[0]
      );
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }

    case "addBook": {
      const res = await addBookToLibraryAction(
        body.payload as Parameters<typeof addBookToLibraryAction>[0]
      );
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }

    case "updateEditionCover": {
      const res = await updateEditionCoverAction(
        body.payload as Parameters<typeof updateEditionCoverAction>[0]
      );
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }

    case "saveShelfCustomization": {
      const res = await saveShelfCustomizationAction(
        body.payload as Parameters<typeof saveShelfCustomizationAction>[0]
      );
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }

    case "reorderShelfBooks": {
      const res = await reorderShelfBooksAction(
        body.payload as Parameters<typeof reorderShelfBooksAction>[0]
      );
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }

    case "inspectWorkspace": {
      const ws = await getAuthenticatedWorkspace();
      if (!ws) {
        return NextResponse.json(
          { error: "Não autenticado." },
          { status: 401 }
        );
      }
      return NextResponse.json({
        ok: true,
        userId: ws.profile.id,
        email: ws.profile.email,
        worksCount: ws.works.length,
        editionsCount: ws.editions.length,
        itemsCount: ws.items.length,
        readingsCount: ws.readings.length,
        editions: ws.editions.slice(0, 10).map((e) => ({
          id: e.id,
          workId: e.workId,
          coverUrl: e.coverUrl,
          coverLocked: e.coverLocked,
          coverSource: e.coverSource,
        })),
        readings: ws.readings.slice(0, 10).map((r) => ({
          id: r.id,
          workId: r.workId,
          status: r.status,
          progressValue: r.progressValue,
          progressTotal: r.progressTotal,
          dailyLogsCount: r.dailyLogs?.length ?? 0,
        })),
        shelfPositionsByShelf: Object.fromEntries(
          ws.shelves.map((s) => [
            s.id,
            ws.items
              .filter((i) => i.shelfId === s.id)
              .sort((a, b) => a.shelfPosition - b.shelfPosition)
              .map((i) => i.shelfPosition),
          ])
        ),
        shelfLayout: ws.settings?.shelfLayout,
      });
    }

    default: {
      const mem = process.memoryUsage();
      return NextResponse.json({
        ok: true,
        serverMemoryMb: {
          rss: Math.round((mem.rss / (1024 * 1024)) * 10) / 10,
          heapUsed: Math.round((mem.heapUsed / (1024 * 1024)) * 10) / 10,
        },
        sqlite: collectSqliteDiagnostics(
          typeof body.sampleUserId === "string" ? body.sampleUserId : undefined
        ),
      });
    }
  }
}
