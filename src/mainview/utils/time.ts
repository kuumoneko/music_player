export default function iso8601DurationToMilliseconds(durationString: string): number {
    const pattern = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/
    const match = durationString.match(pattern);

    if (!match) {
        throw new Error("Invalid duration string format")
    }

    const [, days = 0, hours = 0, minutes = 0, seconds = 0] = match.map((value: any) => {
        return (value) ? value : 0;
    });

    const ms =
        (days * 24 * 60 * 60 * 1000) +
        (hours * 60 * 60 * 1000) +
        (minutes * 60 * 1000) +
        (seconds * 1000);
    return ms;
}