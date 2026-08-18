export function printTable(headers: string[], rows: string[][]): void {
  if (rows.length === 0) return;
  const GAP = 2;
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => r[i].length)) + GAP
  );
  const fmt = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("").trimEnd();
  console.log(fmt(headers));
  console.log(fmt(headers.map(h => "—".repeat(h.length))));
  for (const row of rows) console.log(fmt(row));
}

export async function readKey(): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once("data", (data) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve(data.toString());
    });
  });
}
