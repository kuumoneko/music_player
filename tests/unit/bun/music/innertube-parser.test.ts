import { describe, expect, test } from "bun:test";
import {
    ensureHttps,
    extractPlaylistContents,
    extractSearchContinuationContents,
    extractSearchContinuationToken,
    extractSearchContents,
    itemToTrack,
    parseDurationValue,
    parseLockupItem,
    parsePlaylistItem,
    parseSearchItem,
    parseSearchItems,
} from "../../../../src/bun/music/youtube/InnerTube/parser.ts";
import { MusicSource } from "../../../../src/shared/types.ts";

const videoRenderer = {
    videoRenderer: {
        videoId: "dQw4w9WgXcQ",
        title: { runs: [{ text: "Never Gonna Give You Up" }] },
        ownerText: {
            runs: [{
                text: "Rick Astley",
                navigationEndpoint: { browseEndpoint: { browseId: "UCuAXFkgsw1L7xaCfnd5JJOw" } },
            }],
        },
        lengthText: { simpleText: "3:33" },
        thumbnail: { thumbnails: [{ url: "//i.ytimg.com/vi/dQw4w9WgXcQ/hq.jpg", width: 480, height: 360 }] },
    },
};

const playlistRenderer = {
    playlistRenderer: {
        playlistId: "PL1234567890",
        title: { simpleText: "Best Of" },
        thumbnails: [{ thumbnails: [{ url: "//i.ytimg.com/pl.jpg", width: 120, height: 120 }] }],
    },
};

const channelRenderer = {
    channelRenderer: {
        channelId: "UCchannel123",
        title: { simpleText: "A Channel" },
        thumbnail: { thumbnails: [{ url: "//i.ytimg.com/ch.jpg", width: 120, height: 120 }] },
    },
};

const continuationItem = {
    continuationItemRenderer: {
        continuationEndpoint: { continuationCommand: { token: "token-1" } },
    },
};

const lockupItem = {
    lockupViewModel: {
        contentId: "lockupVideo1",
        metadata: {
            lockupMetadataViewModel: {
                title: { content: "Lockup Title" },
                metadata: {
                    contentMetadataViewModel: {
                        metadataRows: [
                            {
                                metadataParts: [{
                                    text: {
                                        content: "Lockup Artist",
                                        commandRuns: [{
                                            onTap: { innertubeCommand: { browseEndpoint: { browseId: "UCartist" } } },
                                        }],
                                    },
                                }],
                            },
                            {
                                metadataParts: [
                                    { text: { content: "1M views" } },
                                    { text: { content: "2 years ago" } },
                                ],
                            },
                        ],
                    },
                },
            },
        },
        contentImage: {
            thumbnailViewModel: {
                image: { sources: [{ url: "//img.example/lockup.jpg" }] },
                overlays: [{
                    thumbnailBottomOverlayViewModel: {
                        badges: [{ thumbnailBadgeViewModel: { text: "4:05" } }],
                    },
                }],
            },
        },
    },
};

describe("parseSearchItem", () => {
    test("parses a video result", () => {
        const item = parseSearchItem(videoRenderer);
        expect(item?.type).toBe("video");
        expect(item?.id).toBe("dQw4w9WgXcQ");
        expect(item?.title).toBe("Never Gonna Give You Up");
        expect(item?.artist).toBe("Rick Astley");
        expect(item?.duration).toBe(213);
        expect(item?.thumbnails).toHaveLength(1);
    });

    test("parses a playlist result", () => {
        const item = parseSearchItem(playlistRenderer);
        expect(item?.type).toBe("playlist");
        expect(item?.id).toBe("PL1234567890");
        expect(item?.title).toBe("Best Of");
        expect(item?.thumbnails[0]?.url).toBe("//i.ytimg.com/pl.jpg");
    });

    test("parses a channel result and exposes its name", () => {
        const item = parseSearchItem(channelRenderer);
        expect(item?.type).toBe("channel");
        expect(item?.id).toBe("UCchannel123");
        expect(item?.title).toBe("A Channel");
        expect(item?.name).toBe("A Channel");
    });

    test("returns null for unknown or nullish items", () => {
        expect(parseSearchItem(null)).toBeNull();
        expect(parseSearchItem({})).toBeNull();
        expect(parseSearchItem({ videoRenderer: {} })).toBeNull();
    });

    test("parseSearchItems filters out unparsable entries", () => {
        const items = parseSearchItems([videoRenderer, {}, playlistRenderer, null]);
        expect(items.map((item) => item.type)).toEqual(["video", "playlist"]);
    });

    test("parseSearchItems tolerates a nullish list", () => {
        expect(parseSearchItems(undefined as unknown as unknown[])).toEqual([]);
    });
});

