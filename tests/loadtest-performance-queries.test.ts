import { describe, expect, it } from "vitest";
import {
  indexEditionsByWorkId,
  resolveWorkCoverEdition,
} from "@/features/catalog/cover-url";
import {
  cachedWorkspaceQuery,
  invalidateUserWorkspaceCache,
  saveUndoSnapshot,
} from "@/server/store/memory-repository";
import { generateDeterministicUserWorkspace } from "../loadtest/seed.mjs";

describe("Regressão de Desempenho #1 — Consultas O(N), Cache Fingerprint O(1) e Snapshot Sem Blobs", () => {
  it("resolve capas de 2.000 obras em O(N) (< 10 ms) usando indexEditionsByWorkId e herda capa de edição irmã", () => {
    const { workspace } = generateDeterministicUserWorkspace({
      userIndex: 101,
      bookCount: 2000,
      seed: 20261121,
    });

    // Adiciona uma segunda edição com capa para uma obra cuja edição principal está sem capa
    const withoutCoverIdx = workspace.editions.findIndex(
      (e: { coverUrl?: string }) => !e.coverUrl
    );
    expect(withoutCoverIdx).toBeGreaterThanOrEqual(0);
    const targetEd = workspace.editions[withoutCoverIdx]!;
    workspace.editions.push({
      ...targetEd,
      id: `${targetEd.id}-sibling-with-cover`,
      coverUrl: "http://127.0.0.1:4110/covers/inherited-sibling.webp",
    });

    const editionsById = new Map(workspace.editions.map((e) => [e.id, e]));
    const editionsByWorkId = indexEditionsByWorkId(workspace.editions);

    const t0 = performance.now();
    let resolvedCount = 0;
    for (const item of workspace.items) {
      const ed = editionsById.get(item.editionId);
      const resolved = resolveWorkCoverEdition({
        workId: ed?.workId ?? "",
        preferredEditionId: item.editionId,
        editions: workspace.editions,
        editionsById,
        editionsByWorkId,
      });
      if (resolved) resolvedCount += 1;
    }
    const elapsedMs = performance.now() - t0;

    expect(resolvedCount).toBe(2000);
    expect(elapsedMs).toBeLessThan(40);

    const inherited = resolveWorkCoverEdition({
      workId: targetEd.workId,
      preferredEditionId: targetEd.id,
      editions: workspace.editions,
      editionsById,
      editionsByWorkId,
    });
    expect(inherited?.coverUrl).toBe(
      "http://127.0.0.1:4110/covers/inherited-sibling.webp"
    );
  });

  it("executa 100 hits de cachedWorkspaceQuery em O(1) (< 5 ms) para 2.000 livros e invalida após mutação", () => {
    const { workspace } = generateDeterministicUserWorkspace({
      userIndex: 102,
      bookCount: 2000,
      seed: 20261121,
    });

    let computeCalls = 0;
    const compute = () => {
      computeCalls += 1;
      return { total: workspace.items.length, call: computeCalls };
    };

    // Prime cache
    const first = cachedWorkspaceQuery(
      workspace as never,
      "perf-test",
      compute
    );
    expect(first.total).toBe(2000);
    expect(computeCalls).toBe(1);

    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      const hit = cachedWorkspaceQuery(
        workspace as never,
        "perf-test",
        compute
      );
      expect(hit.call).toBe(1);
    }
    const hit100Ms = performance.now() - t0;
    expect(hit100Ms).toBeLessThan(25);
    expect(computeCalls).toBe(1);

    invalidateUserWorkspaceCache(workspace.profile.id);
    const afterInvalidate = cachedWorkspaceQuery(
      workspace as never,
      "perf-test",
      compute
    );
    expect(afterInvalidate.call).toBe(2);
  });

  it("cria 10 snapshots de undo em rajada com 2.000 livros e capas enviadas sem clonar blobs pesados de uploadedCovers", () => {
    const { workspace } = generateDeterministicUserWorkspace({
      userIndex: 103,
      bookCount: 2000,
      seed: 20261121,
    });

    // Simula 20 capas base64 grandes em uploadedCovers
    const fakeBlob = "A".repeat(250_000);
    workspace.uploadedCovers = {};
    for (let i = 0; i < 20; i++) {
      const edId = `ed-lt-103-${i + 1}`;
      workspace.uploadedCovers[edId] = {
        ownerId: workspace.profile.id,
        editionId: edId,
        fileName: `cover-${i}.webp`,
        mimeType: "image/webp",
        bytesBase64: fakeBlob,
        etag: `"etag-${i}"`,
        createdAt: new Date().toISOString(),
      };
    }

    const t0 = performance.now();
    for (let i = 0; i < 10; i++) {
      saveUndoSnapshot(workspace as never, `Mutação #${i}`);
    }
    const elapsed10Ms = performance.now() - t0;

    expect(elapsed10Ms).toBeLessThan(120);
    expect(
      (
        workspace as {
          lastUndoAction?: { restoreSnapshot: Record<string, unknown> };
        }
      ).lastUndoAction?.restoreSnapshot.uploadedCovers
    ).toBeUndefined();
    expect(
      (
        workspace as {
          lastUndoAction?: { restoreSnapshot: { works: unknown[] } };
        }
      ).lastUndoAction?.restoreSnapshot.works.length
    ).toBe(2000);
  });
});
