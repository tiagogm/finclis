import { mock } from "bun:test";

export const mockWiseGet = mock(() => Promise.resolve([] as any));
export const mockGetProfileId = mock(() => 123);
export const mockRequireSession = mock(() => ({
  token: "test-token",
  profileId: 123,
  createdAt: Date.now(),
}));
export const mockSetVerbose = mock(() => {});
const mockWriteJson = mock((data: unknown) => {
  process.stdout.write(JSON.stringify(data));
});
const mockHandleJsonError = mock((err: any) => {
  const isAuth = err.message?.includes("401") || err.message?.includes("Session expired");
  process.stdout.write(JSON.stringify({
    error: isAuth ? "auth" : "unknown",
    message: err.message,
  }));
  process.exit(isAuth ? 2 : 1);
});

export function registerMocks() {
  mock.module("../client.js", () => ({
    wiseGet: mockWiseGet,
    getProfileId: mockGetProfileId,
    requireSession: mockRequireSession,
    setVerbose: mockSetVerbose,
    wiseGatewayGet: mock(() => Promise.resolve({})),
    wisePost: mock(() => Promise.resolve({})),
    wisePut: mock(() => Promise.resolve({})),
  }));

  mock.module("../auth.js", () => ({
    DEFAULT_TTL_MS: 3600000,
    BASE_URL: "https://wise.com",
    API_URL: "https://api.wise.com",
    saveSession: mock(() => {}),
    loadSession: mock(() => null),
    clearSession: mock(() => {}),
    invalidateSession: mock(() => Promise.resolve()),
    prompt: mock(() => Promise.resolve("q")),
    login: mock(() => Promise.resolve({})),
  }));

  mock.module("../validate.js", () => ({
    validateCurrency: (code: string) => code.toUpperCase(),
    validateDate: (value: string) => value,
    validateBalanceId: (value: string) => Number(value),
    parseMonth: (s: string) => {
      const [m, y] = s.split("-").map(Number);
      return { month: m, year: y };
    },
    monthBounds: (month: number, year: number) => ({
      since: `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`,
      until: `${year}-${String(month).padStart(2, "0")}-28T23:59:59.999Z`,
    }),
  }));

  mock.module("../json.js", () => ({
    writeJson: mockWriteJson,
    handleJsonError: mockHandleJsonError,
    BaseCommandOpts: {},
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
