export default async function Build_Electrobun() {
    console.info("\nBuilding local electrobun...")
    Bun.spawnSync(["bun", "./build.ts", "--release"], { cwd: "electrobun/package", stdout: "inherit", stderr: "inherit" })
    console.info("Done.")
}