import { build } from "bun";

export default async function Build_Front_End() {
    console.log("Building client for production environment...");
    const start = Date.now();
    const jsBuildPromise = build({
        entrypoints: ["./src/mainview/index.tsx"],
        outdir: "./dist",
        naming: "[name].[ext]",
        minify: true,
        root: "./src/mainview",
    });

    const tailwindPromise = Bun.spawn([
        "bun", "run", "tailwindcss",
        "-i", "./src/mainview/index.css",
        "-o", "./dist/index.css",
        "--minify"
    ]).exited;

    const [jsResult, tailwindExitCode] = await Promise.all([
        jsBuildPromise,
        tailwindPromise
    ]);

    if (!jsResult.success) {
        console.error("JS Build failed");
        for (const message of jsResult.logs) console.error(message);
    }

    if (tailwindExitCode !== 0) {
        console.error("Tailwind Build failed");
        process.exit(0);
    }

    const files = ["./dist/index.js", "./dist/index.css"];
    for (const path of files) {
        const file = Bun.file(path);
        if (await file.exists()) {
            console.log(`${path} - ${Math.floor(file.size / 1024)} KB`);
        }
    }

    const end = Date.now();
    console.log(`Built client in ${((end - start) / 1000).toFixed(2)}s.`)
}
