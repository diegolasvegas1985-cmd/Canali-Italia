const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 7000;
const PLAYLIST_FILE = path.join(__dirname, "italy.m3u");

let cache = {
    time: 0,
    channels: []
};

const CACHE_TIME = 5 * 60 * 1000;

// ----------------------------------------------------
// ID CANALE
// ----------------------------------------------------

function makeId(url) {
    return Buffer
        .from(url, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

// ----------------------------------------------------
// PARSE ATTRIBUTI M3U
// ----------------------------------------------------

function parseAttributes(line) {
    const attrs = {};
    const regex = /([\w-]+)="([^"]*)"/g;

    let match;

    while ((match = regex.exec(line)) !== null) {
        attrs[match[1]] = match[2];
    }

    return attrs;
}

// ----------------------------------------------------
// CATEGORIA AUTOMATICA
// ----------------------------------------------------

function detectCategory(name, tvgId) {

    const text = (
        (name || "") +
        " " +
        (tvgId || "")
    ).toLowerCase();

    // RAI
    if (
        text.includes("rai ") ||
        text.startsWith("rai") ||
        text.includes("raimovie") ||
        text.includes("raipremium") ||
        text.includes("rai news") ||
        text.includes("rai sport") ||
        text.includes("rai yoyo") ||
        text.includes("rai gulp")
    ) {
        return "Rai";
    }

    // MEDIASET
    if (
        text.includes("canale 5") ||
        text.includes("italia 1") ||
        text.includes("rete 4") ||
        text.includes("20 mediaset") ||
        text.includes("iris") ||
        text.includes("la5") ||
        text.includes("la 5") ||
        text.includes("mediaset")
    ) {
        return "Mediaset";
    }

    // NEWS
    if (
        text.includes("tg") ||
        text.includes("news") ||
        text.includes("sky tg") ||
        text.includes("all news") ||
        text.includes("class cnbc") ||
        text.includes("rainews")
    ) {
        return "News";
    }

    // SPORT
    if (
        text.includes("sport") ||
        text.includes("calcio") ||
        text.includes("football") ||
        text.includes("tennis") ||
        text.includes("motogp") ||
        text.includes("formula 1") ||
        text.includes("f1")
    ) {
        return "Sport";
    }

    // CINEMA
    if (
        text.includes("movie") ||
        text.includes("cinema") ||
        text.includes("film")
    ) {
        return "Cinema";
    }

    // INTRATTENIMENTO
    if (
        text.includes("real time") ||
        text.includes("dmax") ||
        text.includes("focus") ||
        text.includes("nove") ||
        text.includes("cielo") ||
        text.includes("tv8") ||
        text.includes("discovery") ||
        text.includes("food") ||
        text.includes("giallo") ||
        text.includes("top crime")
    ) {
        return "Intrattenimento";
    }

    return "Altri";
}

// ----------------------------------------------------
// PARSE M3U
// ----------------------------------------------------

function parseM3U(data) {

    const lines = data.split(/\r?\n/);

    const channels = [];

    let current = null;

    for (let i = 0; i < lines.length; i++) {

        const line = lines[i].trim();

        if (!line) {
            continue;
        }

        if (line.startsWith("#EXTINF")) {

            const attrs = parseAttributes(line);

            const comma = line.indexOf(",");

            let name = "";

            if (comma !== -1) {
                name = line
                    .substring(comma + 1)
                    .trim();
            }

            if (!name) {
                name =
                    attrs["tvg-name"] ||
                    attrs["tvg-id"] ||
                    "Canale";
            }

            current = {
                name: name,
                logo: attrs["tvg-logo"] || "",
                tvgId: attrs["tvg-id"] || "",
                group: attrs["group-title"] || ""
            };

            continue;
        }

        // URL dello stream
        if (
            current &&
            !line.startsWith("#") &&
            /^https?:\/\//i.test(line)
        ) {

            const category = detectCategory(
                current.name,
                current.tvgId
            );

            channels.push({
                id: makeId(line),
                name: current.name,
                logo: current.logo,
                tvgId: current.tvgId,
                group: current.group,
                category: category,
                url: line
            });

            current = null;
        }
    }

    return channels;
}

// ----------------------------------------------------
// CARICA PLAYLIST
// ----------------------------------------------------

