import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Link } from "../../../dist/types/index.ts";

export default function Download(
    {
        downloading,
        links,
        setdownload,
        setdownloading
    }: {
        downloading: string,
        links: Link[],
        setdownload: (a: boolean) => void,
        setdownloading: (a: string) => void
    }
) {

    return (
        <>

            {
                (downloading == 'downloading') ? (
                    <>
                        <div className="flex flex-col items-center justify-center py-4">
                            <div className="spinner"></div>
                            <p className="text-lg text-gray-700 dark:text-gray-300 mt-2">Downloading, please wait...</p>
                        </div>
                    </>
                ) : (
                    <>
                        {
                            (downloading == 'idle') ? (
                                (
                                    <>
                                        {links.length === 0 ? (
                                            <p className="text-center text-gray-500 dark:text-gray-400 mt-4">No links found.</p>
                                        ) : (
                                            <span className='flex justify-center items-center' >
                                                <button className='bg-green-500 h-full w-40 mb-5 rounded-xl' onClick={() => {
                                                    setdownload(true);
                                                    setdownloading('downloading')
                                                }}>
                                                    <span className='text-slate-200'>
                                                        Download
                                                    </span>
                                                </button>
                                            </span>
                                        )
                                        }
                                    </>
                                )
                            ) : (
                                <>
                                    <span className='flex justify-center items-center' >
                                        <button className='bg-green-500 h-full w-40 mb-5 rounded-xl' onClick={() => {
                                            setdownloading('install');
                                        }}>
                                            <span className='text-slate-200'>
                                                <FontAwesomeIcon icon={faDownload} />
                                                <span>download.7z</span>
                                            </span>
                                        </button>
                                    </span>
                                </>
                            )
                        }
                    </>
                )
            }

        </>
    )
}