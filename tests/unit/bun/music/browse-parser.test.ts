import { describe, expect, test } from "bun:test";
import { parseBrowseResponse } from "../../../../src/bun/music/youtube/InnerTube/browse-parser.ts";

const videoRenderer = {
    videoRenderer: {
        videoId: "dQw4w9WgXcQ",
        title: { runs: [{ text: "Browse Song" }] },
        ownerText: {
            runs: [{
                text: "Browse Artist",
                navigationEndpoint: { browseEndpoint: { browseId: "UCbrowse" } },
            }],
        },
        lengthText: { simpleText: "3:33" },
        thumbnail: { thumbnails: [{ url: "//i.ytimg.com/vi/dQw4w9WgXcQ/hq.jpg" }] },
    },
};

const playlistRenderer = {
    playlistRenderer: {
        playlistId: "PLbrowse123",
        title: { simpleText: "Browse Playlist" },
        thumbnail: { thumbnails: [{ url: "//i.ytimg.com/pl.jpg" }] },
    },
};

function wrapTab(content: unknown) {
    return {
        contents: {
            twoColumnBrowseResultsRenderer: {
                tabs: [{ tabRenderer: { content } }],
            },
        },
    };
}

describe("parseBrowseResponse", () => {
    test("parses a horizontal shelf inside a rich section", () => {
        const data = wrapTab({
            richGridRenderer: {
                contents: [{
                    richSectionRenderer: {
                        content: {
                            shelfRenderer: {
                                title: { runs: [{ text: "Popular" }] },
                                content: {
                                    horizontalListRenderer: { items: [videoRenderer] },
                                },
                            },
                        },
                    },
                }],
            },
        });

        const sections = parseBrowseResponse(data);
        expect(sections).toHaveLength(1);
        expect(sections[0]?.title).toBe("Popular");
        expect(sections[0]?.items[0]).toEqual({
            id: "dQw4w9WgXcQ",
            title: "Browse Song",
            type: "video",
            artist: "Browse Artist",
            channelId: "UCbrowse",
            duration: 213,
            thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hq.jpg",
        });
    });

    test("parses a direct shelfRenderer with expanded contents", () => {
        const data = wrapTab({
            sectionListRenderer: {
                contents: [{
                    shelfRenderer: {
                        title: { simpleText: "Playlists" },
                        content: {
                            expandedShelfContentsRenderer: { items: [playlistRenderer] },
                        },
                    },
                }],
            },
        });

        const sections = parseBrowseResponse(data);
        expect(sections).toHaveLength(1);
        expect(sections[0]?.title).toBe("Playlists");
        expect(sections[0]?.items[0]?.type).toBe("playlist");
        expect(sections[0]?.items[0]?.thumbnail).toBe("https://i.ytimg.com/pl.jpg");
    });

    test("parses lockup items inside expanded shelves", () => {
        const data = wrapTab({
            sectionListRenderer: {
                contents: [{
                    shelfRenderer: {
                        title: { simpleText: "New Releases" },
                        content: {
                            expandedShelfContentsRenderer: {
                                items: [{
                                    lockupViewModel: {
                                        contentId: "lockup1",
                                        metadata: {
                                            lockupMetadataViewModel: {
                                                title: { content: "Lockup Song" },
                                                metadata: {
                                                    contentMetadataViewModel: { metadataRows: [] },
                                                },
                                            },
                                        },
                                    },
                                }],
                            },
                        },
                    },
                }],
            },
        });

        const sections = parseBrowseResponse(data);
        expect(sections[0]?.items[0]?.id).toBe("lockup1");
        expect(sections[0]?.items[0]?.title).toBe("Lockup Song");
        expect(sections[0]?.items[0]?.type).toBe("video");
    });

    test("returns an empty list for malformed payloads", () => {
        expect(parseBrowseResponse(null)).toEqual([]);
        expect(parseBrowseResponse({})).toEqual([]);
        expect(parseBrowseResponse({ contents: { twoColumnBrowseResultsRenderer: { tabs: [] } } })).toEqual([]);
    });

    test("skips sections whose items cannot be parsed", () => {
        const data = wrapTab({
            richGridRenderer: {
                contents: [{
                    richSectionRenderer: {
                        content: {
                            shelfRenderer: {
                                title: { simpleText: "Empty" },
                                content: { horizontalListRenderer: { items: [{}] } },
                            },
                        },
                    },
                }],
            },
        });
        expect(parseBrowseResponse(data)).toEqual([]);
    });
});
