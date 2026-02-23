import localstorage from "./localStorage.ts";

export enum Force {
    False = "false",
    Forward = "forward",
    Backward = "backward"
}

export function goto(url: string, isForce: Force = Force.False) {
    const now = localstorage('get', 'url', '/')
    const backw: string[] = localstorage('get', 'backward', []);
    const forw: string[] = localstorage('get', 'forward', []);

    let next: string = `${url}`;

    if (isForce === Force.Backward) {
        const temp = backw.pop() || "/";
        forw.unshift(now);
        next = `${temp}`;
        localstorage('set', 'backward', backw ?? []);
        localstorage('set', 'forward', forw ?? []);
    }
    else if (isForce === Force.Forward) {
        const temp = forw.shift() || "/";
        backw.push(now);
        next = `${temp}`;
        localstorage('set', 'backward', backw ?? []);
        localstorage('set', 'forward', forw ?? []);
    }
    else {
        backw.push(now);
        localstorage('set', 'backward', backw ?? []);
        localstorage('set', 'forward', forw ?? []);
    }
    localstorage('set', 'url', next);
    if (!url.includes("search/")) {
        localstorage("set", "search", "");
    }
    return next
}