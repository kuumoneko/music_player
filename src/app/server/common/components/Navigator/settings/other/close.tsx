// Close settings
export default function Close_Settings({ onClose }: {
    onClose: () => void;
}) {
    return (

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-md space-y-6 transform transition-all duration-300 scale-100 opacity-100">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h2>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200"
                    aria-label="Đóng cài đặt"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        </div>
    )
}