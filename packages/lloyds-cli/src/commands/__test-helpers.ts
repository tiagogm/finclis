import { mock } from "bun:test";

export const mockGetAccounts = mock(() => Promise.resolve([] as any[]));
export const mockFetchAllTransactions = mock(() => Promise.resolve([] as any[]));
export const mockRequireSession = mock(() => ({
  arrangementId: "arr_test123",
  cookies: [],
}));
export const mockReadCachedTransactions = mock(() => null as any[] | null);
export const mockWriteCachedTransactions = mock(() => {});

export function registerMocks() {
  mock.module("../client.js", () => ({
    requireSession: mockRequireSession,
    getClient: mock(() =>
      Promise.resolve({
        getAccounts: mockGetAccounts,
        fetchAllTransactions: mockFetchAllTransactions,
      })
    ),
    setVerbose: mock(() => {}),
    cleanup: mock(() => Promise.resolve()),
  }));

  mock.module("../cache.js", () => ({
    readCachedTransactions: mockReadCachedTransactions,
    writeCachedTransactions: mockWriteCachedTransactions,
    readCachedSummary: mock(() => null),
    writeCachedSummary: mock(() => {}),
  }));
}

export function captureStdout() {
  let output = "";
  const original = process.stdout.write.bind(process.stdout);
  const install = () => {
    process.stdout.write = ((chunk: any) => {
      output += chunk.toString();
      return true;
    }) as any;
  };
  install();
  return {
    getOutput: () => output,
    reset: () => { output = ""; install(); },
    restore: () => { process.stdout.write = original; },
  };
}