describe("search response extraction", () => {
    const searchData = {
        contents: {
            twoColumnSearchResultsRenderer: {
                primaryContents: {
                    sectionListRenderer: {
                        contents: [
                            { itemSectionRenderer: { contents: [videoRenderer, playlistRenderer] } },
                            { itemSectionRenderer: { contents: [channelRenderer] } },
                            { itemSectionRenderer: { contents: [continuationItem] } },
                        ],
                    },
                },
            },
        },
    };

    test("extracts items from every item section", () => {
        expect(extractSearchContents(searchData).map((item) => item.type)).toEqual([
            "video",
            "playlist",
            "channel",
        ]);
    });

    test("returns an empty list for malformed payloads", () => {
        expect(extractSearchContents(null)).toEqual([]);
        expect(extractSearchContents({})).toEqual([]);
        expect(extractSearchContents({ contents: { other: true } })).toEqual([]);
    });

    test("finds the continuation token on the first page", () => {
        expect(extractSearchContinuationToken(searchData)).toBe("token-1");
        expect(extractSearchContinuationToken({})).toBeNull();
    });

    test("finds the continuation token on continuation pages", () => {
        const continuationData = {
            onResponseReceivedCommands: [{
                appendContinuationItemsAction: {
                    continuationItems: [videoRenderer, continuationItem],
                },
            }],
        };
        expect(extractSearchContinuationToken(continuationData)).toBe("token-1");
    });

    test("extracts continuation contents from append actions", () => {
        const continuationData = {
            onResponseReceivedCommands: [{
                appendContinuationItemsAction: {
                    continuationItems: [{ itemSectionRenderer: { contents: [videoRenderer] } }],
                },
            }],
        };
        expect(extractSearchContinuationContents(continuationData)).toHaveLength(1);
    });

    test("falls back to the first-page section layout for continuations", () => {
        expect(extractSearchContinuationContents(searchData)).toHaveLength(3);
    });

    test("returns an empty list when continuation contents are missing", () => {
        expect(extractSearchContinuationContents({})).toEqual([]);
    });
});

describe("extractPlaylistContents", () => {
    test("reads the standard playlistVideoListRenderer layout", () => {
        const data = {
            contents: {
                twoColumnBrowseResultsRenderer: {
                    tabs: [{
                        tabRenderer: {
                            content: {
                                sectionListRenderer: {
                                    contents: [{
                                        itemSectionRenderer: {
                                            contents: [{
                                                playlistVideoListRenderer: {
                                                    contents: [videoRenderer, playlistRenderer],
                                                },
                                            }],
                                        },
                                    }],
                                },
                            },
                        },
                    }],
                },
            },
        };
        expect(extractPlaylistContents(data)).toHaveLength(2);
    });

    test("returns lockup contents directly", () => {
        const data = {
            contents: {
                twoColumnBrowseResultsRenderer: {
                    tabs: [{
                        tabRenderer: {
                            content: {
                                sectionListRenderer: {
                                    contents: [{ itemSectionRenderer: { contents: [lockupItem] } }],
                                },
                            },
                        },
                    }],
                },
            },
        };
        expect(extractPlaylistContents(data)).toEqual([lockupItem]);
    });

    test("reads the richGridRenderer layout", () => {
        const data = {
            contents: {
                twoColumnBrowseResultsRenderer: {
                    tabs: [{
                        tabRenderer: {
                            content: {
                                richGridRenderer: {
                                    contents: [{ richItemRenderer: { content: videoRenderer } }],
                                },
                            },
                        },
                    }],
                },
            },
        };
        expect(extractPlaylistContents(data)).toEqual([videoRenderer]);
    });

    test("returns an empty list for missing tabs or content", () => {
        expect(extractPlaylistContents(null)).toEqual([]);
        expect(extractPlaylistContents({})).toEqual([]);
        expect(extractPlaylistContents({ contents: { twoColumnBrowseResultsRenderer: { tabs: [] } } })).toEqual([]);
    });
});

