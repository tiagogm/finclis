import { mock } from "bun:test";

export const mockMonzoGet = mock(() => Promise.resolve({} as any));
export const mockMonzoPut = mock(() => Promise.resolve({} as any));
export const mockRequireSession = mock(() =>
  Promise.resolve({
    access_token: "test-token",
    refresh_token: "test-refresh",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    account_id: "acc_test123",
    client_id: "client_test",
    client_secret: "secret_test",
  })
);

export function registerMocks() {
  mock.module("../client.js", () => ({
    monzoGet: mockMonzoGet,
    monzoPut: mockMonzoPut,
    monzoPost: mock(() => Promise.resolve({})),
    requireSession: mockRequireSession,
    setVerbose: mock(() => {}),
  }));

  mock.module("../auth.js", () => ({
    API_URL: "https://api.monzo.com",
    AUTH_URL: "https://auth.monzo.com",
    saveSession: mock(() => Promise.resolve()),
    loadSession: mock(() => Promise.resolve(null)),
    clearSession: mock(() => Promise.resolve()),
    prompt: mock(() => Promise.resolve("y")),
    login: mock(() => Promise.resolve()),
    logout: mock(() => Promise.resolve()),
    refreshSession: mock(() => Promise.resolve({})),
  }));

  mock.module("../json.js", () => ({
    writeJson: (data: unknown) => {
      process.stdout.write(JSON.stringify(data));
    },
    handleJsonError: (err: any) => {
      const isAuth = err.message?.includes("401") || err.message?.includes("Not logged in");
      process.stdout.write(JSON.stringify({
        error: isAuth ? "auth" : "unknown",
        message: err.message,
      }));
      process.exit(isAuth ? 2 : 1);
    },
    BaseCommandOpts: {},
  }));

  mock.module("../format.js", () => ({
    formatMoney: (pence: number, currency = "GBP") => {
      const amount = pence / 100;
      return `${currency} ${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
  }));

  mock.module("../validate.js", () => ({
    validateDate: (value: string) => value,
    parseMonth: (s: string) => {
      const [m, y] = s.split("-").map(Number);
      return { month: m, year: y };
    },
    monthBounds: (month: number, year: number) => ({
      since: `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`,
      before: `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00.000Z`,
    }),
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
