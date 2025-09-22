import { TCE_N_FUNCTION_REGEXP, N_TRANSFORM_FUNC_NAME, N_TRANSFORM_REGEXP, N_TRANSFORM_TCE_REGEXP, TCE_GLOBAL_VARS_REGEXP } from "../regex.js";

export default function NTransform(data: string, name: string, code: string) {
    const callerFunc = "DisTubeNTransformFunc(ncode);";
    let resultFunc: any;
    let nFunction: any;

    const nFunctionMatcher = data.match(new RegExp(TCE_N_FUNCTION_REGEXP, 's'));

    if (nFunctionMatcher && name && code) {
        nFunction = nFunctionMatcher[0];

        const tceEscapeName = name.replace("$", "\\$");
        const shortCircuitPattern = new RegExp(
            `;\\s*if\\s*\\(\\s*typeof\\s+[a-zA-Z0-9_$]+\\s*===?\\s*(?:\"undefined\"|'undefined'|${tceEscapeName}\\[\\d+\\])\\s*\\)\\s*return\\s+\\w+;`
        );

        const tceShortCircuitMatcher = nFunction.match(shortCircuitPattern);

        if (tceShortCircuitMatcher) {
            nFunction = nFunction.replaceAll(tceShortCircuitMatcher[0], ";");
        }

        resultFunc = "var " + N_TRANSFORM_FUNC_NAME + "=" + nFunction + code + ";\n";
        return resultFunc + callerFunc;
    }

    let nMatch = data.match(new RegExp(N_TRANSFORM_REGEXP, "s"));
    let isTce = false;

    if (nMatch) {
        nFunction = nMatch[0];
    } else {

        const nTceMatch = data.match(new RegExp(N_TRANSFORM_TCE_REGEXP, "s"));
        if (!nTceMatch) return null;

        nFunction = nTceMatch[0];
        isTce = true;
    }

    const paramMatch = nFunction.match(/function\s*\(\s*(\w+)\s*\)/);
    if (!paramMatch) return null;

    const paramName = paramMatch[1];

    const cleanedFunction = nFunction.replace(
        new RegExp(`if\\s*\\(typeof\\s*[^\\s()]+\\s*===?.*?\\)return ${paramName}\\s*;?`, "g"),
        ""
    );

    let tceVars = "";
    if (isTce) {
        const tceVarsMatch = data.match(new RegExp(TCE_GLOBAL_VARS_REGEXP, "m"));
        if (tceVarsMatch) {
            tceVars = tceVarsMatch[1] + ";\n";
        }
    }

    resultFunc = tceVars + "var " + N_TRANSFORM_FUNC_NAME + "=" + cleanedFunction + ";\n";
    return resultFunc + callerFunc;

}