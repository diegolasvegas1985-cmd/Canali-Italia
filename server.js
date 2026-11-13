
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');

const M3U_URL = process.env.M3U_URL ||
    'https://raw.githubusercontent.com/diegolasvegas1985-cmd/Canali-Italia/refs/heads/main/italy.m3u';

const BASE_ID = 'tv_italia_fast_container';

const FALLBACK_POSTER =
    'https://placehold.co/300x170/334155/ffffff/png?text=TV';

const builder = new addonBuilder({
    id: 'org.diegolasvegas.tvitalia.fast.color',
    version: '3.2.0',
    name: 'TV Italia Live',
    description: 'Canali TV italiani con zapping rapido',
    resources: ['catalog', 'meta', 'stream'],
    types: ['series'],
    catalogs: [
        {
            type: 'series',
            id: 'tv_italia_catalog_fast',
            name: 'Canali Italia - Zapping'
        }
    ]
});

// DOWNLOAD E LETTURA PLAYLIST M3U
async function parseM3U() {
    try {
        const response = await axios.get(M3U_URL, {
            timeout: 15000
        });

        const lines = response.data.split(/\r?\n/);
        const channels = [];
        let currentChannel = null;

        for (let line of lines) {
            line = line.trim();

            if (line.startsWith('#EXTINF:')) {
                const nameMatch = line.match(/,(.+)$/);
                const logoMatch = line.match(/tvg-logo="([^"]+)"/);

                currentChannel = {
                    name: nameMatch
                        ? nameMatch[1].trim()
                        : 'Canale TV',
                    logo: logoMatch ? logoMatch[1] : ''
                };

            } else if (line.startsWith('http') && currentChannel) {
                currentChannel.url = line;
                channels.push(currentChannel);
                currentChannel = null;
            }
        }

        return channels;

    } catch (error) {
        console.error('Errore download M3U:', error.message);
        return [];
    }
}

// CATALOGO: UNA LOCANDINA PER OGNI CANALE
builder.defineCatalogHandler(async (args) => {
    if (
        args.type === 'series' &&
        args.id === 'tv_italia_catalog_fast'
    ) {
        const channels = await parseM3U();

        return {
            metas: channels.map((ch, index) => ({
                id: `${BASE_ID}:${index + 1}`,
                type: 'series',
                name: ch.name,
                poster: ch.logo || FALLBACK_POSTER,
                posterShape: 'landscape',
                description: 'TV Italia Live - Zapping rapido'
            }))
        };
    }

    return { metas: [] };
});

// DETTAGLIO: IL CANALE SELEZIONATO È IL PRIMO
builder.defineMetaHandler(async (args) => {
    if (
        args.type === 'series' &&
        args.id.startsWith(BASE_ID + ':')
    ) {
        const channels = await parseM3U();

        const selectedIndex = parseInt(
            args.id.split(':')[1],
            10
        ) - 1;

        if (
            selectedIndex < 0 ||
            selectedIndex >= channels.length
        ) {
            return { meta: null };
        }

        // Prima il canale scelto, poi tutti gli altri
        const orderedChannels = [
            channels[selectedIndex],
            ...channels.filter((_, i) => i !== selectedIndex)
        ];

        const videos = orderedChannels.map((ch, order) => {
            const originalIndex = channels.indexOf(ch);
            const number = String(originalIndex + 1).padStart(2, '0');

            return {
                id: `${args.id}:1:${originalIndex + 1}`,
                title: `${number} - ${ch.name}`,
                released: new Date().toISOString(),
                season: 1,
                episode: order + 1,
                thumbnail: ch.logo || FALLBACK_POSTER
            };
        });

        return {
            meta: {
                id: args.id,
                type: 'series',
                name: channels[selectedIndex].name,
                poster: channels[selectedIndex].logo || FALLBACK_POSTER,
                description:
                    'Seleziona il canale e usa il menu laterale del player per fare zapping.',
                videos
            }
        };
    }

    return { meta: null };
});

// STREAM: RIPRODUZIONE DEL CANALE CORRETTO
builder.defineStreamHandler(async (args) => {
    if (args.type === 'series') {
        const parts = args.id.split(':');

        if (
            parts.length === 4 &&
            parts[0] === BASE_ID
        ) {
            const channelIndex = parseInt(parts[3], 10) - 1;
            const channels = await parseM3U();
            const channel = channels[channelIndex];

            if (channel) {
                return {
                    streams: [
                        {
                            title: `Diretta - ${channel.name}`,
                            url: channel.url,
                            behaviorHints: {
                                notWebReady: true
                            }
                        }
                    ]
                };
            }
        }
    }

    return { streams: [] };
});

const port = process.env.PORT || 7000;

serveHTTP(builder.getInterface(), { port });
