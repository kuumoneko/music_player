export enum Force {
    false = "false",
    forward = "forward",
    backward = "backward"
}

export function goto(url: string, seturl: (a: string) => void, isForce: Force = Force.false) {
    const port = localStorage.getItem("port");

    const now = localStorage.getItem("url")?.split(`http://localhost:${port}`)[1] as string || "/";


    let next: string = `http://localhost:${port}${url}`;

    if (isForce === Force.backward) {
        const backw: string[] = JSON.parse(localStorage.getItem("backward") as string) || [];
        const forw: string[] = JSON.parse(localStorage.getItem("forward") as string) || [];
        const temp = backw.pop() || "/";
        forw.unshift(now);
        next = `http://localhost:${port}${temp}`;
        localStorage.setItem("backward", JSON.stringify(backw || []));
        localStorage.setItem("forward", JSON.stringify(forw));
    }
    else if (isForce === Force.forward) {
        const backw: string[] = JSON.parse(localStorage.getItem("backward") as string) || [];
        const forw: string[] = JSON.parse(localStorage.getItem("forward") as string) || [];
        const temp = forw.shift() || "/";
        backw.push(now);
        next = `http://localhost:${port}${temp}`;
        localStorage.setItem("backward", JSON.stringify(backw));
        localStorage.setItem("forward", JSON.stringify(forw || []));
    }
    else {
        const backw: string[] = JSON.parse(localStorage.getItem("backward") as string) || [];
        backw.push(now);
        localStorage.setItem("backward", JSON.stringify(backw));
        localStorage.setItem("forward", "[]");
    }

    seturl(next)
    localStorage.setItem("url", next)
    return next
}