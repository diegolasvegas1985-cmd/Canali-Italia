const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');

const M3U_URL = process.env.M3U_URL || 'https://raw.githubusercontent.com/diegolasvegas1985-cmd/Canali-Italia/refs/heads/main/italy.m3u';

const builder = new addonBuilder({
    id: 'org.diegolasvegas.tvitalia',
    version: '1.0.7',
    name: 'TV Italia Live',
    description: 'Canali TV italiani in chiaro',
    resources: ['catalog', 'stream'],
    types: ['movie'],
    catalogs: [
        {
            type: 'movie',
            id: 'tv_italia_catalog',
            name: 'Canali Italia'
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
                const id = 'tv_' + Buffer.from(name).toString('hex').slice(0, 16);

                currentChannel = { id, name, logo };
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

builder.defineCatalogHandler(async (args) => {
    if (args.type === 'movie' && args.id === 'tv_italia_catalog') {
        const channels = await parseM3U();
        const metas = channels.map(ch => ({
            id: ch.id,
            type: 'movie',
            name: ch.name,
            poster: ch.logo || 'https://via.placeholder.com/300x450?text=TV+Italia',
            description: `Guarda ${ch.name} in diretta`
        }));
        return { metas };
    }
    return { metas: [] };
});

builder.defineStreamHandler(async (args) => {
    console.log('Richiesta stream per ID:', args.id);
    const channels = await parseM3U();
    const channel = channels.find(ch => ch.id === args.id);

    if (channel) {
        console.log('Canale trovato:', channel.name);
        return {
            streams: [
                {
                    title: `Diretta - ${channel.name}`,
                    url: channel.url
                }
            ]
        };
    }
    return { streams: [] };
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
