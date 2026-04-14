export default async function Build_Electrobun() {
    console.info("\nBuilding local electrobun...");
    const start = new Date().getTime();
    Bun.spawnSync(["bun", "./build.ts", "--release"], { cwd: "electrobun/package", stdout: "inherit", stderr: "inherit" })
    const end = new Date().getTime();
    console.log(`Built Electrobun in ${((end - start) / 1000).toFixed(2)}s.`)
}