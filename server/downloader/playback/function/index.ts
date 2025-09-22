import { FORMATS_REGEXP } from "../regex.js";
import DecipherFunction from "./decipher.js";
import NTransform from "./nTransform.js";
import vm from "node:vm"

export default async function Get_Function(url: string) {
    const res = await fetch(url);
    const data = await res.text();

    const RegExp_Formats = new RegExp(FORMATS_REGEXP, 'm');

    const { code, varname: name } = ((data.match(RegExp_Formats) as any).groups as any);

    const func1 = DecipherFunction(data, code) ?? "";
    const func2 = NTransform(data, name, code) ?? "";

    return [new vm.Script(func1), new vm.Script(func2)];
}