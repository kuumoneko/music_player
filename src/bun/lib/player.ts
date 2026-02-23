import Player from "../music/index.ts";

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const wait_for_downloader = (player: Player) => {
    return new Promise(async (resolve) => {
        while (player === null || player === undefined) {
            await sleep(1000)
        }
        resolve(true)
    })
}

export default wait_for_downloader;