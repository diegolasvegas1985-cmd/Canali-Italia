const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');

// URL predefinito della tua lista (modificabile anche tramite variabile d'ambiente M3U_URL su Render)
const M3U_URL = process.env.M3U_URL || 'https://raw.githubusercontent.com/diegolasvegas1985-cmd/Canali-Italia/refs/heads/main/stremio.m3u';

const builder = new addonBuilder({
    id: 'org.diegolasvegas.tvitalia',
    version: '1.0.0',
    name: 'TV Italia Live',
    description: 'Canali TV italiani in chiaro',
    resources: ['catalog', 'stream'],
    types: ['tv'],
    catalogs: [
        {
            type: 'tv',
            id: 'tv_italia_catalog',
            name: 'Canali Italia'
        }
    ]
});

// Funzione di parsing del file M3U
async function parseM3U() {
    try {
        const response = await axios.get(M3U_URL);
        const lines = response.data.split('\n');
        const channels = [];
        let currentChannel = {};

        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('#EXTINF:')) {
                const nameMatch = line.match(/,(.+)$/);
                const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                
                const name = nameMatch ? nameMatch[1].trim() : 'Canale Sconosciuto';
                const logo = logoMatch ? logoMatch[1] : '';
                
                // Genera un ID unico basato sul nome del canale
                const id = 'tv_' + Buffer.from(name).toString('hex').slice(0, 16);

                currentChannel = { id, name, logo };
            } else if (line.startsWith('http')) {
                if (currentChannel.name) {
                    currentChannel.url = line;
                    channels.push(currentChannel);
                    currentChannel = {};
                }
            }
        }
        return channels;
    } catch (error) {
        console.error('Errore durante il recupero della lista M3U:', error.message);
        return [];
    }
}

// Handler per il catalogo (mostra la griglia dei canali)
builder.defineCatalogHandler(async () => {
    const channels = await parseM3U();
    const metas = channels.map(ch => ({
        id: ch.id,
        type: 'tv',
        name: ch.name,
        poster: ch.logo || 'https://via.placeholder.com/300x450?text=TV',
        description: `Streaming live di ${ch.name}`
    }));

    return { metas };
});

// Handler per lo streaming (fornisce il link del canale selezionato)
builder.defineStreamHandler(async (args) => {
    const channels = await parseM3U();
    const channel = channels.find(ch => ch.id === args.id);

    if (channel) {
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

// Avvio del server HTTP
const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
