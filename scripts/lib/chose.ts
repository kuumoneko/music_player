import readline from "node:readline";

export default function chose(question: string, options: string[]) {
    let firstRender = true;
    let isDone = false;

    return new Promise((resolve, _reject) => {
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        let selectedIndex = 0;

        const render = () => {
            // Move cursor to top-left and clear from cursor down
            if (!firstRender) {
                // Move cursor up (options length + 2 lines for header/spacing)
                process.stdout.write(`\u001b[${options.length + 2}A`);
            }
            firstRender = false;
            console.log(question);
            // console.log("Use ↑/↓ to select, Enter to confirm:\n");

            options.forEach((option, index) => {
                if (index === selectedIndex) {
                    // Bold and Blue (ANSI codes)
                    process.stdout.write(
                        `\x1b[34m\x1b[1m  > ${option}\x1b[0m\n`,
                    );
                } else {
                    process.stdout.write(`    ${option}\n`);
                }
            });
        };
        process.stdin.on("keypress", (_str, key) => {
            if ((key.ctrl && key.name === "c") || isDone) {
                return;
            }

            switch (key.name) {
                case "up":
                    selectedIndex =
                        selectedIndex > 0
                            ? selectedIndex - 1
                            : options.length - 1;
                    render();
                    break;
                case "down":
                    selectedIndex =
                        selectedIndex < options.length - 1
                            ? selectedIndex + 1
                            : 0;
                    render();
                    break;
                case "return":
                    process.stdout.write(`\u001b[${options.length + 1}A`);
                    resolve(options[selectedIndex] === "yes");
                    isDone = true;
                    break;
            }
        });

        render();
    });
}