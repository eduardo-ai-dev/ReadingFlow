declare module "*/loadtest/safety-guard.mjs" {
  export function isAllowedLoadtestHostname(
    hostname: string,
    explicitStagingHost?: string
  ): boolean;

  export function assertAllowedTargetUrl(
    label: string,
    rawUrl: string,
    explicitStagingHost?: string
  ): string;

  export function enforceLoadtestSafety(options?: {
    env?: Record<string, string | undefined>;
    appUrl?: string;
    supabaseUrl?: string;
    throwOnly?: boolean;
  }): { appBaseUrl: string; supabaseBaseUrl: string };

  export function isLoadtestUserEmail(email: string): boolean;

  export class HostTelemetrySampler {
    constructor(intervalMs?: number);
    start(): void;
    stop(): {
      sampleCount: number;
      cpuAvgPercent: number;
      cpuMaxPercent: number;
      systemUsedMemAvgMb: number;
      systemUsedMemMaxMb: number;
      systemTotalMemMb: number;
      runnerRssMaxMb: number;
    };
  }
}

declare module "*/loadtest/mock-server.mjs" {
  import type http from "node:http";

  export function startMockCatalogServer(options?: {
    port?: number;
    host?: string;
    env?: Record<string, string | undefined>;
  }): Promise<{
    server: http.Server;
    port: number;
    baseUrl: string;
    getState: () => {
      mode: string;
      delayMs: number;
      stats: {
        totalRequests: number;
        byProvider: Record<string, number>;
        statusCounts: Record<string, number>;
      };
    };
    setMode: (
      nextMode: "normal" | "429" | "timeout" | "empty" | "slow",
      delayMs?: number
    ) => void;
    close: () => Promise<void>;
  }>;
}

declare module "*/loadtest/seed.mjs" {
  import type { UserWorkspaceData } from "@/server/store/memory-repository";

  export const DEFAULT_LOADTEST_PASSWORD: string;

  export function createSeededRng(seedInput?: number): {
    nextFloat: () => number;
    nextInt: (min: number, maxInclusive: number) => number;
    pick: <T>(arr: readonly T[]) => T;
  };

  export function getSharedLoadtestPasswordHash(plainPassword?: string): string;

  export function generateDeterministicUserWorkspace(params: {
    userIndex: number;
    bookCount: number;
    seed?: number;
    mockBaseUrl?: string;
  }): {
    workspace: UserWorkspaceData;
    sessionToken: string;
  };

  export function runLoadtestSeed(
    customOptions?: Record<string, unknown>
  ): Promise<unknown>;
}

declare module "*/loadtest/cleanup.mjs" {
  export function runLoadtestCleanup(
    options?: Record<string, unknown>
  ): Promise<{
    removedUsers: number;
    removedSessions: number;
  }>;
}
