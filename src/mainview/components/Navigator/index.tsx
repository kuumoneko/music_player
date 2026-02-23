import ControlPanel from "@/components/Navigator/Controls/index.tsx";
import ControlPages from "@/components/Navigator/Pages/index.tsx";
import Settings from "@/components/Navigator/Theme/index.tsx";

export default function Nav() {
    return (
        <div className="w-[80%] h-[5%] bg-slate-700 rounded-4xl flex flex-row items-center justify-between px-4">
            <ControlPanel />
            <ControlPages />
            <Settings />
        </div>
    );
}
