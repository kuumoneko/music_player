
export default async function Build_main_process() {
    console.log("Building main process for enviroment...");
    const start = new Date().getTime();
    Bun.spawnSync(["bunx", "electrobun", "build", "--env=stable", "--config=temp_electrobun.config.ts"], { stdout: "inherit", stderr: "inherit" })

    const end = new Date().getTime();
    console.log(`Built main process in ${((end - start) / 1000).toFixed(2)}s.`)
}
