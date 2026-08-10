export interface AppArgs {
  dataDir: string;
  assetsDir: string;
  port?: number;
  noLock: boolean;
}

export function parseAppArgs(argv: string[]): AppArgs {
  const args: AppArgs = { dataDir: "", assetsDir: "", noLock: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--data-dir") args.dataDir = argv[++i] ?? "";
    else if (arg === "--assets") args.assetsDir = argv[++i] ?? "";
    else if (arg === "--port") {
      const value = Number(argv[++i]);
      args.port = Number.isFinite(value) ? value : undefined;
    }
    else if (arg === "--no-lock") args.noLock = true;
  }
  return args;
}
