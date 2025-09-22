export enum Force {
    false = "false",
    forward = "forward",
    backward = "backward"
}

export function goto(url: string, seturl: (a: string) => void, isForce: Force = Force.false) {
    const now = localStorage.getItem("url") ?? "/";
    const backw: string[] = JSON.parse(localStorage.getItem("backward") as string) || [];
    const forw: string[] = JSON.parse(localStorage.getItem("forward") as string) || [];

    let next: string = `${url}`;

    if (isForce === Force.backward) {
        const temp = backw.pop() || "/";
        forw.unshift(now);
        next = `${temp}`;
        localStorage.setItem("backward", JSON.stringify(backw || []));
        localStorage.setItem("forward", JSON.stringify(forw));
    }
    else if (isForce === Force.forward) {
        const temp = forw.shift() || "/";
        backw.push(now);
        next = `${temp}`;
        localStorage.setItem("backward", JSON.stringify(backw));
        localStorage.setItem("forward", JSON.stringify(forw || []));
    }
    else {
        backw.push(now);
        localStorage.setItem("backward", JSON.stringify(backw));
        localStorage.setItem("forward", "[]");
    }

    seturl(next)
    localStorage.setItem("url", next)
    return next
}