import { mock } from "bun:test";

export const mockKrakenPrivatePost = mock(() => Promise.resolve({} as any));
export const mockKrakenPublicGet = mock(() => Promise.resolve({} as any));
export const mockFetchRates = mock(() => Promise.resolve({} as Record<string, number>));

export function registerMocks() {
  mock.module("../client.js", () => ({
    krakenPrivatePost: mockKrakenPrivatePost,
    krakenPublicGet: mockKrakenPublicGet,
    setVerbose: mock(() => {}),
    setOtp: mock(() => {}),
  }));

  mock.module("../auth.js", () => ({
    API_URL: "https://api.kraken.com",
    saveCredentials: mock(() => Promise.resolve()),
    loadCredentials: mock(() => Promise.resolve(null)),
    clearCredentials: mock(() => Promise.resolve()),
    prompt: mock(() => Promise.resolve("y")),
  }));

  mock.module("../rates.js", () => ({
    fetchRates: mockFetchRates,
  }));
}

export function captureStdout() {
  let output = "";
  const original = process.stdout.write.bind(process.stdout);
  const install = () => {
    process.stdout.write = ((chunk: any) => { output += chunk.toString(); return true; }) as any;
  };
  install();
  return {
    getOutput: () => output,
    reset: () => { output = ""; install(); },
    restore: () => { process.stdout.write = original; },
  };
}
