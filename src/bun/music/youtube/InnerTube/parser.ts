import { Track, MusicSource } from "../../../../shared/types.ts";
import type { InnerPlaylistItem, InnerSearchItem } from "./types.ts";

export function extractSearchContents(data: any): any[] {
    try {
        const results = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents;
        const sectionList = results?.sectionListRenderer?.contents;
        if (!Array.isArray(sectionList)) return [];

        const items: any[] = [];
        for (const section of sectionList) {
            const itemSection = section?.itemSectionRenderer;
            if (itemSection?.contents) {
                for (const content of itemSection.contents) {
                    const parsed = parseSearchItem(content);
                    if (parsed) items.push(parsed);
                }
            }
        }
        return items;
    } catch {
        return [];
    }
}

export function extractPlaylistContents(data: any): any[] {
    try {
        const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs;
        if (!tabs?.length) return [];

        const tab = tabs[0]?.tabRenderer?.content;
        if (!tab) return [];

        // Try sectionListRenderer path (standard playlists)
        const sl = tab?.sectionListRenderer?.contents;
        if (sl?.length) {
            const contents = sl[0]?.itemSectionRenderer?.contents ?? [];
            if (contents.length > 0 && contents[0]?.lockupViewModel) {
                return contents;
            }
            return contents[0]?.playlistVideoListRenderer?.contents ?? [];
        }

        // Try richGridRenderer path (channel uploads / artist pages)
        const rg = tab?.richGridRenderer?.contents;
        if (rg?.length) {
            return rg
                .map((item: any) => {
                    if (item?.richItemRenderer?.content) return item.richItemRenderer.content;
                    return item;
                })
                .filter(Boolean);
        }

        return [];
    } catch {
        return [];
    }
}

function parseDurationFromText(text: string): number {
    const parts = text.split(":").map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
}

export function parseDurationValue(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return value;
    const text = String(value).trim();
    if (text.includes(":")) return parseDurationFromText(text);
    const seconds = parseInt(text, 10);
    return Number.isFinite(seconds) ? seconds : 0;
}

function parseRelativeDate(text: string): string {
    const match = text.match(/(\d+)\s*(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\s*ago/i);
    if (!match) return "";

    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const now = new Date();

    if (unit.startsWith("minute")) now.setMinutes(now.getMinutes() - amount);
    else if (unit.startsWith("hour")) now.setHours(now.getHours() - amount);
    else if (unit.startsWith("day")) now.setDate(now.getDate() - amount);
    else if (unit.startsWith("week")) now.setDate(now.getDate() - amount * 7);
    else if (unit.startsWith("month")) now.setMonth(now.getMonth() - amount);
    else if (unit.startsWith("year")) now.setFullYear(now.getFullYear() - amount);

    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function parseLockupItem(item: any, pos: number): InnerPlaylistItem | null {
    const lvm = item?.lockupViewModel;
    if (!lvm?.contentId) return null;

    const metadata = lvm?.metadata?.lockupMetadataViewModel;
    const overlays = lvm?.contentImage?.thumbnailViewModel?.overlays;
    const metadataRows = metadata?.metadata?.contentMetadataViewModel?.metadataRows ?? [];
    const durationText = overlays?.[0]?.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text ?? "0:00";
    const channelEndpoint = metadataRows?.[0]?.metadataParts?.[0]?.text?.commandRuns?.[0]?.onTap?.innertubeCommand?.browseEndpoint;

    const datePart = metadataRows?.[1]?.metadataParts?.[1]?.text?.content ?? "";

    return {
        id: lvm.contentId,
        title: metadata?.title?.content ?? "",
        artist: metadataRows?.[0]?.metadataParts?.[0]?.text?.content ?? "",
        channelId: channelEndpoint?.browseId ?? null,
        duration: parseDurationFromText(durationText),
        position: pos,
        thumbnails: lvm?.contentImage?.thumbnailViewModel?.image?.sources ?? [],
        releasedDate: parseRelativeDate(datePart),
    };
}

export function parsePlaylistItem(item: any, pos: number): InnerPlaylistItem | null {
    const vr = item?.playlistVideoRenderer ?? item?.playlistPanelVideoRenderer ?? item?.videoRenderer;
    if (vr?.videoId) {
        const lengthStr =
            vr.lengthSeconds ??
            vr.lengthText?.simpleText ??
            vr.lengthText?.runs?.[0]?.text ??
            "";

        return {
            id: vr.videoId,
            title: vr.title?.runs?.[0]?.text ?? vr.title?.simpleText ?? "",
            artist: vr.shortBylineText?.runs?.[0]?.text ??
                vr.shortBylineText?.simpleText ??
                vr.ownerText?.runs?.[0]?.text ?? "",
            channelId: vr.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ??
                vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ?? null,
            duration: parseDurationValue(lengthStr),
            position: pos,
            thumbnails: vr.thumbnail?.thumbnails ?? [],
        };
    }

    return parseLockupItem(item, pos);
}

export function parseSearchItem(item: any): InnerSearchItem | null {
    if (!item) return null;

    const vr = item?.videoRenderer;
    if (vr?.videoId) {
        const lengthStr =
            vr.lengthSeconds ??
            vr.lengthText?.simpleText ??
            vr.lengthText?.runs?.[0]?.text ??
            "";
        return {
            type: "video",
            id: vr.videoId,
            title: vr.title?.runs?.[0]?.text ?? vr.title?.simpleText ?? "",
            artist: vr.ownerText?.runs?.[0]?.text ??
                vr.shortBylineText?.runs?.[0]?.text ?? "",
            thumbnails: vr.thumbnail?.thumbnails ?? [],
            duration: parseDurationValue(lengthStr),
        };
    }

    const pr = item?.playlistRenderer;
    if (pr?.playlistId) {
        return {
            type: "playlist",
            id: pr.playlistId,
            title: pr.title?.simpleText ?? pr.title?.runs?.[0]?.text ?? "",
            thumbnails: pr.thumbnails?.[0]?.thumbnails ?? pr.thumbnail?.thumbnails ?? [],
        };
    }

    const cr = item?.channelRenderer;
    if (cr?.channelId) {
        return {
            type: "channel",
            id: cr.channelId,
            title: cr.title?.simpleText ?? cr.title?.runs?.[0]?.text ?? "",
            name: cr.title?.simpleText ?? cr.title?.runs?.[0]?.text ?? "",
            thumbnails: cr.thumbnail?.thumbnails ?? [],
        };
    }

    return null;
}

export function ensureHttps(url: string): string {
    return url.startsWith("//") ? `https:${url}` : url;
}

export function itemToTrack(item: InnerPlaylistItem): Track {
    return {
        source: MusicSource.Youtube,
        thumbnail: ensureHttps(item.thumbnails?.[0]?.url ?? `https://i.ytimg.com/vi/${item.id}/default.jpg`),
        artist: [{ name: item.artist || "Unknown Artist", id: item.channelId ?? "" }],
        name: item.title,
        id: item.id,
        duration: item.duration * 1000,
        releasedDate: item.releasedDate ?? "",
    };
}
