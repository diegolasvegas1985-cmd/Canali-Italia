const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');

const M3U_URL = process.env.M3U_URL || 'https://raw.githubusercontent.com/diegolasvegas1985-cmd/Canali-Italia/refs/heads/main/italy.m3u';

const builder = new addonBuilder({
    id: 'org.diegolasvegas.tvitalia',
    version: '1.2.0',
    name: 'TV Italia Live',
    description: 'Canali TV italiani con menu zapping rapido',
    resources: ['catalog', 'meta', 'stream'],
    types: ['series'],
    catalogs: [
        {
            type: 'series',
            id: 'tv_italia_catalog',
            name: 'Canali Italia - Lista Canali'
        }
    ]
});

async function parseM3U() {
    try {
        console.log('Scaricamento M3U da:', M3U_URL);
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
        console.log(`Trovati ${channels.length} canali.`);
        return channels;
    } catch (error) {
        console.error('Errore download M3U:', error.message);
        return [];
    }
}

// RESTITUISCE IL CONTENITORE PRINCIPALE NEL CATALOGO
builder.defineCatalogHandler(async (args) => {
    if (args.type === 'series' && args.id === 'tv_italia_catalog') {
        return {
            metas: [
                {
                    id: 'tv_italia_all_channels',
                    type: 'series',
                    name: 'TV Italiana - Elenco Canali',
                    poster: 'https://via.placeholder.com/300x450?text=TV+Italia+Live',
                    description: 'Tutti i canali TV italiani ordinati come episodi per il cambio rapido.'
                }
            ]
        };
    }
    return { metas: [] };
});

// TRASFORMA OGNI CANALE IN UN "EPISODIO" DELLA SERIE
builder.defineMetaHandler(async (args) => {
    if (args.type === 'series' && args.id === 'tv_italia_all_channels') {
        const channels = await parseM3U();
        const videos = channels.map((ch, index) => {
            const epNum = index + 1;
            const formattedNum = epNum < 10 ? `0${epNum}` : `${epNum}`;
            return {
                id: `tv_italia_all_channels:1:${epNum}`,
                title: `${formattedNum} - ${ch.name}`,
                released: new Date().toISOString(),
                season: 1,
                episode: epNum,
                thumbnail: ch.logo || 'https://via.placeholder.com/300x170?text=TV'
            };
        });

        return {
            meta: {
                id: 'tv_italia_all_channels',
                type: 'series',
                name: 'TV Italiana - Elenco Canali',
                poster: 'https://via.placeholder.com/300x450?text=TV+Italia+Live',
                description: 'Seleziona un canale e usa il menu laterale degli episodi per fare zapping.',
                videos: videos
            }
        };
    }
    return { meta: null };
});

// GESTISCE LO STREAMING IN BASE ALL'EPISODIO SCELTO
builder.defineStreamHandler(async (args) => {
    console.log('Richiesta stream per ID:', args.id);
    if (args.type === 'series') {
        const parts = args.id.split(':');
        if (parts.length === 3) {
            const epNum = parseInt(parts[2], 10);
            const channels = await parseM3U();
            const channel = channels[epNum - 1]; // Indice array 0-based

            if (channel) {
                console.log(`Canale trovato per episodio ${epNum}: ${channel.name}`);
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
