import { DECIPHER_ARGUMENT, N_ARGUMENT } from "../regex.js";

export default function DownloadURL(format: any, decipherScript: any, nTransformScript: any) {

    const decipher = (url: string) => {
        // url is not has the host so i add a Example host to get params
        const temp = new URL(`http://localhost:3000/anything?${url}`);
        const s = temp.searchParams.get("s");
        const urll = temp.searchParams.get("url") as unknown as string;

        if (!s || !decipherScript) return urll;

        try {
            const components = new URL(decodeURIComponent(urll));
            const context = {};
            context[DECIPHER_ARGUMENT] = decodeURIComponent(s);
            const decipheredSig = decipherScript.runInNewContext(context);

            components.searchParams.set("sig", decipheredSig);
            return components.toString();
        } catch (err) {
            console.error("Error applying decipher:", err);
            return urll;
        }
    };

    const nTransform = (url: string) => {
        try {
            const components = new URL(decodeURIComponent(url));
            const n = components.searchParams.get("n");

            if (!n || !nTransformScript) return url;

            const context = {};
            context[N_ARGUMENT] = n;
            const transformedN = nTransformScript.runInNewContext(context);

            if (transformedN) {

                if (n === transformedN) {
                    console.warn("Transformed n parameter is the same as input, n function possibly short-circuited");
                } else if (transformedN.startsWith("enhanced_except_") || transformedN.endsWith("_w8_" + n)) {
                    console.warn("N function did not complete due to exception");
                }

                components.searchParams.set("n", transformedN);
            } else {
                console.warn("Transformed n parameter is null, n function possibly faulty");
            }

            return components.toString();
        } catch (err) {
            console.error("Error applying n transform:", err);
            return url;
        }
    };

    const cipher = !format.url;
    const url = format.url || format.signatureCipher || format.cipher;

    if (!url) return;

    try {
        format.url = nTransform(cipher ? decipher(url) : url);

        delete format.signatureCipher;
        delete format.cipher;
        return format
    } catch (err) {
        console.error("Error setting download URL:", err);
    }
}
