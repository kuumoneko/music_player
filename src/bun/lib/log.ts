export enum LogType {
    Error = "error",
    Info = "info",
    Debug = "debug"
}

const colors = {
    reset: "\x1b[0m",
    blue: "\x1b[34m",
    error: "\x1b[31m",
    debug: "\x1b[33m",
    info: "\x1b[32m",
    cyan: "\x1b[36m"
};

export default function log(message: string, type: LogType) {
    process.stdout.write(`${colors[type as string]} [${new Date().toLocaleDateString("en-US")} ${new Date().toLocaleTimeString("en-US")}]: ${message}\n${colors.reset}`)
}