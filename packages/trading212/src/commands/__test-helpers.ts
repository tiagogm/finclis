import { mock } from "bun:test";

export const mockT212Get = mock(() => Promise.resolve({} as any));
export const mockFetchCSV = mock(() => Promise.resolve("" as string));

export function registerMocks() {
  mock.module("../client.js", () => ({
    t212Get: mockT212Get,
    t212Post: mock(() => Promise.resolve({})),
    t212Download: mock(() => Promise.resolve("")),
    t212GetAll: mock(() => Promise.resolve([])),
    setVerbose: mock(() => {}),
    getEnv: mock(() => Promise.resolve("live")),
  }));

  mock.module("./summary.js", () => ({
    fetchCSV: mockFetchCSV,
    summaryCommand: mock(() => Promise.resolve()),
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
