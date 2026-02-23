
function levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    const dp = [];
    for (let i = 0; i <= m; i++) {
        dp[i] = [i];
    }
    for (let j = 0; j <= n; j++) {
        dp[0][j] = j;
    }

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;

            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }

    return dp[m][n];
}


function areStringsSimilar(str1: string, str2: string, similarityThreshold = 0.7): boolean {
    if (str1 === str2) return true;
    if (!str1.length || !str2.length) return false;

    const maxLen = Math.max(str1.length, str2.length);
    const distance = levenshteinDistance(str1, str2);

    const similarityScore = 1 - (distance / maxLen);
    return similarityScore >= similarityThreshold;
}

export default areStringsSimilar;