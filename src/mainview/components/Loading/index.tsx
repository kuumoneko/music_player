export default function Loading({ mode }: { mode: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-4">
            <div className="spinner border-4 border-gray-200 w-9 h-9 rounded-full  animate-spin mx-auto my-4 border-l-blue-300"></div>
            <p className="text-lg text-gray-300 mt-2">
                Loading {mode} , please wait...
            </p>
        </div>
    );
}
