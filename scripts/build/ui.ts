import { build } from "bun";

export default async function Build_Front_End() {
    console.log("Building client for production environment...");
    const start = new Date().getTime();
    const result = await build({
        entrypoints: ["./src/mainview/index.tsx"],
        outdir: "./dist",
        naming: "[name].[ext]",
        minify: true,
        root: "./src/mainview",
    });

    if (!result.success) {
        console.error("Build failed");
        for (const message of result.logs) {
            console.error(message);
        }
    }

    try {
        Bun.spawnSync(["bun", "x", "@tailwindcss/cli", "-i", "./src/mainview/index.css", "-o", "./dist/index.css", "--minify"])
    } catch (error) {
        console.log(error)
    }
    const a = Bun.file("./dist/index.js");
    if (await a.exists()) {
        console.log(a.name, Math.floor(a.size / 1024), 'KB')
    }

    const b = Bun.file("./dist/index.css");
    if (await b.exists()) {
        console.log(b.name, Math.floor(b.size / 1024), 'KB')
    }
    const end = new Date().getTime();
    console.log(`Built client in ${((end - start) / 1000).toFixed(2)}s.`)
}
