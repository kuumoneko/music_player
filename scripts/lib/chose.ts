import readline from "node:readline/promises";

export default async function ChoseYesNoQuestion(question: string, defaultValue: boolean): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    let result: string = "";
    let isDone: boolean = false;
    return new Promise(async (resolve, reject) => {
        try {
            while (!isDone) {
                const answer = await rl.question(`${question} (y/n) [${defaultValue ? "y" : "n"}]: `)
                if (["y", "n"].includes(answer)) {
                    result = answer;
                    isDone = true;
                }
                else if (answer.length === 0) {
                    result = defaultValue ? "y" : "n";
                    isDone = true;
                }
                else {
                    console.log(`\u001b[1A`)
                }
            }
            if (isDone) {
                resolve(result === "y")
            }
        } catch (error) {
            reject(error)
        }
    })
}