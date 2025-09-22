export default function Loading({ mode }: { mode: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-4">
            <div className="spinner border-4 border-gray-200 w-9 h-9 rounded-full border-l-blue-400 animate-spin mx-auto my-4 dark:border-l-blue-300"></div>
            <p className="text-lg text-gray-700 dark:text-gray-300 mt-2">{mode} , please wait...</p>
        </div>

    )
}
