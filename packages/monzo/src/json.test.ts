import { describe, it, expect, afterEach } from "bun:test";

describe("writeJson", () => {
  const original = process.stdout.write.bind(process.stdout);
  let output = "";

  afterEach(() => {
    process.stdout.write = original;
    output = "";
  });

  it("outputs JSON with trailing newline", async () => {
    process.stdout.write = ((chunk: any) => {
      output += chunk.toString();
      return true;
    }) as any;

    const { writeJson } = await import("./json.js");
    writeJson({ foo: "bar", num: 42 });

    expect(output).toBe('{"foo":"bar","num":42}\n');
  });
});
