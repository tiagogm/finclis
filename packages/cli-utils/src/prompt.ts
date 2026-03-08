import readline from "node:readline";

export async function prompt(question: string, hidden = false): Promise<string> {
  if (hidden) {
    // execSync with hardcoded stty commands — no user input, safe from injection
    const { execSync } = await import("node:child_process");

    const restoreEcho = () => {
      try { execSync("stty echo", { stdio: "inherit" }); } catch {}
    };
    const onSigInt = () => { restoreEcho(); process.exit(130); };
    const onSigTerm = () => { restoreEcho(); process.exit(143); };

    process.on("exit", restoreEcho);
    process.on("SIGINT", onSigInt);
    process.on("SIGTERM", onSigTerm);

    process.stdout.write(question);
    try {
      execSync("stty -echo", { stdio: "inherit" });
      const rl = readline.createInterface({
        input: process.stdin,
        output: new (await import("node:stream")).Writable({
          write(_chunk, _encoding, callback) { callback(); },
        }),
      });
      const answer = await new Promise<string>((resolve) => {
        rl.question("", (ans) => { rl.close(); resolve(ans); });
      });
      return answer;
    } finally {
      restoreEcho();
      process.stdout.write("\n");
      process.removeListener("exit", restoreEcho);
      process.removeListener("SIGINT", onSigInt);
      process.removeListener("SIGTERM", onSigTerm);
    }
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}
