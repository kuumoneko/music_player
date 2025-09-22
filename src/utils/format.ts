export default function formatDuration(duration: number | string) {
    if (typeof duration === 'string') {
        duration = Number(duration)
    }

    duration = Math.floor(duration); // convert to seconds

    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);
    return `${hours > 0 ? hours + ' : ' : ''}${minutes < 10 ? '0' + minutes : minutes} : ${seconds < 10 ? '0' + seconds : seconds}`;
}