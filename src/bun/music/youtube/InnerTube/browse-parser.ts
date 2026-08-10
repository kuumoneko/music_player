import { ensureHttps, parseLockupItem, parseDurationValue } from "./parser";

export interface ParsedBrowseItem {
    id: string;
    title: string;
    type: "video" | "playlist" | "channel";
    artist?: string;
    channelId?: string;
    duration?: number;
    thumbnail: string;
    releasedDate?: string;
}

export interface ParsedBrowseSection {
    title: string;
    items: ParsedBrowseItem[];
}

function extractItemFromContent(content: any): ParsedBrowseItem | null {
    if (!content) return null;

    const vr = content?.videoRenderer;
    if (vr?.videoId) {
        const lengthStr = vr.lengthSeconds ?? vr.lengthText?.simpleText ?? vr.lengthText?.runs?.[0]?.text ?? "";
        return {
            id: vr.videoId,
            title: vr.title?.runs?.[0]?.text ?? vr.title?.simpleText ?? "",
            type: "video",
            artist: vr.ownerText?.runs?.[0]?.text ?? vr.shortBylineText?.runs?.[0]?.text ?? "",
            channelId: vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId
                ?? vr.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ?? undefined,
            duration: parseDurationValue(lengthStr),
            thumbnail: ensureHttps(vr.thumbnail?.thumbnails?.[0]?.url ?? `https://i.ytimg.com/vi/${vr.videoId}/default.jpg`),
        };
    }

    const pr = content?.playlistRenderer;
    if (pr?.playlistId) {
        return {
            id: pr.playlistId,
            title: pr.title?.simpleText ?? pr.title?.runs?.[0]?.text ?? "",
            type: "playlist",
            thumbnail: ensureHttps(pr.thumbnails?.[0]?.thumbnails?.[0]?.url
                ?? pr.thumbnail?.thumbnails?.[0]?.url ?? ""),
        };
    }

    const cr = content?.channelRenderer;
    if (cr?.channelId) {
        return {
            id: cr.channelId,
            title: cr.title?.simpleText ?? cr.title?.runs?.[0]?.text ?? "",
            type: "channel",
            thumbnail: ensureHttps(cr.thumbnail?.thumbnails?.[0]?.url ?? ""),
        };
    }

    const rr = content?.reelItemRenderer;
    if (rr?.videoId) {
        return {
            id: rr.videoId,
            title: rr.headline?.simpleText ?? rr.title?.runs?.[0]?.text ?? "",
            type: "video",
            duration: 0,
            thumbnail: ensureHttps(rr.thumbnail?.thumbnails?.[0]?.url ?? `https://i.ytimg.com/vi/${rr.videoId}/default.jpg`),
        };
    }

    const lvm = content?.lockupViewModel;
    if (lvm?.contentId) {
        const pi = parseLockupItem(content, 0);
        if (pi) {
            return {
                id: pi.id,
                title: pi.title,
                type: "video",
                artist: pi.artist,
                channelId: pi.channelId ?? undefined,
                duration: pi.duration,
                thumbnail: ensureHttps(pi.thumbnails?.[0]?.url ?? `https://i.ytimg.com/vi/${pi.id}/default.jpg`),
                releasedDate: pi.releasedDate,
            };
        }
    }

    return null;
}

function extractSectionItems(contents: any[]): ParsedBrowseItem[] {
    if (!Array.isArray(contents)) return [];
    const items: ParsedBrowseItem[] = [];
    for (const item of contents) {
        const richItem = item?.richItemRenderer?.content ?? item?.richItemRenderer ?? item;
        const parsed = extractItemFromContent(richItem);
        if (parsed) items.push(parsed);
    }
    return items;
}

export function parseBrowseResponse(data: any): ParsedBrowseSection[] {
    const sections: ParsedBrowseSection[] = [];

    try {
        const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs;
        if (!Array.isArray(tabs)) return sections;

        const tab = tabs[0]?.tabRenderer?.content;
        if (!tab) return sections;

        const richContents = tab?.richGridRenderer?.contents ?? tab?.sectionListRenderer?.contents ?? [];
        if (!Array.isArray(richContents)) return sections;

        for (const item of richContents) {
            const richSection = item?.richSectionRenderer;
            if (richSection) {
                const shelf = richSection?.content?.shelfRenderer;
                if (shelf) {
                    const title = shelf.title?.runs?.[0]?.text ?? shelf.title?.simpleText ?? "";
                    const content = shelf.content;
                    let subItems: any[] = [];

                    if (content?.expandedShelfContentsRenderer?.items) {
                        subItems = content.expandedShelfContentsRenderer.items.map(
                            (si: any) => si?.videoRenderer ?? si?.playlistRenderer ?? si?.channelRenderer ?? si
                        );
                    } else if (content?.horizontalListRenderer?.items) {
                        subItems = content.horizontalListRenderer.items.map(
                            (si: any) => si?.lockupViewModel ?? si
                        );
                    } else if (content?.richGridRenderer?.contents) {
                        subItems = content.richGridRenderer.contents.map(
                            (si: any) => si?.richItemRenderer?.content ?? si
                        );
                    }

                    const parsed = extractSectionItems(subItems.length > 0 ? subItems : [shelf]);
                    if (parsed.length > 0) {
                        sections.push({ title, items: parsed });
                    }
                }
                continue;
            }

            const shelf = item?.shelfRenderer;
            if (shelf) {
                const title = shelf.title?.runs?.[0]?.text ?? shelf.title?.simpleText ?? "";
                const content = shelf.content;
                let subItems: any[] = [];
                if (content?.expandedShelfContentsRenderer?.items) {
                    subItems = content.expandedShelfContentsRenderer.items;
                } else if (content?.horizontalListRenderer?.items) {
                    subItems = content.horizontalListRenderer.items;
                }
                const parsed = extractSectionItems(subItems);
                if (parsed.length > 0) {
                    sections.push({ title, items: parsed });
                }
                continue;
            }

            const richItem = item?.richItemRenderer;
            if (richItem) {
                const parsed = extractItemFromContent(richItem.content);
                if (parsed) {
                    let recSection = sections.find(s => s.title === "Recommended");
                    if (!recSection) {
                        recSection = { title: "Recommended", items: [] };
                        sections.push(recSection);
                    }
                    recSection.items.push(parsed);
                }
            }
        }
    } catch {
        return [];
    }

    return sections;
}
