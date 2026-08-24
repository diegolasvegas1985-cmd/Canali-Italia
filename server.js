const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const https = require('https');
const http = require('http');

const PORT = process.env.PORT || 7000;
const PLAYLIST_URL = process.env.PLAYLIST_URL || 'https://raw.githubusercontent.com/diegolasvegas1985-cmd/Canali-Italia/main/italy.m3u';
const CACHE_SECONDS = Number(process.env.CACHE_SECONDS || 300);

let cache = { loadedAt: 0, channels: [] };

function fetchText(url, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Stremio-M3U-Addon/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        return fetchText(next, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Playlist HTTP ${res.statusCode}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.setTimeout(20000, () => req.destroy(new Error('Playlist timeout')));
    req.on('error', reject);
  });
}

function parseAttributes(line) {
  const attrs = {};
  const re = /([\w-]+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(line)) !== null) attrs[m[1]] = m[2];
  return attrs;
}

function parseM3U(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const channels = [];
  let pending = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      const attrs = parseAttributes(line);
      const comma = line.indexOf(',');
      const name = comma >= 0 ? line.slice(comma + 1).trim() : (attrs['tvg-name'] || 'Canale');
      pending = {
        name: name || attrs['tvg-name'] || 'Canale',
        logo: attrs['tvg-logo'] || '',
        group: attrs['group-title'] || 'Canali Italia',
        tvgId: attrs['tvg-id'] || ''
      };
      continue;
    }

    if (!line.startsWith('#') && pending) {
      if (/^https?:\/\//i.test(line)) {
        channels.push({ ...pending, url: line });
      }
      pending = null;
    }
  }
  return channels;
}

async function getChannels() {
  const fresh = cache.channels.length && (Date.now() - cache.loadedAt < CACHE_SECONDS * 1000);
  if (fresh) return cache.channels;

  const text = await fetchText(PLAYLIST_URL);
  const channels = parseM3U(text);
  cache = { loadedAt: Date.now(), channels };
  console.log(`Playlist caricata: ${channels.length} canali`);
  return channels;
}

function idFor(index, channel) {
  return Buffer.from(`${index}|${channel.url}`, 'utf8').toString('base64url');
}

function findChannel(channels, id) {
  for (let i = 0; i < channels.length; i++) {
    if (idFor(i, channels[i]) === id) return { channel: channels[i], index: i };
  }
  return null;
}

const builder = new addonBuilder({
  id: 'com.diegolasvegas.canaliitalia',
  version: '1.0.0',
  name: 'Canali Italia',
  description: 'Canali TV italiani da playlist M3U personale.',
  resources: ['catalog', 'stream'],
  types: ['tv'],
  catalogs: [
    { type: 'tv', id: 'canali-italia', name: 'Canali Italia' }
  ],
  behaviorHints: { configurable: false, configurationRequired: false }
});

builder.defineCatalogHandler(async () => {
  try {
    const channels = await getChannels();
    return {
      metas: channels.map((c, i) => ({
        id: idFor(i, c),
        type: 'tv',
        name: c.name,
        poster: c.logo || undefined,
        posterShape: 'landscape',
        description: c.group
      }))
    };
  } catch (err) {
    console.error('Catalog error:', err.message);
    return { metas: [] };
  }
});

builder.defineStreamHandler(async ({ id }) => {
  try {
    const channels = await getChannels();
    const found = findChannel(channels, id);
    if (!found) return { streams: [] };

    return {
      streams: [{
        name: found.channel.name,
        title: found.channel.group,
        url: found.channel.url,
        behaviorHints: { notWebReady: true }
      }]
    };
  } catch (err) {
    console.error('Stream error:', err.message);
    return { streams: [] };
  }
});

serveHTTP(builder.getInterface(), { port: PORT });
console.log(`Canali Italia addon running on port ${PORT}`);
