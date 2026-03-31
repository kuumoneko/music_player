import readline from "node:readline/promises";

export default async function chose(question: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    let result: string = "";
    let isDone: boolean = false;
    return new Promise(async (resolve, reject) => {
        try {
            while (!isDone) {
                const answer = await rl.question(`${question} (Y for yes, N for No, default Yes): `)
                if (["Y", "y", "N", "n"].includes(answer)) {
                    result = answer;
                    isDone = true;
                }
                else if (answer.length === 0) {
                    result = "Y";
                    isDone = true;
                }
                else {
                    console.log(`\u001b[1A`)
                }
            }
            if (isDone) {
                resolve(result === "Y" || result === "y")
            }
        } catch (error) {
            reject(error)
        }
    })
}