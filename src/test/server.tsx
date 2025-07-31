// import { height } from "@fortawesome/free-brands-svg-icons/fa42Group";
import { useEffect, useRef } from "react";

const YOUR_REDIRECT_URI = 'http://localhost:3000/'; // This must be on the same origin as your React app


export default function Test() {

    // const popupRef = useRef(null); // Ref to store the popup window object

    // useEffect(() => {
    //     // This effect sets up a listener for messages from the popup window.
    //     // It runs once when the component mounts.
    //     const handleMessage = (event: any) => {
    //         // IMPORTANT SECURITY CHECK: Verify the origin of the message
    //         // Only accept messages from your own redirect URI's origin
    //         const expectedOrigin = new URL(YOUR_REDIRECT_URI).origin;
    //         if (event.origin !== expectedOrigin) {
    //             console.warn('Received message from untrusted origin:', event.origin);
    //             return;
    //         }

    //         // Check if the message data is a string (expected URL)
    //         console.log(event.data)


    //         if (typeof event.data === 'string' && event.data.startsWith(YOUR_REDIRECT_URI)) {
    //             console.log(event.data)
    //             // setReceivedUrl(event.data);
    //             // setLoginStatus('Login successful! URL received.');
    //             console.log('Received URL from popup:', event.data);

    //             // Close the popup if it's still open
    //             if (popupRef.current) {
    //                 (popupRef.current as any).close();
    //                 popupRef.current = null;
    //             }
    //         } else {
    //             console.log('Received unexpected message:', event.data);
    //         }
    //     };

    //     // Add the event listener for messages
    //     window.addEventListener('message', handleMessage);

    //     // Cleanup function: remove the event listener when the component unmounts
    //     return () => {
    //         window.removeEventListener('message', handleMessage);
    //         // Ensure popup is closed if component unmounts before login completes
    //         if (popupRef.current) {
    //             (popupRef.current as any).close();
    //             popupRef.current = null;
    //         }
    //     };
    // }, []);


    const onClick = () => {
        try {
            const temp = (window as any).electronAPI;
            if (temp) {
                temp.get_login_url({ where: "spotify" })
            }
        }
        catch (e) {
            alert(e)
        }
    }

    useEffect(() => {
        // Check if electronAPI exists before using it (important for web-only development)
        const temp = (window as any).electronAPI;


        if (temp) {
            temp.onDataReceived((data: any) => {
                console.log(data)
                // if (data.ok) {
                //     console.log(data.url)
                // const popup = window.open(
                //     data.url,
                //     'loginPopup',
                //     'width=600,height=700,resizable=yes,scrollbars=yes'
                // );

                // if (popup) {
                //     popup.focus();

                //     const checkPopupClosed = window.setInterval(() => {
                //         if (popup.closed) {
                //             clearInterval(checkPopupClosed);

                //             // popupRef.current = null;
                //             // if (loginStatus === 'Opening login popup...') { // Only update if not already successful
                //             //     setLoginStatus('Login popup closed by user or failed.');
                //             //     console.log('Login popup was closed by the user.');
                //             // }
                //         }
                //     }, 500);
                // }
                // }
            });
        }
    }, []);

    return (
        <div>
            <button onClick={onClick}>
                hello world
            </button>
        </div>
    )
}