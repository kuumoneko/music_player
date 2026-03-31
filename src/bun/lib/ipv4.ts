import { networkInterfaces } from "os";

export default function getLocalIPv4(): string | null {
    const nets = networkInterfaces();

    for (const name of Object.keys(nets)) {
        const interfaces = nets[name];
        if (!interfaces) continue;

        for (const net of interfaces) {
            const isIPv4 = net.family === 'IPv4' && !net.internal

            if (isIPv4 && !net.internal) {
                return net.address;
            }
        }
    }

    return "127.0.0.1";
}