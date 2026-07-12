import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

/** True when client was generated with Agent Lab + Sheets models. */
function isPrismaClientReady(client: PrismaClient): boolean {
  return (
    typeof client.extractionTable?.findMany === "function" &&
    typeof client.sheetExport?.findMany === "function" &&
    typeof client.agentRun?.findMany === "function" &&
    typeof client.approvalRequest?.findMany === "function" &&
    typeof client.chatThread?.findMany === "function" &&
    typeof client.aiUsageDaily?.findMany === "function"
  );
}

function resolvePrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && isPrismaClientReady(cached)) {
    return cached;
  }

  if (cached) {
    void cached.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }

  const client = createPrismaClient();
  if (!isPrismaClientReady(client)) {
    throw new Error(
      "Prisma client is outdated (missing Agent Lab models). Stop the dev server, run npx prisma generate, then npm run dev."
    );
  }

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

/**
 * Lazy proxy so HMR does not keep a stale Prisma instance without sheetExport.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = resolvePrismaClient();
    const value = Reflect.get(client, prop, client) as unknown;
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});

export type { Prisma } from "@prisma/client";
