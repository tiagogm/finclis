import { mock } from "bun:test";

export const mockVanguardGet = mock(() => Promise.resolve({} as any));
export const mockRequireSession = mock(() => ({ hierarchyId: "hier_test123" }));

export function registerMocks() {
  mock.module("../client.js", () => ({
    vanguardGet: mockVanguardGet,
    vanguardPost: mock(() => Promise.resolve({})),
    requireSession: mockRequireSession,
    setVerbose: mock(() => {}),
    cleanup: mock(() => Promise.resolve()),
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