describe("parseDurationValue", () => {
    test("returns numbers unchanged", () => {
        expect(parseDurationValue(213)).toBe(213);
        expect(parseDurationValue(0)).toBe(0);
    });

    test("parses mm:ss and hh:mm:ss strings", () => {
        expect(parseDurationValue("3:33")).toBe(213);
        expect(parseDurationValue("0:07")).toBe(7);
        expect(parseDurationValue("1:02:03")).toBe(3_723);
    });

    test("parses plain second counts", () => {
        expect(parseDurationValue("245")).toBe(245);
    });

    test("returns 0 for nullish and unparsable values", () => {
        expect(parseDurationValue(null)).toBe(0);
        expect(parseDurationValue(undefined)).toBe(0);
        expect(parseDurationValue("")).toBe(0);
        expect(parseDurationValue("not-a-duration")).toBe(0);
    });
});

describe("parseLockupItem", () => {
    test("parses lockup metadata, duration and channel", () => {
        const item = parseLockupItem(lockupItem, 4);
        expect(item?.id).toBe("lockupVideo1");
        expect(item?.title).toBe("Lockup Title");
        expect(item?.artist).toBe("Lockup Artist");
        expect(item?.channelId).toBe("UCartist");
        expect(item?.duration).toBe(245);
        expect(item?.position).toBe(4);
        expect(item?.releasedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("returns null without a content id", () => {
        expect(parseLockupItem({}, 0)).toBeNull();
        expect(parseLockupItem(null, 0)).toBeNull();
    });
});

describe("parsePlaylistItem", () => {
    test("parses playlistVideoRenderer entries", () => {
        const item = parsePlaylistItem({
            playlistVideoRenderer: {
                videoId: "abc12345678",
                title: { runs: [{ text: "Playlist Song" }] },
                shortBylineText: {
                    runs: [{
                        text: "Channel",
                        navigationEndpoint: { browseEndpoint: { browseId: "UCchan" } },
                    }],
                },
                lengthSeconds: "245",
                thumbnail: { thumbnails: [{ url: "//img.example/v.jpg" }] },
            },
        }, 2);

        expect(item?.id).toBe("abc12345678");
        expect(item?.title).toBe("Playlist Song");
        expect(item?.artist).toBe("Channel");
        expect(item?.channelId).toBe("UCchan");
        expect(item?.duration).toBe(245);
        expect(item?.position).toBe(2);
    });

    test("parses videoRenderer entries", () => {
        const item = parsePlaylistItem(videoRenderer, 0);
        expect(item?.id).toBe("dQw4w9WgXcQ");
        expect(item?.duration).toBe(213);
    });

    test("falls back to the lockup layout", () => {
        const item = parsePlaylistItem(lockupItem, 1);
        expect(item?.id).toBe("lockupVideo1");
        expect(item?.title).toBe("Lockup Title");
    });

    test("returns null for unknown items", () => {
        expect(parsePlaylistItem({}, 0)).toBeNull();
        expect(parsePlaylistItem(null, 0)).toBeNull();
    });
});

describe("ensureHttps", () => {
    test("upgrades protocol-relative URLs", () => {
        expect(ensureHttps("//i.ytimg.com/x.jpg")).toBe("https://i.ytimg.com/x.jpg");
    });

    test("leaves absolute and empty URLs untouched", () => {
        expect(ensureHttps("https://example.com/x.jpg")).toBe("https://example.com/x.jpg");
        expect(ensureHttps("")).toBe("");
    });
});

describe("itemToTrack", () => {
    test("converts seconds to milliseconds and keeps metadata", () => {
        const track = itemToTrack({
            id: "dQw4w9WgXcQ",
            title: "Song",
            artist: "Artist",
            channelId: "UC1",
            duration: 213,
            position: 0,
            thumbnails: [{ url: "//i.ytimg.com/x.jpg", width: 120, height: 90 }],
            releasedDate: "2024-01-01",
        });

        expect(track.source).toBe(MusicSource.Youtube);
        expect(track.id).toBe("dQw4w9WgXcQ");
        expect(track.name).toBe("Song");
        expect(track.duration).toBe(213_000);
        expect(track.thumbnail).toBe("https://i.ytimg.com/x.jpg");
        expect(track.artist).toEqual([{ name: "Artist", id: "UC1" }]);
        expect(track.releasedDate).toBe("2024-01-01");
    });

    test("fills defaults for missing artist, channel and thumbnail", () => {
        const track = itemToTrack({
            id: "abcdefghijk",
            title: "No Metadata",
            artist: "",
            channelId: null,
            duration: 0,
            position: 0,
            thumbnails: [],
        });

        expect(track.artist).toEqual([{ name: "Unknown Artist", id: "" }]);
        expect(track.thumbnail).toBe("https://i.ytimg.com/vi/abcdefghijk/default.jpg");
        expect(track.releasedDate).toBe("");
    });
});