function getChannels() {

    const now = Date.now();

    if (
        cache.channels.length > 0 &&
        now - cache.time < CACHE_TIME
    ) {
        return cache.channels;
    }

    if (!fs.existsSync(PLAYLIST_FILE)) {

        console.error(
            "ERRORE: italy.m3u non trovato:",
            PLAYLIST_FILE
        );

        return [];
    }

    try {

        const data = fs.readFileSync(
            PLAYLIST_FILE,
            "utf8"
        );

        const channels = parseM3U(data);

        cache = {
            time: now,
            channels: channels
        };

        console.log(
            `Playlist caricata: ${channels.length} canali`
        );

        return channels;

    } catch (error) {

        console.error(
            "Errore lettura M3U:",
            error
        );

        return [];
    }
}

// ----------------------------------------------------
// CATALOGHI
// ----------------------------------------------------

const catalogs = [

    {
        type: "tv",
        id: "tutti",
        name: "🇮🇹 Tutti i canali"
    },

    {
        type: "tv",
        id: "rai",
        name: "📺 Rai"
    },

    {
        type: "tv",
        id: "mediaset",
        name: "📺 Mediaset"
    },

    {
        type: "tv",
        id: "news",
        name: "📰 News"
    },

    {
        type: "tv",
        id: "sport",
        name: "🏆 Sport"
    },

    {
        type: "tv",
        id: "cinema",
        name: "🎬 Cinema"
    },

    {
        type: "tv",
        id: "intrattenimento",
        name: "🎭 Intrattenimento"
    },

    {
        type: "tv",
        id: "altri",
        name: "📡 Altri"
    }
];

// ----------------------------------------------------
// MANIFEST
// ----------------------------------------------------

const manifest = {

    id: "com.diego.canaliitalia",

    version: "1.1.0",

    name: "🇮🇹 Canali Italia",

    description:
        "Canali TV italiani personali da playlist M3U",

    resources: [
        "catalog",
        "stream"
    ],

    types: [
        "tv"
    ],

    catalogs: catalogs
};

// ----------------------------------------------------
// ADDON
// ----------------------------------------------------

const builder = new addonBuilder(manifest);

// ----------------------------------------------------
// CATALOGO
// ----------------------------------------------------

builder.defineCatalogHandler(async ({ type, id }) => {

    console.log(
        `Catalogo richiesto: ${type}/${id}`
    );

    const channels = getChannels();

    let filtered = channels;

    switch (id) {

        case "rai":
            filtered = channels.filter(
                c => c.category === "Rai"
            );
            break;

        case "mediaset":
            filtered = channels.filter(
                c => c.category === "Mediaset"
            );
            break;

        case "news":
            filtered = channels.filter(
                c => c.category === "News"
            );
            break;

        case "sport":
            filtered = channels.filter(
                c => c.category === "Sport"
            );
            break;

        case "cinema":
            filtered = channels.filter(
                c => c.category === "Cinema"
            );
            break;

        case "intrattenimento":
            filtered = channels.filter(
                c => c.category === "Intrattenimento"
            );
            break;

        case "altri":
            filtered = channels.filter(
                c => c.category === "Altri"
            );
            break;

        case "tutti":
        default:
            break;
    }

    console.log(
        `Canali restituiti: ${filtered.length}`
    );

    return {

        metas: filtered.map(channel => ({

            id: channel.id,

            type: "tv",

            name: channel.name,

            poster:
                channel.logo ||
                undefined,

            posterShape: "landscape",

            description:
                channel.category +
                (
                    channel.group
                        ? "\n" + channel.group
                        : ""
                )
        }))
    };
});

// ----------------------------------------------------
// STREAM
// ----------------------------------------------------

builder.defineStreamHandler(async ({ id }) => {

    console.log(
        `Stream richiesto: ${id}`
    );

    const channels = getChannels();

    const channel = channels.find(
        c => c.id === id
    );

    if (!channel) {

        console.error(
            "Canale non trovato:",
            id
        );

        return {
            streams: []
        };
    }

    console.log(
        `Riproduzione: ${channel.name}`
    );

    return {

        streams: [

            {

                name: channel.name,

                title:
                    channel.category,

                url: channel.url,

                behaviorHints: {

                    notWebReady: true

                }
            }
        ]
    };
});

// ----------------------------------------------------
// SERVER
// ----------------------------------------------------

serveHTTP(
    builder.getInterface(),
    {
        port: PORT
    }
);

console.log(
    `🇮🇹 Canali Italia addon avviato sulla porta ${PORT}`
);

console.log(
    `Playlist: ${PLAYLIST_FILE}`
);
