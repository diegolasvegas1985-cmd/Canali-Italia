const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');

const M3U_URL = process.env.M3U_URL || 'https://raw.githubusercontent.com/diegolasvegas1985-cmd/Canali-Italia/refs/heads/main/italy.m3u';

const builder = new addonBuilder({
    id: 'org.diegolasvegas.tvitalia.fast.color',
    version: '3.1.0',
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

async function parseM3U() {
    try {
        const response = await axios.get(M3U_URL, { timeout: 10000 });
        const lines = response.data.split(/\r?\n/);
        const channels = [];
        let currentChannel = null;

        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('#EXTINF:')) {
                const nameMatch = line.match(/,(.+)$/);
                const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                
                const name = nameMatch ? nameMatch[1].trim() : 'Canale TV';
                const logo = logoMatch ? logoMatch[1] : '';

                currentChannel = { name, logo };
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

builder.defineCatalogHandler(async (args) => {
    if (args.type === 'series' && args.id === 'tv_italia_catalog_fast') {
        return {
            metas: [
                {
                    id: 'tv_italia_fast_container',
                    type: 'series',
                    name: 'TV Italia Live',
                    poster: 'https://placehold.co/300x450/1e293b/38bdf8/png?text=TV&font=montserrat',
                    background: 'https://placehold.co/1200x675/1e293b/38bdf8/png?text=TV+ITALIA+LIVE&font=montserrat',
                    description: 'Clicca per aprire la lista e fare zapping dal player.'
                }
            ]
        };
    }
    return { metas: [] };
});

builder.defineMetaHandler(async (args) => {
    if (args.type === 'series' && args.id === 'tv_italia_fast_container') {
        const channels = await parseM3U();
        const videos = channels.map((ch, index) => {
            const epNum = index + 1;
            const formattedNum = epNum < 10 ? `0${epNum}` : `${epNum}`;
            return {
                id: `tv_italia_fast_container:1:${epNum}`,
                title: `${formattedNum} - ${ch.name}`,
                released: new Date().toISOString(),
                season: 1,
                episode: epNum,
                thumbnail: ch.logo || 'https://placehold.co/300x170/334155/ffffff/png?text=TV'
            };
        });

        return {
            meta: {
                id: 'tv_italia_fast_container',
                type: 'series',
                name: 'TV Italia Live',
                poster: 'https://placehold.co/300x450/1e293b/38bdf8/png?text=TV&font=montserrat',
                background: 'https://placehold.co/1200x675/1e293b/38bdf8/png?text=TV+ITALIA+LIVE&font=montserrat',
                description: 'Usa il menu laterale del player per cambiare canale all\'istante.',
                videos: videos
            }
        };
    }
    return { meta: null };
});

builder.defineStreamHandler(async (args) => {
    if (args.type === 'series') {
        const parts = args.id.split(':');
        if (parts.length === 3) {
            const epNum = parseInt(parts[2], 10);
            const channels = await parseM3U();
            const channel = channels[epNum - 1];

            if (channel) {
                return {
                    streams: [
                        {
                            title: `Diretta - ${channel.name}`,
                            url: channel.url,
                            behaviorHints: { notWebReady: true }
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
