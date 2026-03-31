export default async function Build_Electrobun() {

    console.info("\nBuilding zig electrobun...")
    Bun.spawnSync(["zig", "build", "-Doptimize=ReleaseSmall"], { cwd: "electrobun/package/src/extractor", stdout: "inherit" })
    console.info("Done.")

    console.info("\nBuilding local electrobun...")
    Bun.spawnSync(["bun", "./build.ts", "--release"], { cwd: "electrobun/package", stdout: "inherit" })
    console.info("Done.")
}