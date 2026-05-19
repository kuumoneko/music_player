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
    }
    else if (isForce === Force.Forward) {
        const temp = forw.shift() || "/";
        backw.push(now);
        next = `${temp}`;
    }
    else {
        backw.push(now);
    }
    localstorage('set', 'url', next);
    localstorage('set', 'backward', backw ?? []);
    localstorage('set', 'forward', forw ?? []);
    window.dispatchEvent(new CustomEvent("forwardchange", { detail: forw }));
    window.dispatchEvent(new CustomEvent("backwardchange", { detail: backw }));
    window.dispatchEvent(new CustomEvent('urlchange', { detail: next }));
    if (!url.includes("search/")) {
        localstorage("set", "search", "");
        window.dispatchEvent(new CustomEvent('searchchange', { detail: "" }));
    }
    return next
}