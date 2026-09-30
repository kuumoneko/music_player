const PERMANENT_PATTERN = /removed|unavailable|private|no longer|deleted|copyright|invalid|not available|does not exist|terminated|disabled|^ERROR$/i;
const TRANSIENT_PATTERN = /bot|cookie|sign in|confirm|login|quota|too many|network|timeout|temporar|resolver|no streaming data/i;

export function isPermanentUnavailable(reason: string | null | undefined): boolean {
    if (!reason) return false;
    if (TRANSIENT_PATTERN.test(reason)) return false;
    return PERMANENT_PATTERN.test(reason);
}
