import os from "node:os";

const ALLOWED_EXACT_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const ALLOWED_HOST_SUFFIXES = [".local", ".test", ".localhost"];

/**
 * Verifica se um hostname pertence estritamente à allowlist de teste/staging.
 * Rejeita qualquer domínio de produção ou host externo não autorizado.
 */
export function isAllowedLoadtestHostname(
  hostname,
  explicitStagingHost = process.env.LOADTEST_STAGING_HOST
) {
  if (!hostname || typeof hostname !== "string") return false;
  const normalized = hostname.trim().toLowerCase();
  if (ALLOWED_EXACT_HOSTS.has(normalized)) return true;
  if (ALLOWED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) {
    return true;
  }
  if (
    explicitStagingHost &&
    normalized === explicitStagingHost.trim().toLowerCase() &&
    (normalized.includes("staging") || normalized.includes("loadtest"))
  ) {
    return true;
  }
  return false;
}

/**
 * Valida uma URL completa contra a allowlist de hostnames.
 */
export function assertAllowedTargetUrl(label, rawUrl, explicitStagingHost) {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error(
      `[SAFETY ABORT] ${label} ausente ou inválida: "${String(rawUrl)}".`
    );
  }
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(
      `[SAFETY ABORT] ${label} não é uma URL válida: "${rawUrl}".`
    );
  }
  if (!isAllowedLoadtestHostname(parsed.hostname, explicitStagingHost)) {
    throw new Error(
      `[SAFETY ABORT] Hostname "${parsed.hostname}" em ${label} (${rawUrl}) NÃO está na allowlist (localhost / 127.0.0.1 / *.local / *.test / staging). Execução abortada imediatamente.`
    );
  }
  return parsed.toString().replace(/\/$/, "");
}

/**
 * Guarda obrigatória executada no início de todo script de carga, seed ou limpeza.
 * Exige LOADTEST_ALLOW=1 e verifica APP_BASE_URL e NEXT_PUBLIC_SUPABASE_URL.
 */
export function enforceLoadtestSafety(options = {}) {
  const env = options.env ?? process.env;
  if (env.LOADTEST_ALLOW !== "1") {
    const msg =
      "[SAFETY ABORT] Variável de ambiente LOADTEST_ALLOW=1 é obrigatória para executar scripts de estresse, seed ou limpeza.";
    if (options.throwOnly) throw new Error(msg);
    console.error(msg);
    process.exit(1);
  }

  const appUrlRaw =
    options.appUrl ??
    env.LOADTEST_BASE_URL ??
    env.NEXT_PUBLIC_APP_URL ??
    "http://127.0.0.1:3000";
  const supabaseUrlRaw =
    options.supabaseUrl ??
    env.NEXT_PUBLIC_SUPABASE_URL ??
    "http://127.0.0.1:54321";

  try {
    const appBaseUrl = assertAllowedTargetUrl(
      "APP_BASE_URL",
      appUrlRaw,
      env.LOADTEST_STAGING_HOST
    );
    const supabaseBaseUrl = assertAllowedTargetUrl(
      "NEXT_PUBLIC_SUPABASE_URL",
      supabaseUrlRaw,
      env.LOADTEST_STAGING_HOST
    );
    return { appBaseUrl, supabaseBaseUrl };
  } catch (err) {
    if (options.throwOnly) throw err;
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

/**
 * Garante que apenas contas sintéticas loadtest+N@example.test sejam criadas ou removidas.
 */
export function isLoadtestUserEmail(email) {
  return (
    typeof email === "string" && /^loadtest\+\d+@example\.test$/i.test(email)
  );
}

/**
 * PRNG determinístico (Mulberry32) para reprodutibilidade exata com semente.
 */
export function createSeededRng(seedInput = 20261121) {
  let a = Number(seedInput) >>> 0;
  return {
    nextFloat() {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(min, maxInclusive) {
      return min + Math.floor(this.nextFloat() * (maxInclusive - min + 1));
    },
    pick(arr) {
      return arr[Math.floor(this.nextFloat() * arr.length)];
    },
  };
}

/**
 * Monitora CPU e RAM do host durante os testes de carga para separar gargalos da aplicação
 * de limites físicos da máquina local.
 */
export class HostTelemetrySampler {
  constructor(intervalMs = 1000) {
    this.intervalMs = intervalMs;
    this.samples = [];
    this.timer = null;
    this.prevCpuSnapshot = this.readCpuTotals();
  }

  readCpuTotals() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
      idle += cpu.times.idle;
      total +=
        cpu.times.user +
        cpu.times.nice +
        cpu.times.sys +
        cpu.times.idle +
        cpu.times.irq;
    }
    return { idle, total };
  }

  sampleOnce() {
    const currCpu = this.readCpuTotals();
    const idleDelta = currCpu.idle - this.prevCpuSnapshot.idle;
    const totalDelta = currCpu.total - this.prevCpuSnapshot.total;
    this.prevCpuSnapshot = currCpu;

    const cpuPercent =
      totalDelta > 0
        ? Math.max(
            0,
            Math.min(100, Math.round((1 - idleDelta / totalDelta) * 1000) / 10)
          )
        : 0;

    const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
    const freeMemMb = Math.round(os.freemem() / (1024 * 1024));
    const usedMemMb = totalMemMb - freeMemMb;
    const procMem = process.memoryUsage();

    const sample = {
      timestampMs: Date.now(),
      cpuPercent,
      systemUsedMemMb: usedMemMb,
      systemTotalMemMb: totalMemMb,
      systemMemPercent:
        Math.round((usedMemMb / Math.max(1, totalMemMb)) * 1000) / 10,
      runnerRssMb: Math.round((procMem.rss / (1024 * 1024)) * 10) / 10,
      runnerHeapUsedMb:
        Math.round((procMem.heapUsed / (1024 * 1024)) * 10) / 10,
    };
    this.samples.push(sample);
    return sample;
  }

  start() {
    if (this.timer) return;
    this.prevCpuSnapshot = this.readCpuTotals();
    this.timer = setInterval(() => {
      this.sampleOnce();
    }, this.intervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.samples.length === 0) {
      this.sampleOnce();
    }
    return this.summarize();
  }

  summarize() {
    if (this.samples.length === 0) {
      return {
        sampleCount: 0,
        cpuAvgPercent: 0,
        cpuMaxPercent: 0,
        systemUsedMemAvgMb: 0,
        systemUsedMemMaxMb: 0,
        systemTotalMemMb: Math.round(os.totalmem() / (1024 * 1024)),
        runnerRssMaxMb: 0,
      };
    }
    const cpus = this.samples.map((s) => s.cpuPercent);
    const mems = this.samples.map((s) => s.systemUsedMemMb);
    const rss = this.samples.map((s) => s.runnerRssMb);
    const avg = (arr) =>
      Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;

    return {
      sampleCount: this.samples.length,
      cpuAvgPercent: avg(cpus),
      cpuMaxPercent: Math.max(...cpus),
      systemUsedMemAvgMb: Math.round(avg(mems)),
      systemUsedMemMaxMb: Math.max(...mems),
      systemTotalMemMb: this.samples[0].systemTotalMemMb,
      runnerRssMaxMb: Math.max(...rss),
    };
  }
}
