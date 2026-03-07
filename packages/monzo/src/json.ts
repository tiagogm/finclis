export interface BaseCommandOpts {
  verbose?: boolean;
  json?: boolean;
}

export function writeJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data));
}

export function handleJsonError(err: any): never {
  const isAuth = err.message?.includes("401") || err.message?.includes("Not logged in");
  writeJson({
    error: isAuth ? "auth" : "unknown",
    message: err.message,
  });
  process.exit(isAuth ? 2 : 1);
}
