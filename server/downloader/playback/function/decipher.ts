import { TCE_SIGN_FUNCTION_REGEXP, TCE_SIGN_FUNCTION_ACTION_REGEXP, HELPER_REGEXP, REVERSE_PATTERN, SLICE_PATTERN, SPLICE_PATTERN, SWAP_PATTERN, DECIPHER_REGEXP, FUNCTION_TCE_REGEXP, TCE_GLOBAL_VARS_REGEXP } from "../regex.js";

export default function DecipherFunction(data: string, code: string) {
    const callerFunc = "DisTubeDecipherFunc(sig);";
    let resultFunc: any;
    const sigFunctionMatcher = data.match(new RegExp(TCE_SIGN_FUNCTION_REGEXP, 's'));
    const sigFunctionActionsMatcher = data.match(new RegExp(TCE_SIGN_FUNCTION_ACTION_REGEXP, 's'));

    if (sigFunctionMatcher && sigFunctionActionsMatcher && code) {
        const resultFuncc = "var " + "DisTubeDecipherFunc" + "=" + sigFunctionMatcher[0] + sigFunctionActionsMatcher[0] + code + ";\n";

        resultFunc = resultFuncc + callerFunc;
    }
    else {

        const helperMatch: any[] = data.match(new RegExp(HELPER_REGEXP, "s")) as any[];
        const helperObject = helperMatch[0];
        const actionBody = helperMatch[2];
        const extractDollarEscapedFirstGroup = (pattern: RegExp, text: string) => {
            const match = text.match(pattern);
            return match ? match[1].replace(/\$/g, "\\$") : null;
        };

        const reverseKey = extractDollarEscapedFirstGroup(REVERSE_PATTERN, actionBody);
        const sliceKey = extractDollarEscapedFirstGroup(SLICE_PATTERN, actionBody);
        const spliceKey = extractDollarEscapedFirstGroup(SPLICE_PATTERN, actionBody);
        const swapKey = extractDollarEscapedFirstGroup(SWAP_PATTERN, actionBody);

        const quotedFunctions = [reverseKey, sliceKey, spliceKey, swapKey]
            .filter(Boolean)
            .map((key: any) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

        if (quotedFunctions.length === 0) return null;

        let funcMatch = data.match(new RegExp(DECIPHER_REGEXP, "s"));
        let isTce = false;
        let decipherFunc: any;

        if (funcMatch) {
            decipherFunc = funcMatch[0];
        } else {
            const tceFuncMatch = data.match(new RegExp(FUNCTION_TCE_REGEXP, "s"));
            if (!tceFuncMatch) return null;

            decipherFunc = tceFuncMatch[0];
            isTce = true;
        }

        let tceVars = "";
        if (isTce) {
            const tceVarsMatch = data.match(new RegExp(TCE_GLOBAL_VARS_REGEXP, "m"));
            if (tceVarsMatch) {
                tceVars = tceVarsMatch[1] + ";\n";
            }
        }

        const resultFuncc = tceVars + helperObject + "\nvar " + "DisTubeDecipherFunc" + "=" + decipherFunc + ";\n";

        resultFunc = resultFuncc + callerFunc;
    }

    return resultFunc
}