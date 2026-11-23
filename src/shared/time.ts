export default function iso8601DurationToMilliseconds(durationString: string): number {
    const pattern = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
    const match = durationString.match(pattern);

    if (!match) {
        throw new Error("Invalid duration string format")
    }

    const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
    const ms =
        (parseInt(days, 10) * 24 * 60 * 60 * 1000) +
        (parseInt(hours, 10) * 60 * 60 * 1000) +
        (parseInt(minutes, 10) * 60 * 1000) +
        (parseInt(seconds, 10) * 1000);
    return ms;
}
