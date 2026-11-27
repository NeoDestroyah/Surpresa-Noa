(()=>{"use strict";const modules={"./music-visuals":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PulseDetector = exports.environmentColors = exports.audioVisual = void 0;
exports.parseLyrics = parseLyrics;
exports.cueAt = cueAt;
exports.blendAtmosphere = blendAtmosphere;
exports.visualMood = visualMood;
exports.environmentRGB = environmentRGB;
exports.shiftCueRange = shiftCueRange;
exports.clearDynamics = clearDynamics;
exports.stampLRC = stampLRC;
exports.updateDynamics = updateDynamics;
exports.scoreAt = scoreAt;
exports.audioVisual = { bass: 0, energy: 0, treble: 0, dynamics: 0, accent: 0, onset: 0, contrast: 0, score: 0, depth: 0, beat: 0 };
function parseLyrics(raw, seconds = 4) {
    if (raw.length > 65536)
        throw Error('Arquivo muito grande (limite de 64 KiB).');
    const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/), cues = [];
    const offset = Number(raw.match(/^\[offset:([+-]?\d+)\]/mi)?.[1] || 0) / 1000;
    const stamp = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    for (const line of lines) {
        const stamps = [...line.matchAll(stamp)];
        const body = line.replace(stamp, '').trim();
        const wordStamp = /<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/g;
        const tags = [...body.matchAll(wordStamp)];
        const text = body.replace(wordStamp, '').trim().slice(0, 300);
        const words = tags.slice(0, 100).flatMap((m, i) => { const at = Math.max(0, +m[1] * 60 + +m[2] + Number('0.' + (m[3] || '0')) + offset), text = body.slice(m.index + m[0].length, tags[i + 1]?.index ?? body.length); return +m[2] < 60 && at <= 7200 && text ? [{ at, text }] : []; });
        const validWords = words.length > 0 && words.map(w => w.text).join('').trim() === text && words.every((w, i) => i === 0 || w.at >= words[i - 1].at);
        for (const m of stamps) {
            if (+m[2] >= 60)
                continue;
            const at = Math.max(0, +m[1] * 60 + +m[2] + Number('0.' + (m[3] || '0')) + offset);
            if (at <= 7200)
                cues.push(validWords ? { at, text, words: words.map(w => ({ text: w.text, at: Math.max(at, w.at) })) } : { at, text });
        }
    }
    if (cues.length) {
        cues.sort((a, b) => a.at - b.at);
        return { cues: cues.slice(0, 500), timed: true };
    }
    const clean = lines.map(l => l.trim()).filter(l => l && !/^\[\w+:.*\]$/.test(l));
    if (!clean.length)
        throw Error('Nenhuma linha encontrada.');
    if (lines.some(l => /\[\d+:/.test(l)))
        throw Error('Horários inválidos. Use [mm:ss.xx].');
    const interval = Number.isFinite(seconds) ? Math.max(1, Math.min(20, seconds)) : 4;
    return { cues: clean.slice(0, 500).map((text, i) => ({ at: i * interval, text: text.slice(0, 300) })), timed: false };
}
function cueAt(cues, time) { let lo = 0, hi = cues.length; while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (cues[mid].at <= time)
        lo = mid + 1;
    else
        hi = mid;
} return lo - 1; }
function blendAtmosphere(mix, target, dt, instant = false) {
    const a = instant ? 1 : 1 - Math.exp(-Math.max(0, Math.min(.1, dt)) * 5.5);
    for (const key of ['stars', 'rain', 'aurora']) {
        const goal = key === target ? 1 : 0;
        mix[key] += (goal - mix[key]) * a;
        if (Math.abs(goal - mix[key]) < .001)
            mix[key] = goal;
    }
    return mix;
}
exports.environmentColors = { wine: [1, .57, .73], amber: [1, .83, .53], violet: [.74, .62, 1], silver: [.65, .8, 1], rose: [1, .65, .83] };
function visualMood() { const d = document.documentElement.dataset; return d.salonPalette && d.salonPalette !== 'music' ? d.salonPalette : d.musicMood || ''; }
function environmentRGB() { return exports.environmentColors[visualMood()] || [1, .86, .94]; }
let baseline = 0, previous = 0;
class PulseDetector {
    constructor() {
        this.prev = null;
        this.mean = 0;
        this.deviation = 0;
        this.last = -Infinity;
        this.time = -1;
    }
    reset() { this.prev = null; this.mean = this.deviation = 0; this.last = -Infinity; this.time = -1; }
    sample(bins, hz, t) {
        if (!Number.isFinite(t) || !Number.isFinite(hz) || hz <= 0)
            return 0;
        const hi = Math.min(bins.length - 1, Math.floor(4200 / hz));
        if (hi < 1)
            return 0;
        if (!this.prev || this.prev.length !== bins.length || t < this.time || t - this.time > .45) {
            this.prev = Float32Array.from(bins, v => v / 255);
            this.mean = this.deviation = 0;
            this.last = -Infinity;
            this.time = t;
            return 0;
        }
        this.time = t;
        let flux = 0, weight = 0, level = 0;
        for (let i = 1; i <= hi; i++) {
            const v = bins[i] / 255, w = i * hz < 280 ? 2.2 : 1;
            flux += Math.max(0, v - this.prev[i]) * w;
            level += v * w;
            weight += w;
            this.prev[i] = v;
        }
        flux /= weight;
        level /= weight;
        const threshold = Math.max(.025, this.mean + 1.8 * this.deviation);
        const hit = level > .06 && flux > threshold && t - this.last >= .24;
        this.deviation += (Math.abs(flux - this.mean) - this.deviation) * .12;
        this.mean += (flux - this.mean) * .1;
        if (hit) {
            this.last = t;
            return Math.min(1, flux * 3.4);
        }
        return 0;
    }
}
exports.PulseDetector = PulseDetector;
function shiftCueRange(cues, first, last, delta, duration = 7200) {
    if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last < first || last >= cues.length || !Number.isFinite(delta) || !Number.isFinite(duration))
        throw Error('Intervalo inválido.');
    const shift = (v) => Math.round((v + delta) * 100) / 100;
    const result = cues.map((c, i) => i < first || i > last ? c : { ...c, at: shift(c.at), words: c.words?.map(w => ({ ...w, at: shift(w.at) })) });
    for (let i = 0; i < result.length; i++) {
        const c = result[i], next = result[i + 1]?.at ?? duration;
        if (!Number.isFinite(c.at) || c.at < 0 || c.at > duration || (i && c.at < result[i - 1].at) || ((i === first && i > 0 || i === last + 1) && c.at <= result[i - 1].at) || c.words?.some(w => w.at < c.at || w.at > next))
            throw Error('A correção ultrapassa o início, o fim ou outra linha.');
    }
    return result;
}
function clearDynamics() { baseline = previous = 0; exports.audioVisual.onset = exports.audioVisual.contrast = exports.audioVisual.beat = 0; }
function stampLRC(seconds) { const n = Math.max(0, Math.round(seconds * 100)); return `[${String(Math.floor(n / 6000)).padStart(2, '0')}:${String(Math.floor(n / 100) % 60).padStart(2, '0')}.${String(n % 100).padStart(2, '0')}]`; }
function updateDynamics(energy, bass) {
    const e = Math.max(0, Math.min(1, energy)), b = Math.max(0, Math.min(1, bass));
    baseline += (e - baseline) * .045;
    const flux = Math.max(0, e - previous), transient = Math.max(0, flux - .018) * 3.2;
    previous = e;
    exports.audioVisual.onset = Math.max(exports.audioVisual.onset * .74, Math.min(1, transient));
    exports.audioVisual.contrast += (Math.max(0, e - baseline) - exports.audioVisual.contrast) * .18;
    exports.audioVisual.accent = Math.min(1, Math.max(exports.audioVisual.accent * .72, Math.max(0, b - exports.audioVisual.bass) * 1.8, exports.audioVisual.onset * .6));
    exports.audioVisual.dynamics += (e - exports.audioVisual.dynamics) * (e > exports.audioVisual.dynamics ? .065 : .035);
}
const scores = {
    'Oq-xMg1xbic': [[0, 'intro', .18, .58], [40.43, 'verse', .35, .56], [78.30, 'refrain', .86, .85], [108.82, 'verse', .42, .65], [147.98, 'refrain', .85, .9], [178.41, 'bridge', .52, .75], [202.46, 'instrumental', .62, .95], [217.95, 'refrain', .92, 1], [248.85, 'outro', .16, .42]],
    'JBfAtRvW1Ao': [[0, 'intro', .16, .65], [17.3, 'verse', .38, .7], [43.78, 'refrain', .8, .88], [73.55, 'verse', .42, .62], [99.04, 'refrain', .83, .94], [125.52, 'instrumental', .68, 1], [163.93, 'bridge', .5, .75], [196.26, 'refrain', .92, 1], [218.46, 'bridge', .54, .84], [266.53, 'outro', .38, .6], [308.83, 'outro', .12, .4]],
    'Bm2Eg2X4kZA': [[0, 'intro', .22, .75], [39.49, 'verse', .42, .65], [55.6, 'refrain', .7, .85], [61.95, 'verse', .45, .6], [77.88, 'refrain', .77, .82], [100.73, 'verse', .5, .7], [116.05, 'refrain', .9, .95], [136.93, 'outro', .18, .45]],
    '3Xzb2uNlf0s': [[0, 'intro', .12, .55], [11.58, 'intro', .22, .65], [19.02, 'verse', .4, .68], [38.65, 'refrain', .82, .92], [69.65, 'instrumental', .58, .9], [83.91, 'verse', .4, .65], [111.44, 'refrain', .86, 1], [140.96, 'bridge', .5, .78], [165.63, 'refrain', .96, 1], [195.65, 'outro', .15, .5]],
    'tbYHzoBL8ec': [[0, 'intro', .24, .68], [13.8, 'verse', .44, .66], [42.4, 'refrain', .85, .9], [71.12, 'verse', .4, .65], [99.71, 'refrain', .85, .88], [129.35, 'bridge', .58, .8], [160.61, 'refrain', .95, 1], [178.11, 'outro', .16, .5]]
};
function scoreAt(id, t) { const a = scores[id]; if (!a || !Number.isFinite(t))
    return { phase: '', light: 0, depth: 0 }; let i = 0; while (i + 1 < a.length && t >= a[i + 1][0])
    i++; const next = a[i], prev = a[Math.max(0, i - 1)], u = Math.max(0, Math.min(1, (t - next[0]) / 2.4)), s = u * u * (3 - 2 * u); return { phase: next[1], light: prev[2] + (next[2] - prev[2]) * s, depth: prev[3] + (next[3] - prev[3]) * s }; }

},
"./config":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = exports.NAMES = void 0;
exports.NAMES = { apelido: 'Noa', completo: 'Emanuelly', de: 'Kauê' };
exports.CONFIG = {
    title: `Uma surpresa para você, ${exports.NAMES.apelido}`,
    kicker: `para a ${exports.NAMES.apelido}`,
    from: `de ${exports.NAMES.de} para ${exports.NAMES.completo} ♡`,
    sheet: { to: `Para a ${exports.NAMES.apelido}`, by: `de ${exports.NAMES.de}` },
    tag: [`Para`, `${exports.NAMES.apelido} ♡`],
    bands: [`✦  ${exports.NAMES.apelido}  ♡  ${exports.NAMES.completo}  ✦  `, `✦  友達 · amiga  ✦  大切 · importante  ✦  ありがとう · obrigado  ✦  `],
    met: '2026-10-15',
    metLabel: '15/10/2026 · 6h da manhã',
    sinceLines: ['já se passaram', 'dias desde aquela manhã no Evade'],
    gateText: 'Você recebeu uma pequena surpresa...',
    gateButton: 'ABRIR MINHA SURPRESA ♡',
    intro: [`Oie, ${exports.NAMES.apelido}… ♡`, 'Pare um minutinho.', 'Alguém fez uma coisa só para você.'],
    loading: ['preparando a surpresa…', 'amarrando os laços…', 'polvilhando brilho…', 'dobrando a carta…', 'quase pronto ♡'],
    greeting: "Uma surpresa para você, Noa. ❤️",
    finalLine1: 'Eu te amo, Emanuelly. ❤️',
    finalLine2: 'Obrigado por existir na minha vida. 💕',
    sign: '— Kauê ♡',
    timeline: [
        {
            "d": "15/10/2026 · 6h da manhã",
            "t": "Roblox, jogando Evade. Uma manhã completamente aleatória.",
            "icon": "game"
        },
        {
            "d": "A skin",
            "t": "Uma skin bonita, nomes diferentes e a ideia de fazer amizade.",
            "icon": "spark"
        },
        {
            "d": "O Discord",
            "t": "O contato pedido com um pouco de medo, e as primeiras conversas.",
            "icon": "chat"
        },
        {
            "d": "O dia inteiro",
            "t": "Estilos, desenhos, músicas e gostos em comum, tudo de forma natural.",
            "icon": "brush"
        },
        {
            "d": "Hoje",
            "t": "Uma amizade que virou muito importante.",
            "icon": "heart"
        }
    ],
    details: [
        {
            "t": "Rosa e preto",
            "icon": "bow",
            "fam": "estilo"
        },
        {
            "t": "Visual Kei (V-kei)",
            "icon": "bat",
            "fam": "estilo"
        },
        {
            "t": "Jirai Kei e estilos japoneses",
            "icon": "blossom",
            "fam": "estilo"
        },
        {
            "t": "Figures e colecionáveis",
            "icon": "figure",
            "fam": "colecao"
        },
        {
            "t": "Desenhos, mangás, manhwas e animes",
            "icon": "book",
            "fam": "midia"
        },
        {
            "t": "Cabelos de várias cores e franjas",
            "icon": "hair",
            "fam": "estilo"
        },
        {
            "t": "Guitarra",
            "icon": "guitar",
            "fam": "musica"
        },
        {
            "t": "Música de todos os tipos",
            "icon": "phones",
            "fam": "musica"
        }
    ],
    tracks: [
        {
            "id": "JBfAtRvW1Ao",
            "durationLabel": "5:37",
            "title": "Portishead — Glory Box (Live)",
            "note": "Escolhida para você",
            "cover": "https://i.ytimg.com/vi/JBfAtRvW1Ao/mqdefault.jpg"
        },
        {
            "id": "Bm2Eg2X4kZA",
            "durationLabel": "2:33",
            "title": "Belchior — Na Hora do Almoço",
            "note": "Escolhida para você",
            "cover": "https://i.ytimg.com/vi/Bm2Eg2X4kZA/mqdefault.jpg"
        },
        {
            "id": "3Xzb2uNlf0s",
            "durationLabel": "3:36",
            "title": "Vincy — Auto Sabotagem",
            "note": "Escolhida para você",
            "cover": "https://i.ytimg.com/vi/3Xzb2uNlf0s/mqdefault.jpg"
        },
        {
            "id": "Oq-xMg1xbic",
            "durationLabel": "4:20",
            "title": "The Neighbourhood — W.D.Y.W.F.M?",
            "note": "Escolhida para você",
            "cover": "https://i.ytimg.com/vi/Oq-xMg1xbic/mqdefault.jpg"
        },
        {
            "id": "tbYHzoBL8ec",
            "durationLabel": "3:28",
            "title": "Melanie Martinez — Gingerbread Man",
            "note": "Escolhida para você",
            "cover": "https://i.ytimg.com/vi/tbYHzoBL8ec/mqdefault.jpg"
        }
    ],
    gallery: [
        {
            "id": "01",
            "src": "./assets/images/image-5530e4ff0d14498b.jpg",
            "thumb": "./assets/images/image-6c48825e8878c2f1.webp",
            "thumbFallback": "./assets/images/image-6c48825e8878c2f1.webp",
            "w": 1200,
            "h": 1600,
            "alt": "Esboço em preto e branco de uma personagem de cabelo longo e franja",
            "cap": "",
            "kind": "desenhos"
        },
        {
            "id": "02",
            "src": "./assets/images/image-1b1a6f2d8727c7f2.jpg",
            "thumb": "./assets/images/image-97733a5f9429b1c9.webp",
            "thumbFallback": "./assets/images/image-97733a5f9429b1c9.webp",
            "w": 1200,
            "h": 1600,
            "alt": "Chaveiro da Hello Kitty de vestido roxo pendurado em uma bolsa rosa",
            "cap": "chaveiro Hello Kitty",
            "kind": "acessorios"
        },
        {
            "id": "03",
            "src": "./assets/images/image-6f3fefc4849a67ce.jpg",
            "thumb": "./assets/images/image-3f05a939ec10c010.webp",
            "thumbFallback": "./assets/images/image-3f05a939ec10c010.webp",
            "w": 1200,
            "h": 1600,
            "alt": "Esboço de uma personagem de cabelo longo ao lado de um monstro dentuço",
            "cap": "",
            "kind": "desenhos"
        },
        {
            "id": "04",
            "src": "./assets/images/image-66526e1108eb0253.jpg",
            "thumb": "./assets/images/image-3fdc3d9d21b5dedc.webp",
            "thumbFallback": "./assets/images/image-3fdc3d9d21b5dedc.webp",
            "w": 1200,
            "h": 1600,
            "alt": "Dois chaveiros da Hello Kitty, um de vestido listrado e outro de roxo",
            "cap": "chaveiros Hello Kitty",
            "kind": "acessorios"
        },
        {
            "id": "05",
            "src": "./assets/images/image-013d0da76d63be7f.jpg",
            "thumb": "./assets/images/image-ea073a929cff673b.webp",
            "thumbFallback": "./assets/images/image-ea073a929cff673b.webp",
            "w": 1600,
            "h": 955,
            "alt": "Ilustração de uma Miku de cabelo azul-esverdeado atendendo em um balcão de lanchonete",
            "cap": "",
            "kind": "desenhos"
        },
        {
            "id": "06",
            "src": "./assets/images/image-fe2b6e46d4717d53.jpg",
            "thumb": "./assets/images/image-4c2e6c781a57d71b.webp",
            "thumbFallback": "./assets/images/image-4c2e6c781a57d71b.webp",
            "w": 1200,
            "h": 1600,
            "alt": "Chaveiro da Hello Kitty de vestido listrado rosa e branco",
            "cap": "chaveiro Hello Kitty listrado",
            "kind": "acessorios"
        },
        {
            "id": "07",
            "src": "./assets/images/image-5e31d7968433ac2c.jpg",
            "thumb": "./assets/images/image-deb2c119e2b0073a.webp",
            "thumbFallback": "./assets/images/image-deb2c119e2b0073a.webp",
            "w": 1600,
            "h": 1200,
            "alt": "Estudos de personagem de orelhas longas de coelho, em rascunho e colorido",
            "cap": "",
            "kind": "desenhos"
        },
        {
            "id": "08",
            "src": "./assets/images/image-2af64cd80f17e41d.jpg",
            "thumb": "./assets/images/image-8997a649813e02dc.webp",
            "thumbFallback": "./assets/images/image-8997a649813e02dc.webp",
            "w": 976,
            "h": 1024,
            "alt": "Personagem sentada entre cogumelos azuis e roxos",
            "cap": "",
            "kind": "desenhos"
        },
        {
            "id": "09",
            "src": "./assets/images/image-60f0fa8a4b7bc4f8.jpg",
            "thumb": "./assets/images/image-a1d3cf40d0b56a88.webp",
            "thumbFallback": "./assets/images/image-a1d3cf40d0b56a88.webp",
            "w": 1387,
            "h": 1080,
            "alt": "Rosto sorridente de uma personagem com asas de morcego e cartola pequena",
            "cap": "",
            "kind": "desenhos"
        },
        {
            "id": "10",
            "src": "./assets/images/image-09f7f38a5d363d48.jpg",
            "thumb": "./assets/images/image-ce789c008a963e68.webp",
            "thumbFallback": "./assets/images/image-ce789c008a963e68.webp",
            "w": 1600,
            "h": 900,
            "alt": "Folha de design com dois looks inspirados em moda Jirai Kei",
            "cap": "",
            "kind": "desenhos"
        },
        {
            "id": "11",
            "src": "./assets/images/image-a1461a00fa5b46f8.jpg",
            "thumb": "./assets/images/image-cc1fc8443458e2db.webp",
            "thumbFallback": "./assets/images/image-cc1fc8443458e2db.webp",
            "w": 1480,
            "h": 1600,
            "alt": "Retrato de personagem de cabelo rosa e preto fazendo coração com as mãos",
            "cap": "",
            "kind": "desenhos"
        },
        {
            "id": "12",
            "src": "./assets/images/image-2a3f7f254410aba7.jpg",
            "thumb": "./assets/images/image-bc6d328bd9467067.webp",
            "thumbFallback": "./assets/images/image-bc6d328bd9467067.webp",
            "w": 1600,
            "h": 900,
            "alt": "Folha de estudos de uma personagem chibi com asas de morcego e cartola",
            "cap": "",
            "kind": "desenhos"
        },
        {
            "id": "13",
            "src": "./assets/images/image-1a5d4584d6d4c6d7.jpg",
            "thumb": "./assets/images/image-76e29a1896808306.webp",
            "thumbFallback": "./assets/images/image-76e29a1896808306.webp",
            "w": 1600,
            "h": 1200,
            "alt": "Detalhe de um relógio de bolso dourado e um olho em forma de engrenagem",
            "cap": "",
            "kind": "desenhos"
        },
        {
            "id": "14",
            "src": "./assets/images/image-b7c8d1a3aa9659b8.gif",
            "thumb": "./assets/images/image-01fee62c67859e28.webp",
            "thumbFallback": "./assets/images/image-01fee62c67859e28.webp",
            "w": 165,
            "h": 170,
            "alt": "Duas criaturinhas tomando chá em uma sala rosa",
            "cap": "",
            "kind": "desenhos"
        },
        {
            "id": "15",
            "src": "./assets/images/image-31d715e3aef6ac03.jpg",
            "thumb": "./assets/images/image-73e695ca7b132e25.webp",
            "thumbFallback": "./assets/images/image-73e695ca7b132e25.webp",
            "w": 1546,
            "h": 1080,
            "alt": "Bolsa rosa com renda, laços e chaveiros delicados",
            "cap": "bolsa com laços e renda",
            "kind": "acessorios"
        },
        {
            "id": "16",
            "src": "./assets/images/image-3cd4274e01a80fd4.jpg",
            "thumb": "./assets/images/image-edc58620c6ff18ef.webp",
            "thumbFallback": "./assets/images/image-edc58620c6ff18ef.webp",
            "w": 736,
            "h": 552,
            "alt": "Bolsa preta transparente decorada com laços rosa e preto, fitas, renda e cruzes",
            "cap": "bolsa preta com laços",
            "kind": "acessorios"
        },
        {
            "id": "17",
            "src": "./assets/images/image-6541f57c25377728.jpg",
            "thumb": "./assets/images/image-c42ced20a651eb07.webp",
            "thumbFallback": "./assets/images/image-c42ced20a651eb07.webp",
            "w": 735,
            "h": 967,
            "alt": "Bolsa branca com laços rosa, renda, fitas e pelúcias de personagens, em frente a uma estante de figures",
            "cap": "bolsa branca com laços",
            "kind": "acessorios"
        },
        {
            "id": "18",
            "src": "./assets/images/image-944ba8841ff4a8f9.jpg",
            "thumb": "./assets/images/image-c5c8b8dafb67e0a2.webp",
            "thumbFallback": "./assets/images/image-c5c8b8dafb67e0a2.webp",
            "w": 736,
            "h": 552,
            "alt": "Bolsa rosa com babados, pérolas, laço e uma pelúcia da Hello Kitty",
            "cap": "bolsa rosa com babados",
            "kind": "acessorios"
        },
        {
            "id": "19",
            "src": "./assets/images/image-c03579f619c7b65a.jpg",
            "thumb": "./assets/images/image-9091a24cc044b376.webp",
            "thumbFallback": "./assets/images/image-9091a24cc044b376.webp",
            "w": 479,
            "h": 640,
            "alt": "Oito looks alternativos em rosa, preto e branco, com polainas e casacos fofos",
            "cap": "looks em rosa, preto e branco",
            "kind": "moda"
        },
        {
            "id": "20",
            "src": "./assets/images/image-fd2acab3eafdc9c6.jpg",
            "thumb": "./assets/images/image-2aa2b0c4930a26cd.webp",
            "thumbFallback": "./assets/images/image-2aa2b0c4930a26cd.webp",
            "w": 479,
            "h": 640,
            "alt": "Vestido lolita rosa e creme com laços, renda e sombrinha",
            "cap": "vestido lolita rosa",
            "kind": "moda"
        },
        {
            "id": "21",
            "src": "./assets/images/image-193466e471c0ed00.jpg",
            "thumb": "./assets/images/image-5bf745eb397e534f.webp",
            "thumbFallback": "./assets/images/image-5bf745eb397e534f.webp",
            "w": 605,
            "h": 507,
            "alt": "Ilustração de uma personagem de cabelo preto longo com roupa rosa e preta",
            "cap": "ilustração de look rosa e preto",
            "kind": "moda"
        }
    ],
    heroPolaroids: ['11', '13'],
    chapters: [
        {
            "title": "Abertura",
            "p": [
                {
                    "t": "Oie, tudo bem? Sou eu, o Kauê/NeoDestroyah/Burguês/Rodovia... e sei lá quantos outros apelidos. 💥",
                    "k": ""
                },
                {
                    "t": "Então, Noa — ou, para ser mais exato, Emanuelly.",
                    "k": ""
                },
                {
                    "t": "Eu não costumo fazer \"textinhos\" assim, mas, por você, estou fazendo isso. Estou criando coragem para escrever tudo o que está passando pela minha cabeça e tentar colocar em palavras um pouco do quanto você significa para mim. 💔",
                    "k": ""
                }
            ]
        },
        {
            "title": "Primeiro, vamos começar por quando a gente se conheceu, no dia 15/10/2026, às 6 da manhã, jogando Evade no Roblox.",
            "p": [
                {
                    "t": "Era uma manhã completamente aleatória. Eu estava virado, sem conseguir dormir, e resolvi entrar em um jogo no qual não entrava havia uns dois anos. Estava jogando por puro tédio, sem mandar nada no chat, até que vi sua skin e achei ela bonita. Logo depois, pensei em fazer amizade com você.",
                    "k": ""
                },
                {
                    "t": "No começo, eu até pensei que você fosse gringa, por causa da sua skin e dos seus nomes diferentes. Nesse meio-tempo, um brasileiro mandou mensagem no chat e eu respondi. Comecei a procurar para ver se tinha mais algum brasileiro jogando também, até que você mandou uma mensagem. Quando percebi que você também era brasileira, achei interessante.",
                    "k": ""
                },
                {
                    "t": "Com isso, resolvi me aproximar de você para fazer amizade, conversar e ter alguém com quem pudesse trocar assuntos, compartilhar momentos e me distrair um pouco dos meus próprios problemas.",
                    "k": ""
                },
                {
                    "t": "Com o passar do tempo, percebi que você era uma pessoa muito legal e gentil. Resolvi pedir seu Discord (até fiquei meio angustiado de pedir, porque tinha medo de você me achar esquisito). KKKKKKKKKKKK. Eu realmente achei que você poderia me achar estranho por pedir seu Discord, mas, no fim, consegui pegar seu contato e mandei mensagem.",
                    "k": ""
                },
                {
                    "t": "A gente começou a conversar e, logo nas primeiras horas, eu já estava mandando fotos minhas e mostrando várias coisas de que gosto. E você, provavelmente, ficando desconfortável e me achando um completo esquisito. (KKKKKKKKKKKKK)",
                    "k": ""
                },
                {
                    "t": "Comecei a falar sobre meu estilo e percebi que você também entendia bastante desse assunto. Vi que seu estilo era bem diferente do meu, e justamente isso me chamou a atenção. Junto disso, vieram os desenhos que você me mostrou, seus gostos, suas músicas e tantas outras coisas.",
                    "k": ""
                },
                {
                    "t": "Percebi que tínhamos alguns gostos em comum, e tudo isso foi me deixando cada vez mais interessado em conhecer melhor seu universo, suas preferências e as coisas que fazem parte da sua vida.",
                    "k": ""
                },
                {
                    "t": "A gente passou o dia inteiro conversando sobre diversos assuntos, rindo, se divertindo, curtindo e compartilhando momentos. Foi tudo acontecendo de uma maneira tão natural que, quando percebi, já estava gostando muito de ter você por perto.",
                    "k": ""
                },
                {
                    "t": "(Eu estava querendo fazer amizade justamente porque não estava bem da cabeça. Meus amigos estavam me tratando mal, eu estava passando noites acordado, dormindo e comendo mal, com tudo completamente desregulado. Estava sofrendo com ansiedade, problemas da escola e, principalmente, com algumas coisas envolvendo minha ex.)",
                    "k": "aside"
                },
                {
                    "t": "Eu realmente não esperava que essa amizade chegasse tão longe. Sinceramente, pensei que você me bloquearia logo no começo e me removeria da sua lista de amigos no Roblox. Tanto que eu ficava olhando o Roblox para ver se você tinha me removido ou não. Fazia a mesma coisa no Discord.",
                    "k": ""
                },
                {
                    "t": "Eu realmente achei que, em algum momento, você simplesmente me bloquearia e seguiria sua vida, enquanto eu seguiria a minha. Nunca imaginei que aquela interação aleatória, em uma manhã qualquer, acabaria se transformando em uma amizade tão importante para mim.",
                    "k": ""
                },
                {
                    "t": "Logo, você foi me apresentando suas músicas, seu estilo, seus gostos, as coisas de que gosta e as coisas de que não gosta. Foi falando sobre sua vida, sobre suas experiências e sobre tantas coisas que fazem parte de quem você é.",
                    "k": ""
                },
                {
                    "t": "Você me contou o quanto seu pai foi ruim com você, sobre seus problemas na escola, suas inseguranças, seus problemas pessoais, as coisas pelas quais passa, seus apertos, seus momentos bons e ruins. Aos poucos, foi se abrindo com uma pessoa que, até então, nem conhecia direito. Você poderia muito bem não ter confiado em mim, ter se afastado ou simplesmente evitado qualquer tipo de aproximação, mas decidiu compartilhar tudo isso comigo.",
                    "k": ""
                },
                {
                    "t": "As pessoas da sua escola fizeram você passar por situações que acabaram afetando a maneira como enxerga as outras pessoas. Imagino que, inicialmente, você também pudesse pensar que eu seria igual às outras, alguém que poderia te tratar mal ou acabar te decepcionando. Mas, com o tempo, fomos percebendo que tínhamos várias coisas em comum, inclusive alguns problemas e sentimentos.",
                    "k": ""
                },
                {
                    "t": "Eu também fui me abrindo por completo e confiando em você, contando cada coisa que aconteceu comigo e tudo o que senti. E você, com toda a calma, ficava ali me escutando, tentando me ajudar, falando o que pensava, concordando comigo em algumas coisas e discordando em outras.",
                    "k": ""
                },
                {
                    "t": "E sabe? Você conseguiu me mostrar como pode ser uma amizade verdadeira com alguém do gênero oposto. Eu te considero uma das pessoas mais humanas que já conheci. Você consegue entender as situações, ouvir, conversar e ser compreensiva. Não precisa concordar comigo em tudo para me ajudar, e acho isso muito importante.",
                    "k": ""
                },
                {
                    "t": "Uma das coisas que eu mais gostaria de ter era justamente esse tipo de amizade. Eu sinceramente esperava encontrar isso em algum amigo, mas nunca imaginei que fosse encontrar em uma menina. E, de certa forma, isso tornou tudo ainda mais especial para mim.",
                    "k": ""
                },
                {
                    "t": "Isso foi incrível. Fez com que eu tivesse mais confiança para falar sobre meus problemas, sobre meus sentimentos e sobre coisas que, muitas vezes, eu guardava para mim mesmo. Finalmente consegui ter uma amizade com uma menina na qual existe confiança, compreensão e pensamentos que se encontram em tantos assuntos. Alguém com quem compartilho gostos, opiniões e momentos, alguém que consegue me entender e que também me permite conhecer melhor seu próprio mundo.",
                    "k": ""
                },
                {
                    "t": "Eu realmente não esperava por nada disso.",
                    "k": ""
                }
            ]
        },
        {
            "title": "Noa, saiba o quanto você significa para mim.",
            "p": [
                {
                    "t": "Você foi uma das pessoas que mais me ajudaram a lidar com minhas ansiedades, meus problemas, minhas preocupações, minhas próprias ideias e até com as coisas que penso em fazer ou deixo de fazer. Você tem me ajudado em um dos momentos que estão sendo mais difíceis para mim.",
                    "k": ""
                },
                {
                    "t": "E, sinceramente, fico muito feliz por ter essa sua amizade. Sou extremamente grato por ter construído uma amizade tão grande e incrível com você.",
                    "k": ""
                },
                {
                    "t": "Eu sou grato e muito feliz por acordar e saber que você não me bloqueou, que vai me responder, que vai conversar comigo normalmente e que posso contar com sua presença. É tão bom acordar e encontrar uma mensagem sua, ou até mesmo acordar e ter como primeira vontade mandar mensagem para você.",
                    "k": ""
                },
                {
                    "t": "Parece uma coisa tão simples, mas faz diferença no meu dia. Eu acordo melhor sabendo que tenho essa amizade feminina incrível ao meu lado, que existe uma pessoa tão especial com quem posso conversar e compartilhar um pouco da minha vida.",
                    "k": ""
                },
                {
                    "t": "Minha felicidade também está em ter sua presença comigo. Mesmo que seja à distância, às vezes parece que você está aqui do meu lado. É muito bom poder conversar com alguém que me entende, que me escuta e que faz com que eu não me sinta tão sozinho em determinados momentos.",
                    "k": ""
                },
                {
                    "t": "Muitas das coisas que você me ajudou a melhorar e a superar têm uma importância enorme para mim. Não significa que todos os meus problemas desapareceram, mas ter você comigo tornou algumas coisas mais leves. E eu sou muito grato por tudo o que você está fazendo, por cada conversa, cada conselho, cada momento e por estar comigo em situações como essa.",
                    "k": ""
                },
                {
                    "t": "(Um momento que também está sendo horrível para mim.)",
                    "k": "aside"
                },
                {
                    "t": "Eu fico muito alegre por ter você na minha vida. ❤️",
                    "k": ""
                },
                {
                    "t": "Eu sinceramente te considero muito. Considero você uma amiga, uma melhor amiga e uma pessoa que, de certa forma, já considero parte da minha família.",
                    "k": ""
                }
            ]
        },
        {
            "title": "Obrigado por compartilhar comigo tantas partes do seu mundo.",
            "p": [
                {
                    "t": "Obrigado por me apresentar tantas coisas de que você gosta e que ama: suas figures, seus desenhos, seus mangás e manhwas, seus animes, artistas, YouTubers, comidas favoritas, artes, músicas, bebidas favoritas, animações, gostos, estilos e gêneros.",
                    "k": ""
                },
                {
                    "t": "Obrigado também por compartilhar comigo seu conhecimento sobre cabelos e rostos, seus cuidados, suas ideias, suas opiniões, suas experiências e tantas outras coisas que fazem parte da sua personalidade.",
                    "k": ""
                },
                {
                    "t": "Obrigado por me permitir conhecer um pouquinho mais sobre sua vida, seus momentos, suas amizades e sua família. É muito interessante conhecer tudo isso através de você, descobrir coisas novas e perceber o quanto cada detalhe faz parte de quem você é.",
                    "k": ""
                },
                {
                    "t": "E não foram apenas as coisas boas que você compartilhou comigo. Também agradeço por confiar em mim para falar sobre as coisas ruins: seus problemas pessoais, as situações pelas quais você passa, seus sentimentos, suas preocupações, seus medos, suas raivas, suas indignações, suas desconfianças, suas inseguranças, as coisas com as quais não concorda e tudo aquilo de que é contra.",
                    "k": ""
                },
                {
                    "t": "Eu valorizo tanto as coisas boas quanto as difíceis que você decidiu compartilhar comigo. Afinal, uma amizade não é feita apenas de momentos felizes, assuntos divertidos e risadas. Também existe espaço para os dias ruins, para desabafar, discordar, conversar e simplesmente ser ouvido.",
                    "k": ""
                },
                {
                    "t": "E eu espero que você também saiba que pode contar comigo para isso. Não precisa compartilhar somente suas alegrias ou fingir que está tudo bem quando não estiver. Quero que nossa amizade seja um espaço no qual ambos possam ser nós mesmos, sem precisar esconder tudo aquilo que sentimos.",
                    "k": ""
                }
            ]
        },
        {
            "title": "Por fim...",
            "p": [
                {
                    "t": "Tudo isso, para mim, significa muito. É uma das coisas que mais valorizo na nossa amizade, e espero de verdade que a gente consiga levar isso por muito tempo, quem sabe para sempre.",
                    "k": ""
                },
                {
                    "t": "Espero que, mesmo quando acontecerem desentendimentos, momentos de raiva, opiniões diferentes ou situações pessoais complicadas, a gente consiga conversar, se entender e não deixar que essas coisas destruam o que construímos.",
                    "k": ""
                },
                {
                    "t": "Não espero que a gente seja perfeito ou que nunca tenha problemas. Afinal, somos duas pessoas diferentes, cada uma com seus pensamentos, sentimentos e dificuldades. Mas espero que sempre exista respeito, compreensão, sinceridade e vontade de continuar cultivando essa amizade, independentemente das circunstâncias.",
                    "k": ""
                },
                {
                    "t": "Quero continuar conhecendo suas coisas, ouvindo suas histórias, compartilhando minhas experiências, descobrindo novas músicas, rindo das nossas besteiras e criando muitas outras lembranças com você.",
                    "k": ""
                },
                {
                    "t": "E, sinceramente, espero que, quando olharmos para trás daqui a muito tempo, ainda possamos lembrar daquela manhã aleatória no Evade e pensar em como uma simples partida de Roblox acabou trazendo uma pessoa tão importante para nossas vidas.",
                    "k": ""
                },
                {
                    "t": "Eu não imaginava que conhecer alguém naquele dia pudesse significar tanto para mim. Mas aconteceu, e fico muito feliz que tenha acontecido.",
                    "k": ""
                },
                {
                    "t": "Agora sim, eu posso falar que:",
                    "k": ""
                },
                {
                    "t": "Eu te amo, Emanuelly. ❤️",
                    "k": "love"
                },
                {
                    "t": "Obrigado por existir na minha vida. Obrigado por ser você, por ter confiado em mim e por fazer parte dos meus dias.",
                    "k": ""
                },
                {
                    "t": "Você é uma pessoa muito especial para mim, Noa. E espero que nunca se esqueça disso. 💕",
                    "k": ""
                }
            ]
        }
    ]
};
for (const t of exports.CONFIG.tracks) {
    const a = { "3Xzb2uNlf0s": "./assets/audio/3Xzb2uNlf0s.mp3", "Bm2Eg2X4kZA": "./assets/audio/Bm2Eg2X4kZA.mp3", "JBfAtRvW1Ao": "./assets/audio/JBfAtRvW1Ao.mp3", "Oq-xMg1xbic": "./assets/audio/Oq-xMg1xbic.mp3", "tbYHzoBL8ec": "./assets/audio/tbYHzoBL8ec.mp3" }[t.id], c = {}[t.id];
    if (a)
        Object.assign(t, { audio: a });
    if (c)
        Object.assign(t, { cover: c });
    const l = { "3Xzb2uNlf0s": "[re:NOA v31 - recording-calibrated timing, pending listening review]\n[00:19.02]Até meus amigos\n[00:20.97]Não falam comigo\n[00:22.95]Será que eu sou chato?\n[00:24.97]E que eu só reclamo\n[00:26.93]E se eu não chamar\n[00:28.87]Alguém vai notar\n[00:30.83]Talvez o mundo fosse bem melhor\n[00:32.63]Se eu não estivesse aqui pra atrapalhar\n[00:34.79]Ou então tá tudo na minha cabeça\n[00:36.62]Talvez eu mesmo esteja me sabotando\n[00:38.65]Sou ruim em tudo que eu faço\n[00:40.68]Faço meu próprio fracasso\n[00:42.65]Talvez se eu der mais um passo\n[00:44.51]O mundo inteiro exploda\n[00:46.61]Eu sou um próprio desastre\n[00:48.58]E quem me conhece sabe\n[00:50.55]Que eu culpo os outros\n[00:52.39]Pelas minhas falhas todas\n[00:54.47]Foi o mundo que me fez\n[00:56.42]Foi o mundo que te fez\n[00:58.38]Foi o mundo que nos fez\n[01:00.39]Inseguros, inseguros\n[01:04.17]Foi autossabotagem\n[01:06.15]O que aconteceu comigo\n[01:09.65]\n[01:23.91]Todos os dias\n[01:24.78]Mais um pensamento\n[01:25.70]Ruim na minha mente\n[01:26.69]Não dá pra explicar\n[01:27.83]Eu tô sozinho\n[01:28.74]Num mundo de espinhos\n[01:29.62]Tento consertar\n[01:30.46]Mas só sei piorar\n[01:31.86]Ninguém me responde\n[01:33.74]Já mandei um monte\n[01:35.74]De coisas que me arrependi\n[01:38.06]E cancelei\n[01:38.98]Será que eu fiz algo errado\n[01:41.54]Me sinto culpado\n[01:43.60]Talvez o mundo fosse bem melhor\n[01:45.02]Se hoje eu nem tivesse levantado\n[01:47.42]Ou então tá tudo na minha cabeça\n[01:49.24]Talvez eu mesmo esteja me sabotando\n[01:51.44]Sou ruim em tudo que eu faço\n[01:53.47]Faço meu próprio fracasso\n[01:55.44]Talvez se eu der mais um passo\n[01:57.30]O mundo inteiro exploda\n[01:59.40]Eu sou um próprio desastre\n[02:01.37]E quem me conhece sabe\n[02:03.34]Que eu culpo os outros\n[02:05.18]Pelas minhas falhas todas\n[02:07.26]Foi o mundo que me fez\n[02:09.21]Foi o mundo que te fez\n[02:11.17]Foi o mundo que nos fez\n[02:13.18]Inseguros, inseguros\n[02:16.96]Foi auto sabotagem\n[02:18.94]O que aconteceu comigo\n[02:20.96]Olha bem com quem você anda\n[02:26.30]Olha bem o que você faz\n[02:31.30]Lembra quando era criança\n[02:36.32]Aquilo sim que era um tempo de paz\n[02:40.99]Aquilo sim que era\n[02:43.68]Autossabotagem\n[02:45.63]Sou ruim em tudo que eu faço\n[02:47.66]Faço meu próprio fracasso\n[02:49.63]Talvez se eu der mais um passo\n[02:51.49]O mundo inteiro exploda\n[02:53.59]Eu sou um próprio desastre\n[02:55.56]E quem me conhece sabe\n[02:57.53]Que eu culpo os outros\n[02:59.37]Pelas minhas falhas todas\n[03:01.45]Foi o mundo que me fez\n[03:03.40]Foi o mundo que te fez\n[03:05.36]Foi o mundo que nos fez\n[03:07.37]Inseguros, inseguros\n[03:11.15]Foi auto sabotagem\n[03:13.13]O que aconteceu comigo\n[03:15.65]\n", "Bm2Eg2X4kZA": "[re:NOA v30 - reference timing, pending listening review]\n[00:39.49]No centro da sala, diante da mesa\n[00:43.70]No fundo do prato, comida e tristeza\n[00:47.41]A gente se olha, se toca e se cala\n[00:51.08]E se desentende no instante em que fala\n[00:55.60]Medo, medo, medo, medo, medo, medo\n[01:01.95]Cada um guarda mais o seu segredo\n[01:05.95]A sua mão fechada, a sua boca aberta\n[01:09.75]O seu peito deserto, a sua mão parada\n[01:13.92]Lacrada e selada, e molhada de medo\n[01:17.88]Pai na cabeceira\n[01:19.40]É hora do almoço\n[01:20.43]Minha mãe me chama\n[01:22.70]É hora do almoço\n[01:25.50]Minha irmã mais nova\n[01:27.40]Negra cabeleira\n[01:29.52]Minha avó reclama\n[01:31.70]É hora do almoço\n[01:36.60]Ei, moço\n[01:40.73]E eu inda sou bem moço pra tanta tristeza\n[01:44.77]Deixemos de coisas, cuidemos da vida\n[01:48.69]Senão chega a morte ou coisa parecida\n[01:52.47]E nos arrasta moço sem ter visto a vida\n[01:56.05]Ou coisa parecida, ou coisa parecida\n[02:01.00]Ou coisa parecida, aparecida\n[02:05.00]Ou coisa parecida, ou coisa parecida\n[02:10.50]Ou coisa parecida, aparecida\n[02:16.93]\n", "JBfAtRvW1Ao": "[re:NOA v30 - reference timing, pending listening review]\n[00:17.30]I'm so tired of playing\n[00:21.70]Playing with this bow and arrow\n[00:24.72]Gonna give my heart away\n[00:27.64]Leave it to the other girls to play\n[00:34.02]For I've been a temptress too long\n[00:39.94]Just\n[00:43.78]Give me a reason to love you\n[00:48.57]\n[00:50.47]Give me a reason to be a woman\n[01:00.10]\n[01:04.91]I just wanna be a woman\n[01:08.72]\n[01:13.55]From this time, unchained\n[01:17.70]We're all looking at a different picture\n[01:21.35]Through this new frame of mind\n[01:24.78]A thousand flowers could bloom\n[01:30.40]Move over and give us some room, yeah\n[01:39.04]Give me a reason to love you\n[01:47.09]Give me a reason to be a woman\n[01:57.00]\n[02:01.36]I just want to be a woman\n[02:05.52]\n[02:43.93]So don't you stop being a man\n[02:51.96]Just take a little look\n[02:55.68]From our side when you can\n[02:59.95]Sow a little tenderness\n[03:08.48]No matter if you cry\n[03:14.06]\n[03:16.26]Give me a reason to love you\n[03:24.33]Give me a reason to be a woman\n[03:34.35]\n[03:38.46]I just want to be a woman\n[03:43.41]It's all I wanna be, is all a woman\n[03:50.10]\n[03:56.04]For this is the beginning\n[04:00.44]Of forever and ever\n[04:03.97]\n[04:26.53]It's time to move over\n[04:31.48]It's all I want to be\n[04:35.31]I'm so tired of playing\n[04:39.34]Playing with this bow and arrow\n[04:43.22]Gonna give my heart away\n[04:45.70]Leave it to the other girls to play\n[04:52.10]For I've been a temptress too long\n[04:58.10]Just\n[05:01.95]Give me a reason to love you\n[05:08.83]\n", "Oq-xMg1xbic": "[re:NOA v33 - relative spectral adjustment; vocal starts pending review]\n[00:40.43]Two nights ago\n[00:44.10]She got that look in her eyes\n[00:48.08]Kaleidoscope, but that's only half the time\n[00:55.58]Three days before\n[00:58.70]She told me that I don't even try\n[01:03.20]She's crazy, though\n[01:06.40]I guess there's something wrong inside\n[01:11.06]\n[01:18.30]Maybe you're right\n[01:20.80]Maybe this is all that I can be\n[01:24.06]But what if it's you, and it wasn't me?\n[01:33.03]What do you want from me?\n[01:40.96]What do you want from me?\n[01:48.82]Four weeks ahead\n[01:52.30]I thought that I should think some more\n[01:57.65]I'm fucked in the head, and my mind is turning into a whore\n[02:05.05]Five months go by\n[02:08.50]And I thought about letting her go\n[02:12.68]She's crazy, though\n[02:16.00]And I guess she took control\n[02:19.97]Oh no, oh no, oh no, oh no, no\n[02:27.98]Maybe you're right\n[02:30.42]Maybe this is all that I can be\n[02:33.99]But what if it's you, and it wasn't me?\n[02:42.96]What do you want from me?\n[02:50.52]What do you want from me?\n[02:58.41]Maybe she's right, maybe I'm wrong\n[03:03.25]Maybe we'll fight till it moves us along\n[03:06.84]I can't deny writing a song\n[03:10.38]Hoping she'll find she's not alone\n[03:22.46]\n[03:37.95]Maybe you're right\n[03:40.40]Maybe this is all that I can be\n[03:43.69]But what if it's you, and it wasn't me, oh?\n[03:52.02]What do you want from me? (What)\n[03:56.58]What do you want, what do you want from me? (Do you want from me?)\n[04:00.03]Oh, what do you from me? (What)\n[04:03.78]What do you want, what do you want? (Do you want from me now?)\n[04:08.85]\n", "tbYHzoBL8ec": "[re:NOA v33 - relative spectral adjustment; vocal starts pending review]\n[00:13.80]I'm frosting\n[00:16.02]I don't need a man to make my life sweet\n[00:20.99]Prince Charming\n[00:23.26]Just isn't the one that I think I need\n[00:28.32]You're thirsty\n[00:30.23]You think I give out all my shit for free\n[00:35.46]I'm bursting\n[00:37.70]Out laughing at idiocy\n[00:42.40]I need a gingerbread man, the one I'll feed\n[00:46.21]The gingerbread man, the one I'll eat\n[00:49.94]One who's always crazy\n[00:51.70]Never calls me baby\n[00:53.40]That's the one that I want\n[00:55.34]All you boys are not him, not him\n[01:02.24]\n[01:11.12]Can't you see?\n[01:13.08]I only want the ones who never see me\n[01:18.11]But I'm happy\n[01:20.44]I love playing these games until my heart bleeds\n[01:25.32]It bleeds jelly\n[01:27.53]'Cause you don't want someone to eat your cookie\n[01:32.71]Can someone, please\n[01:35.20]Find him for me, find him for me?\n[01:39.71]I need a gingerbread man, the one I'll feed\n[01:43.85]The gingerbread man, the one I'll eat\n[01:47.10]One who's always crazy\n[01:49.01]Never calls me baby\n[01:50.99]That's the one that I want\n[01:52.59]All you boys are not him, not him\n[01:59.41]\n[02:09.35]I'm the icing covering his body\n[02:12.75]I wanna hold him so close, so tightly\n[02:16.69]Baby, how do I say this politely?\n[02:19.94]Love me hard and don't be nice, please\n[02:23.51]I wanna feel your crumbs on my body\n[02:27.29]I want to break you in pieces, fight me\n[02:30.96]Baby, don't be so scared of biting\n[02:34.32]Want to eat each other into nothing\n[02:40.61]I need a gingerbread man, the one I'll feed\n[02:44.63]The gingerbread man, the one I'll eat\n[02:48.37]One who's always crazy\n[02:49.91]Never calls me baby\n[02:51.65]That's the one that I want\n[02:53.29]All you boys are not him, not him\n[02:58.11]\n" }[t.id];
    if (l)
        Object.assign(t, { lyrics: l });
}

},
"./motion":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motionReduced = void 0;
exports.animateMotion = animateMotion;
exports.cancelMotionWithin = cancelMotionWithin;
exports.pulseMotion = pulseMotion;
exports.memoryGlyph = memoryGlyph;
exports.bindMovingControl = bindMovingControl;
exports.uiGlyph = uiGlyph;
const motionReduced = () => document.documentElement.dataset.motion === 'reduced';
exports.motionReduced = motionReduced;
const active = new Set();
const byElement = new WeakMap();
function animateMotion(element, frames, options) {
    if ((0, exports.motionReduced)() || typeof element.animate !== 'function')
        return;
    byElement.get(element)?.cancel();
    const anim = element.animate(frames, options);
    byElement.set(element, anim);
    active.add(anim);
    const done = () => { active.delete(anim); if (byElement.get(element) === anim)
        byElement.delete(element); };
    anim.finished.then(done, done);
    return anim;
}
document.addEventListener('noa-motion-change', () => { if ((0, exports.motionReduced)())
    for (const anim of active)
        anim.cancel(); });
function cancelMotionWithin(root) { for (const anim of active) {
    const target = anim.effect?.target;
    if (target && root.contains(target))
        anim.cancel();
} }
function pulseMotion(el) { animateMotion(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.065)', offset: .42 }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,.75,.3,1)' }); }
const shapes = {
    '🎀': '<path d="M24 24C13 5 3 12 6 24S18 32 24 24M24 24C35 5 45 12 42 24S30 32 24 24" fill="#b86b99"/><path d="M24 26 14 43 23 38 27 43 29 26" fill="#e8a7c6"/><rect x="20" y="20" width="8" height="8" rx="3" fill="#ffe7c2"/>',
    '🌙': '<path d="M31 5C12 3 4 19 12 34c7 13 25 12 33 1-17 3-28-13-14-30Z" fill="#f3cc94"/><path d="m35 9 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#fff2d4"/>',
    '🎧': '<path d="M8 27v-7a16 16 0 0 1 32 0v7" stroke="#a86a9f" stroke-width="5" fill="none"/><rect x="5" y="24" width="10" height="16" rx="5" fill="#e6a6c4"/><rect x="33" y="24" width="10" height="16" rx="5" fill="#e6a6c4"/><path d="M36 39q-3 5-12 5" stroke="#f4d4ac" stroke-width="2" fill="none"/>',
    '🦋': '<path d="M23 24C15 1 1 3 5 20c1 7 11 9 18 8C6 26 6 43 16 42q7-1 8-14M25 24C33 1 47 3 43 20c-1 7-11 9-18 8 17-2 17 15 7 14q-7-1-8-14" fill="#b47fcb" stroke="#fbe4f2" stroke-width="1"/><path d="M24 18v19M24 19l-5-8m5 8 5-8" stroke="#824b7f" stroke-width="2" stroke-linecap="round"/>'
};
function memoryGlyph(symbol) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('noa-memory-glyph');
    svg.innerHTML = shapes[symbol] || '';
    return svg;
}
function bindMovingControl(button, activate) {
    let id = null, x = 0, y = 0, lastTouch = -Infinity;
    button.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && id === null) {
        id = e.pointerId;
        x = e.clientX;
        y = e.clientY;
    } });
    button.addEventListener('pointermove', e => { if (e.pointerId === id && Math.hypot(e.clientX - x, e.clientY - y) > 15)
        id = null; });
    button.addEventListener('pointercancel', e => { if (e.pointerId === id)
        id = null; });
    button.addEventListener('pointerup', e => { if (e.pointerId !== id)
        return; id = null; if (Math.hypot(e.clientX - x, e.clientY - y) > 15 || button.disabled || button.hidden)
        return; lastTouch = performance.now(); activate(); });
    button.addEventListener('click', e => { const kind = e.pointerType; if (performance.now() - lastTouch < 700 && (kind === 'touch' || (!kind && e.detail > 0))) {
        e.preventDefault();
        return;
    } if (!button.disabled && !button.hidden)
        activate(); });
}
const uiGlyphs = {
    '✉': '<rect x="4" y="7" width="24" height="18" rx="3"/><path d="M5 9l11 9L27 9M5 24l8-8m14 8-8-8"/>', '🎁': '<rect x="5" y="13" width="22" height="14" rx="2"/><rect x="3" y="9" width="26" height="5" rx="1.5"/><path d="M16 9v18M16 9c-13 0-10-12-4-6l4 6c13 0 10-12 4-6Z"/>',
    '🧩': '<path d="M4 5h9c-3 6 6 7 6 0h9v9c-6-3-7 6 0 6v8h-9c3-6-6-7-6 0H4v-9c6 3 7-6 0-6Z"/>', '🔎': '<circle cx="13" cy="13" r="8"/><path d="m19 19 9 9"/>', '📷': '<rect x="3" y="8" width="26" height="19" rx="3"/><path d="m10 8 2-4h8l2 4"/><circle cx="16" cy="17" r="5"/>', '♡': '<path d="M16 27 5 16C-2 7 10 1 16 10 22 1 34 7 27 16Z"/>', '⌁': '<path d="M3 18c4-10 7 10 13 0S25 8 29 14M4 24c5-6 9 6 14 0"/>',
    '⏳': '<path d="M7 4h18M7 28h18M9 4v4c0 6 7 7 7 8s-7 2-7 8v4M23 4v4c0 6-7 7-7 8s7 2 7 8v4"/>', '📖': '<path d="M3 6q7-3 13 3 6-6 13-3v20q-7-3-13 2-6-5-13-2ZM16 9v19"/>', '✨': '<path d="m16 2 3 10 11 4-11 4-3 10-3-10-11-4 11-4Z M26 3v6m-3-3h6"/>', '🎨': '<path d="M16 3a13 13 0 1 0 0 26c5 0 3-5 5-6s8 2 8-6A13 13 0 0 0 16 3Z"/><circle cx="10" cy="10" r="1.8"/><circle cx="18" cy="8" r="1.8"/><circle cx="24" cy="14" r="1.8"/><circle cx="8" cy="18" r="1.8"/>', '🎙': '<rect x="11" y="3" width="10" height="18" rx="5"/><path d="M7 15a9 9 0 0 0 18 0M16 24v5M11 29h10"/>', '💌': '<rect x="3" y="5" width="26" height="22" rx="3"/><path d="m3 8 13 10L29 8M8 25l6-6m10 6-6-6"/>', '🌌': '<circle cx="16" cy="16" r="11"/><ellipse cx="16" cy="16" rx="15" ry="5" transform="rotate(-35 16 16)"/><path d="m6 3 1 2 3 1-3 1-1 2-1-2-2-1 2-1Z"/>', '☁': '<path d="M7 24a6 6 0 0 1-1-12 10 10 0 0 1 19 1 6 6 0 0 1-1 11Z"/>',
    '◉': '<circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="8" stroke-dasharray="4 3"/><path d="m16 8 5 8-5 8-5-8Z"/>', '✿': '<path d="M16 12c-8-10 8-10 0 0M20 15c8-10 15 4 0 4M18 20c10 9-5 15-5 0M11 18C-2 21 2 6 12 14"/><circle cx="16" cy="16" r="4"/>', '❧': '<path d="M6 28C6 10 18 4 27 4c0 12-7 21-18 18M8 24 24 8"/>', '◇': '<path d="M16 3 29 16 16 29 3 16Z M16 3l-5 13 5 13 5-13Z M3 16h26"/>', '◎': '<circle cx="16" cy="16" r="9"/><ellipse cx="16" cy="16" rx="15" ry="5" transform="rotate(-25 16 16)"/>', '♫': '<path d="M11 23V7l16-4v17M11 11l16-4"/><ellipse cx="7" cy="24" rx="4" ry="3"/><ellipse cx="23" cy="21" rx="4" ry="3"/>', '♧': '<path d="M9 8h14l3 16H6ZM12 8V4h8v4M10 24v4h12v-4M16 12v8"/>', '✧': '<path d="m16 2 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z"/>', '✦': '<path d="m16 2 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z"/>', '⌘': '<path d="M5 24 10 7l16 4-4 14L5 24 26 11"/><circle cx="5" cy="24" r="2"/><circle cx="10" cy="7" r="2"/><circle cx="26" cy="11" r="2"/><circle cx="22" cy="25" r="2"/>', '◷': '<circle cx="16" cy="16" r="12"/><path d="M16 6v10l6 4"/>', '≈': '<path d="M3 10q7-8 13 0t13 0M3 17q7-8 13 0t13 0M3 24q7-8 13 0t13 0"/>', '▦': '<rect x="4" y="4" width="24" height="24" rx="2"/><path d="M12 4v24M20 4v24M4 12h24M4 20h24"/>', '☾': '<path d="M23 4A13 13 0 1 0 28 23 12 12 0 0 1 23 4Z"/>', '♜': '<path d="M4 28h24M7 28V9h5V4h8v5h5v19M12 28v-8a4 4 0 0 1 8 0v8M10 13h2m8 0h2"/>', '❦': '<path d="M16 15C6-2-2 8 6 17l10 1C0 15 3 31 13 27l3-9C32 15 29 31 19 27l-3-9 10-1C34 8 26-2 16 15Zm0-4v13"/>', '≋': '<path d="M5 15a11 11 0 0 1 22 0ZM9 16q-4 4 0 8t0 5m7-13q4 4 0 8t0 5m7-13q-4 4 0 8t0 5"/>'
};
function uiGlyph(symbol) { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 32 32'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.55'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('noa-ui-glyph'); svg.innerHTML = uiGlyphs[symbol] || uiGlyphs['✧']; return svg; }

},
"./features":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const motion_1 = require("./motion");
const config_1 = require("./config");
const universe_1 = require("./universe");
const STORAGE_KEY = 'surpresa-noa-progress-v1';
const DB_NAME = 'surpresa-noa';
const DB_STORE = 'progress';
const DEFAULT_PROGRESS = {
    version: 1,
    puzzleSolved: false,
    scratchClaimed: false,
    memoryWon: false,
    boxCount: 0,
    favoriteIds: [],
    openedSecrets: [],
    scene: 'stars',
};
const $ = (selector, root = document) => root.querySelector(selector);
const make = (tag, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className)
        node.className = className;
    if (text)
        node.textContent = text;
    return node;
};
const button = (text, className = 'exp-button') => {
    const node = make('button', className, text);
    node.type = 'button';
    return node;
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const reduceMotion = motion_1.motionReduced;
let progress = { ...DEFAULT_PROGRESS };
let modal = null;
let modalSequence = 0;
let modalReturnFocus = null;
let modalCleanup = null;
let audio = null;
let visualizerFrame = 0;
let installPrompt = null;
function normalizeProgress(value) {
    if (!value || typeof value !== 'object')
        return { ...DEFAULT_PROGRESS };
    const input = value;
    const scene = input.scene === 'aurora' || input.scene === 'rain' ? input.scene : 'stars';
    return {
        version: 1,
        puzzleSolved: input.puzzleSolved === true,
        scratchClaimed: input.scratchClaimed === true,
        memoryWon: input.memoryWon === true,
        boxCount: Number.isFinite(input.boxCount) ? clamp(Number(input.boxCount), 0, 999) : 0,
        favoriteIds: Array.isArray(input.favoriteIds) ? [...new Set(input.favoriteIds.filter((id) => typeof id === 'string'))].slice(0, 100) : [],
        openedSecrets: Array.isArray(input.openedSecrets) ? [...new Set(input.openedSecrets.filter((id) => typeof id === 'string'))].slice(0, 100) : [],
        scene,
    };
}
function openDatabase() {
    if (!('indexedDB' in window))
        return Promise.resolve(null);
    return new Promise(resolve => {
        try {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(DB_STORE))
                    db.createObjectStore(DB_STORE);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
            request.onblocked = () => resolve(null);
        }
        catch {
            resolve(null);
        }
    });
}
async function loadProgress() {
    let raw = null;
    const db = await openDatabase();
    if (db) {
        raw = await new Promise(resolve => {
            try {
                const request = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get('main');
                request.onsuccess = () => resolve(request.result ?? null);
                request.onerror = () => resolve(null);
            }
            catch {
                resolve(null);
            }
        });
        db.close();
    }
    if (!raw) {
        try {
            raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
        }
        catch {
            raw = null;
        }
    }
    progress = normalizeProgress(raw);
    applySavedScene();
    updateProgressUI();
    renderGalleryFavorites();
}
function saveProgress() {
    const snapshot = { ...progress, favoriteIds: [...progress.favoriteIds], openedSecrets: [...progress.openedSecrets] };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }
    catch { }
    void openDatabase().then(db => {
        if (!db)
            return;
        try {
            const transaction = db.transaction(DB_STORE, 'readwrite');
            transaction.objectStore(DB_STORE).put(snapshot, 'main');
            transaction.oncomplete = () => db.close();
            transaction.onerror = () => db.close();
        }
        catch {
            db.close();
        }
    });
    updateProgressUI();
}
function updateProgressUI() {
    const total = 4;
    const done = Number(progress.puzzleSolved) + Number(progress.scratchClaimed) + Number(progress.memoryWon) + Number(progress.boxCount > 0);
    const bar = $('#exp-progress-bar');
    const label = $('#exp-progress-label');
    if (bar instanceof HTMLElement)
        bar.style.width = `${(done / total) * 100}%`;
    if (label)
        label.textContent = `${done} de ${total} descobertas especiais`;
    const counts = $('#exp-favorite-count');
    if (counts)
        counts.textContent = String(progress.favoriteIds.length);
}
function expToast(message) {
    const existing = $('#toast');
    if (existing) {
        existing.textContent = message;
        existing.classList.add('on');
        window.setTimeout(() => existing.classList.remove('on'), 2600);
        return;
    }
    const note = make('div', 'exp-toast', message);
    note.setAttribute('role', 'status');
    document.body.append(note);
    window.setTimeout(() => note.remove(), 2600);
}
function openModal(title, description = '') {
    closeModal();
    const id = ++modalSequence;
    modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overlay = make('div', 'exp-modal');
    overlay.setAttribute('role', 'presentation');
    const dialog = make('section', 'exp-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'exp-dialog-title');
    const header = make('header', 'exp-dialog-head');
    const heading = make('h3', '', title);
    heading.id = 'exp-dialog-title';
    const close = button('×', 'exp-close');
    close.setAttribute('aria-label', 'Fechar experiência');
    const body = make('div', 'exp-dialog-body');
    const controls = make('div', 'exp-header-controls');
    const transport = document.getElementById('mini-play');
    if (transport && !document.getElementById('mini-music')?.hidden) {
        const music = button('', 'exp-music-control');
        music.dataset.musicToggle = '';
        music.setAttribute('aria-label', transport.getAttribute('aria-label') || 'Tocar');
        music.setAttribute('aria-pressed', transport.getAttribute('aria-pressed') || 'false');
        for (const child of transport.childNodes)
            music.append(child.cloneNode(true));
        controls.append(music);
    }
    controls.append(close);
    header.append(heading, controls);
    if (description)
        body.append(make('p', 'exp-muted', description));
    if (reduceMotion()) {
        const resume = button('Reativar animações completas', 'exp-motion-resume');
        resume.addEventListener('click', () => { document.dispatchEvent(new Event('noa-enable-motion')); resume.remove(); });
        body.append(resume);
    }
    dialog.append(header, body);
    overlay.append(dialog);
    document.body.append(overlay);
    modal = overlay;
    document.body.classList.add('exp-modal-open');
    document.getElementById('main')?.setAttribute('inert', '');
    document.getElementById('fabs')?.setAttribute('inert', '');
    dialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab')
            return;
        const controls = Array.from(dialog.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type=hidden]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]')).filter(node => node.getClientRects().length > 0);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) {
            event.preventDefault();
            return;
        }
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        }
        else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
    const closeFn = () => closeModal();
    close.addEventListener('click', closeFn);
    overlay.addEventListener('click', event => { if (event.target === overlay)
        closeFn(); });
    window.setTimeout(() => { if (modal === overlay)
        close.focus({ preventScroll: true }); }, 20);
    return { body, close: closeFn, id };
}
function closeModal() {
    if (!modal)
        return;
    if (modalCleanup) {
        const cleanup = modalCleanup;
        modalCleanup = null;
        try {
            cleanup();
        }
        catch { }
    }
    (0, motion_1.cancelMotionWithin)(modal);
    modal.remove();
    modal = null;
    document.body.classList.remove('exp-modal-open');
    document.getElementById('main')?.removeAttribute('inert');
    document.getElementById('fabs')?.removeAttribute('inert');
    modalReturnFocus?.focus({ preventScroll: true });
    modalReturnFocus = null;
    modalSequence++;
}
function addFeatureCard(parent, icon, title, description, action) {
    const card = button('', 'exp-card');
    card.style.setProperty('--cinema-index', String(parent.children.length));
    const glyph = make('span', 'exp-card-icon');
    glyph.append((0, motion_1.uiGlyph)(icon));
    glyph.setAttribute('aria-hidden', 'true');
    const name = make('strong', '', title);
    const copy = make('span', 'exp-card-copy', description);
    const arrow = make('span', 'exp-card-arrow', 'Abrir →');
    card.append(glyph, name, copy, arrow);
    card.addEventListener('click', action);
    parent.append(card);
}
const SECRET_MESSAGES = [
    'Mesmo quando o dia é comum, algumas pessoas conseguem torná-lo especial. Você é uma delas. ♡',
    'Que você nunca esqueça o quanto merece carinho, tranquilidade e motivos sinceros para sorrir.',
    'Entre tantas coisas que poderiam acontecer naquele dia, ainda acho bonito que nossos caminhos tenham se cruzado.',
];
function openSecretLetter() {
    const panel = openModal('Uma carta guardada', 'Uma mensagem que aparece aos poucos, como se tivesse sido escrita à mão.');
    const activeModal = modal;
    const paper = make('article', 'exp-letter');
    const title = make('p', 'exp-letter-kicker', 'PARA VOCÊ, NOA ♡');
    const text = make('p', 'exp-letter-text');
    const signature = make('p', 'exp-letter-sign', '— Kauê');
    paper.append(title, text, signature);
    panel.body.append(paper);
    const message = 'Queria que este cantinho fosse uma pausa boa no seu dia. Um lugar para lembrar que sua presença importa, que seus gostos, seus desenhos, suas músicas e seu jeito têm valor. Obrigado por dividir um pedacinho do seu mundo comigo. ♡';
    let index = 0;
    const timer = window.setInterval(() => {
        if (!modal || modal !== activeModal) {
            window.clearInterval(timer);
            return;
        }
        text.textContent = message.slice(0, index += reduceMotion() ? 10 : 2);
        if (index >= message.length)
            window.clearInterval(timer);
    }, reduceMotion() ? 5 : 28);
    if (!progress.openedSecrets.includes('letter')) {
        progress.openedSecrets.push('letter');
        saveProgress();
    }
}
function openMysteryBox() {
    const panel = openModal('Caixa de pequenas surpresas', 'Toque na caixa para descobrir uma mensagem. Cada abertura escolhe uma frase diferente.');
    const box = button('', 'exp-mystery-box');
    const lid = make('span', 'u-gift-lid'), spark = make('span', 'u-gift-spark', '✧');
    box.append(make('span', 'u-gift-base'), lid, make('span', 'u-gift-ribbon'), spark);
    box.setAttribute('aria-label', 'Abrir caixa misteriosa');
    const result = make('p', 'exp-reveal', 'Ainda está fechada…');
    const counter = make('small', 'exp-muted', `Surpresas encontradas: ${progress.boxCount}`);
    box.addEventListener('click', () => {
        const index = (progress.boxCount + Math.floor(Math.random() * SECRET_MESSAGES.length)) % SECRET_MESSAGES.length;
        result.textContent = SECRET_MESSAGES[index];
        box.classList.add('is-open');
        (0, motion_1.animateMotion)(lid, [{ transform: 'none' }, { transform: 'translate(-5px,-12px) rotateZ(-4deg)', offset: .22 }, { transform: 'translate(-18px,-34px) rotateZ(-17deg) rotateX(-16deg)' }], { duration: 780, easing: 'cubic-bezier(.2,.8,.25,1)' });
        (0, motion_1.animateMotion)(spark, [{ opacity: 0, transform: 'translateY(14px) scale(.5)' }, { opacity: 1, transform: 'translateY(-22px) scale(1.3)', offset: .65 }, { opacity: 1, transform: 'translateY(-35px) scale(1.15)' }], { duration: 900, easing: 'ease-out' });
        (0, motion_1.pulseMotion)(result);
        progress.boxCount++;
        counter.textContent = `Surpresas encontradas: ${progress.boxCount}`;
        saveProgress();
    });
    panel.body.append(box, result, counter);
}
function openScratchCard() {
    const panel = openModal('Raspe para revelar', 'Deslize o dedo sobre a superfície para revelar a mensagem escondida.');
    const frame = make('div', 'exp-scratch-frame');
    const revealed = make('div', 'exp-scratch-reveal', 'Você merece coisas bonitas, gentileza nos dias difíceis e muitos motivos para sorrir. ♡');
    revealed.setAttribute('aria-live', 'polite');
    const canvas = make('canvas', 'exp-scratch-canvas');
    canvas.width = 640;
    canvas.height = 320;
    canvas.setAttribute('aria-label', 'Área raspável. Deslize o dedo para revelar a mensagem.');
    const foil = make('i', 'noa-foil-sheen');
    foil.setAttribute('aria-hidden', 'true');
    frame.append(revealed, canvas, foil);
    panel.body.append(frame);
    const context = canvas.getContext('2d');
    if (!context) {
        canvas.hidden = true;
        revealed.classList.add('revealed');
        return;
    }
    const gradient = context.createLinearGradient(0, 0, 640, 320);
    gradient.addColorStop(0, '#8e416c');
    gradient.addColorStop(.22, '#f5c4db');
    gradient.addColorStop(.42, '#a75684');
    gradient.addColorStop(.68, '#ffe3ed');
    gradient.addColorStop(1, '#b9759e');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 640, 320);
    for (let i = 0; i < 210; i++) {
        const x = (i * 139.7) % 640, y = (i * 93.1) % 320;
        context.fillStyle = i % 3 ? '#ffffff35' : '#70314d42';
        context.fillRect(x, y, 2, 2);
    }
    context.fillStyle = '#49243d';
    context.font = 'bold 34px Georgia';
    context.textAlign = 'center';
    context.fillText('RASPE AQUI ✦', 320, 172);
    let scratching = false;
    let previous = null;
    const cols = 40, rows = 20, cell = 16, covered = new Uint8Array(cols * rows);
    let count = 0, lastDust = 0;
    const sample = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy; for (let j = Math.max(0, Math.floor((Math.min(a.y, b.y) - 34) / cell)); j <= Math.min(rows - 1, Math.floor((Math.max(a.y, b.y) + 34) / cell)); j++)
        for (let i = Math.max(0, Math.floor((Math.min(a.x, b.x) - 34) / cell)); i <= Math.min(cols - 1, Math.floor((Math.max(a.x, b.x) + 34) / cell)); i++) {
            const k = j * cols + i;
            if (covered[k])
                continue;
            const px = (i + .5) * cell, py = (j + .5) * cell, t = len ? clamp(((px - a.x) * dx + (py - a.y) * dy) / len, 0, 1) : 0;
            if ((px - a.x - t * dx) ** 2 + (py - a.y - t * dy) ** 2 < 34 ** 2) {
                covered[k] = 1;
                count++;
            }
        } };
    let unlocked = progress.scratchClaimed;
    if (unlocked) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        revealed.classList.add('revealed');
        canvas.classList.add('scratched-out');
        frame.classList.add('is-revealed');
    }
    const reveal = () => { if (unlocked)
        return; unlocked = true; canvas.classList.add('scratched-out'); frame.classList.add('is-revealed'); revealed.classList.add('revealed'); progress.scratchClaimed = true; saveProgress(); (0, motion_1.pulseMotion)(revealed); expToast('Mensagem revelada ♡'); };
    const erase = (event) => {
        if (!scratching || unlocked)
            return;
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * (canvas.width / rect.width);
        const y = (event.clientY - rect.top) * (canvas.height / rect.height);
        context.globalCompositeOperation = 'destination-out';
        context.lineWidth = 68;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        if (previous) {
            context.beginPath();
            context.moveTo(previous.x, previous.y);
            context.lineTo(x, y);
            context.stroke();
        }
        context.beginPath();
        context.arc(x, y, 34, 0, Math.PI * 2);
        context.fill();
        sample(previous ?? { x, y }, { x, y });
        previous = { x, y };
        if (!reduceMotion() && event.timeStamp - lastDust > 75 && frame.querySelectorAll('.noa-scratch-dust').length < 8) {
            lastDust = event.timeStamp;
            const dust = make('i', 'noa-scratch-dust', '✧');
            dust.style.left = `${x / 640 * 100}%`;
            dust.style.top = `${y / 320 * 100}%`;
            frame.append(dust);
            const animation = (0, motion_1.animateMotion)(dust, [{ opacity: 1, transform: 'translate(-50%,-50%) scale(.8)' }, { opacity: 0, transform: 'translate(10px,-28px) scale(.25)' }], { duration: 460, easing: 'ease-out' });
            if (animation)
                animation.finished.then(() => dust.remove(), () => dust.remove());
            else
                dust.remove();
        }
        if (count / (cols * rows) > .42)
            reveal();
    };
    canvas.addEventListener('pointerdown', event => {
        scratching = true;
        canvas.setPointerCapture?.(event.pointerId);
        erase(event);
    });
    canvas.addEventListener('pointermove', erase);
    const stop = () => { scratching = false; previous = null; };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('lostpointercapture', stop);
    const revealButton = button('Revelar sem raspar', 'exp-text-button');
    revealButton.addEventListener('click', reveal);
    panel.body.append(revealButton);
}
function openMemoryGame() {
    const panel = openModal('Jogo da memória', 'Encontre os quatro pares. O jogo funciona por toque e também com teclado.');
    const symbols = ['🎀', '🌙', '🎧', '🦋'];
    const deck = [...symbols, ...symbols].map((symbol, index) => ({ symbol, id: index }));
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const grid = make('div', 'exp-memory-grid');
    const status = make('p', 'exp-muted', 'Pares encontrados: 0/4');
    let opened = [];
    let matched = 0;
    let busy = false;
    let pending = 0, attempts = 0;
    modalCleanup = () => window.clearTimeout(pending);
    const indexDelay = (index) => index * -170;
    const cards = deck.map(item => {
        const card = button('', 'exp-memory-card');
        const core = make('span', 'u-memory-core');
        const back = make('span', 'u-memory-back', '✧'), face = make('span', 'u-memory-face');
        face.append((0, motion_1.memoryGlyph)(item.symbol));
        core.append(back, face);
        card.style.setProperty('--card-delay', `${indexDelay(item.id)}ms`);
        card.append(core);
        card.dataset.symbol = item.symbol;
        card.setAttribute('aria-label', 'Carta fechada');
        card.addEventListener('click', () => {
            if (busy || card.classList.contains('matched') || card.classList.contains('flipped'))
                return;
            card.classList.add('flipped');
            card.setAttribute('aria-label', `Carta ${item.symbol}`);
            opened.push(card);
            if (opened.length === 2) {
                attempts++;
                const [first, second] = opened;
                if (first.dataset.symbol === second.dataset.symbol) {
                    first.classList.add('matched');
                    second.classList.add('matched');
                    opened = [];
                    matched++;
                    status.textContent = `Pares encontrados: ${matched}/4 · ${attempts} tentativas`;
                    (0, motion_1.pulseMotion)(status);
                    if (matched === 4) {
                        status.textContent = `Você encontrou todos os pares em ${attempts} tentativas! ♡`;
                        progress.memoryWon = true;
                        saveProgress();
                        expToast('Jogo concluído! ♡');
                    }
                }
                else {
                    busy = true;
                    pending = window.setTimeout(() => {
                        [first, second].forEach(item => {
                            item.classList.remove('flipped');
                            item.setAttribute('aria-label', 'Carta fechada');
                        });
                        opened = [];
                        busy = false;
                    }, reduceMotion() ? 150 : 760);
                }
            }
        });
        grid.append(card);
        return card;
    });
    status.setAttribute('role', 'status');
    panel.body.append(grid, status, button('Embaralhar novamente'));
    panel.body.lastElementChild?.addEventListener('click', openMemoryGame);
    if (progress.memoryWon)
        status.textContent = 'Recorde já concluído anteriormente. Tente novamente! ♡';
    void cards;
}
function openRiddle() {
    const panel = openModal('Um pequeno enigma', 'Uma pista sobre o começo dessa história.');
    panel.body.append(make('p', 'exp-riddle', 'Qual era o nome do jogo do Roblox em que tudo começou?'));
    const input = make('input', 'exp-input');
    input.placeholder = 'Digite sua resposta';
    input.autocomplete = 'off';
    input.maxLength = 30;
    input.setAttribute('aria-label', 'Resposta do enigma');
    const feedback = make('p', 'exp-muted u-riddle-feedback', progress.puzzleSolved ? 'Enigma resolvido! ♡' : '');
    feedback.setAttribute('role', 'status');
    const check = button('Conferir resposta');
    const hint = button('Ver dica', 'exp-text-button');
    hint.addEventListener('click', () => { feedback.textContent = 'Dica: é um jogo de fugir de monstros e obstáculos.'; });
    check.addEventListener('click', () => {
        if (input.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() === 'EVADE') {
            progress.puzzleSolved = true;
            saveProgress();
            feedback.classList.add('is-correct');
            feedback.textContent = 'Resposta certa! Uma lembrança desbloqueada. ♡';
            (0, motion_1.pulseMotion)(feedback);
            expToast('Enigma resolvido! ♡');
        }
        else {
            feedback.classList.remove('is-correct');
            feedback.textContent = 'Ainda não… tente novamente ou peça uma dica.';
            (0, motion_1.animateMotion)(feedback, [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 290, easing: 'ease-out' });
        }
    });
    input.addEventListener('keydown', event => { if (event.key === 'Enter')
        check.click(); });
    panel.body.append(input, check, hint, feedback);
}
function openFloatingGallery(favoritesOnly = false) {
    const panel = openModal('Memórias em movimento', 'Toque em uma fotografia para destacá-la e guarde suas favoritas neste aparelho.');
    const gallery = make('div', 'exp-floating-gallery');
    const images = config_1.CONFIG.gallery.filter(item => !favoritesOnly || progress.favoriteIds.includes(item.id)).slice(0, 12);
    if (!images.length) {
        gallery.append(make('p', 'exp-muted', 'Ainda não há fotografias favoritas. Abra a galeria e guarde algumas para encontrá-las aqui.'));
    }
    images.forEach((item, index) => {
        const card = make('article', 'exp-photo');
        card.style.setProperty('--photo-delay', `${(index % 6) * -0.45}s`);
        const image = make('img');
        image.src = item.thumbFallback || item.thumb || item.src;
        image.alt = item.alt || `Memória ${index + 1}`;
        image.loading = 'lazy';
        image.decoding = 'async';
        const favorite = button(progress.favoriteIds.includes(item.id) ? '♥ Guardada' : '♡ Guardar', 'exp-favorite');
        favorite.setAttribute('aria-pressed', String(progress.favoriteIds.includes(item.id)));
        favorite.addEventListener('click', () => {
            const exists = progress.favoriteIds.includes(item.id);
            progress.favoriteIds = exists ? progress.favoriteIds.filter(id => id !== item.id) : [...progress.favoriteIds, item.id];
            favorite.textContent = exists ? '♡ Guardar' : '♥ Guardada';
            favorite.setAttribute('aria-pressed', String(!exists));
            saveProgress();
        });
        const caption = make('p', '', item.cap || item.alt || 'Um detalhe especial');
        card.append(image, caption, favorite);
        gallery.append(card);
    });
    panel.body.append(gallery);
}
function renderGalleryFavorites() {
    const count = $('#exp-favorite-count');
    if (count)
        count.textContent = String(progress.favoriteIds.length);
}
function openRandomMessage() {
    const panel = openModal('Uma mensagem para agora');
    const messages = [
        'Você não precisa ser perfeita para ser incrível.',
        'Que hoje aconteça pelo menos uma coisa pequena que faça você sorrir.',
        'Continue criando, desenhando, ouvindo suas músicas e sendo você.',
        'Até os dias nublados merecem um pouco de carinho.',
        'Seu jeito de enxergar o mundo é uma parte bonita dele.',
        'Que nunca faltem histórias boas para contar e sonhos para imaginar.',
    ];
    const chosen = messages[Math.floor(Math.random() * messages.length)];
    const reveal = make('blockquote', 'exp-random-message', chosen);
    panel.body.append(reveal, make('p', 'exp-muted', 'Uma mensagem aleatória, só para deixar aqui um carinho.'));
    progress.openedSecrets = [...new Set([...progress.openedSecrets, 'random-message'])];
    saveProgress();
}
function applySavedScene() {
    if (document.documentElement.dataset.musicScene === 'on')
        return;
    document.documentElement.dataset.noaScene = progress.scene;
    document.querySelectorAll('button[data-noa-scene]').forEach(item => {
        item.setAttribute('aria-pressed', String(item.dataset.noaScene === progress.scene));
    });
}
class AudioExperience {
    constructor(canvas) {
        this.context = null;
        this.analyser = null;
        this.gain = null;
        this.oscillators = [];
        this.noiseSource = null;
        this.playing = false;
        this.frame = 0;
        this.draw = () => {
            if (!this.playing || !this.context || !this.analyser)
                return;
            const context = this.canvas.getContext('2d');
            if (!context)
                return;
            const width = Math.max(1, Math.round(this.canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 1.5)));
            const height = Math.max(1, Math.round(this.canvas.clientHeight * Math.min(window.devicePixelRatio || 1, 1.5)));
            if (this.canvas.width !== width || this.canvas.height !== height) {
                this.canvas.width = width;
                this.canvas.height = height;
            }
            const values = new Uint8Array(this.analyser.frequencyBinCount);
            this.analyser.getByteFrequencyData(values);
            context.clearRect(0, 0, width, height);
            const barWidth = width / values.length;
            values.forEach((value, index) => {
                const barHeight = (value / 255) * height;
                const gradient = context.createLinearGradient(0, height - barHeight, 0, height);
                gradient.addColorStop(0, '#f6c2d7');
                gradient.addColorStop(1, '#8d315b');
                context.fillStyle = gradient;
                context.fillRect(index * barWidth + 1, height - barHeight, Math.max(1, barWidth - 3), barHeight);
            });
            this.frame = requestAnimationFrame(this.draw);
        };
        this.canvas = canvas;
    }
    async start(mode, volume) {
        const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextConstructor)
            throw new Error('Áudio não suportado neste navegador.');
        this.stop();
        this.context = new AudioContextConstructor();
        await this.context.resume();
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 128;
        this.gain = this.context.createGain();
        this.gain.gain.value = clamp(volume, 0, 0.25);
        this.analyser.connect(this.gain);
        this.gain.connect(this.context.destination);
        const frequencies = mode === 'dream' ? [130.81, 196, 261.63] : mode === 'rain' ? [82.41, 123.47] : [110, 164.81, 220];
        frequencies.forEach((frequency, index) => {
            const oscillator = this.context.createOscillator();
            const level = this.context.createGain();
            oscillator.type = index === 1 ? 'triangle' : 'sine';
            oscillator.frequency.value = frequency;
            level.gain.value = index === 0 ? 0.28 : 0.12;
            oscillator.connect(level);
            level.connect(this.analyser);
            oscillator.start();
            this.oscillators.push(oscillator);
        });
        if (mode === 'rain') {
            const buffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++)
                data[i] = (Math.random() * 2 - 1) * 0.22;
            const source = this.context.createBufferSource();
            const filter = this.context.createBiquadFilter();
            const rainGain = this.context.createGain();
            source.buffer = buffer;
            source.loop = true;
            filter.type = 'lowpass';
            filter.frequency.value = 850;
            rainGain.gain.value = 0.12;
            source.connect(filter);
            filter.connect(rainGain);
            rainGain.connect(this.analyser);
            source.start();
            this.noiseSource = source;
        }
        this.playing = true;
        this.draw();
    }
    setVolume(value) {
        if (this.gain && this.context)
            this.gain.gain.setTargetAtTime(clamp(value, 0, 0.25), this.context.currentTime, 0.08);
    }
    stop() {
        this.playing = false;
        cancelAnimationFrame(this.frame);
        this.oscillators.forEach(node => { try {
            node.stop();
        }
        catch { } });
        this.oscillators = [];
        try {
            this.noiseSource?.stop();
        }
        catch { }
        this.noiseSource = null;
        if (this.context)
            void this.context.close();
        this.context = null;
        this.analyser = null;
        this.gain = null;
        const ctx = this.canvas.getContext('2d');
        ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
document.addEventListener('noa-restore-scene', applySavedScene);
function setScene(scene) {
    delete document.documentElement.dataset.musicScene;
    progress.scene = scene;
    applySavedScene();
    saveProgress();
}
const EXTRA_STORAGE_KEY = 'surpresa-noa-extra-experiences-v1';
const EXTRA_DEFAULT = { capsules: [], moments: [], wishes: [] };
let extraState = loadExtraState();
function extraId() {
    return window.crypto && typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `noa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function extraToday() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function extraClean(value, max = 500) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}
function normalizeExtraState(value) {
    if (!value || typeof value !== 'object')
        return { ...EXTRA_DEFAULT };
    const raw = value;
    const capsules = Array.isArray(raw.capsules)
        ? raw.capsules.filter((item) => !!item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.date === 'string' && typeof item.message === 'string' && typeof item.createdAt === 'string').slice(-30)
            .map(item => ({ id: item.id.slice(0, 80), title: item.title.slice(0, 48), date: item.date.slice(0, 10), message: item.message.slice(0, 1200), createdAt: item.createdAt.slice(0, 40) }))
        : [];
    const moments = Array.isArray(raw.moments)
        ? raw.moments.filter((item) => !!item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.date === 'string' && typeof item.text === 'string' && typeof item.createdAt === 'string').slice(-100)
            .map(item => ({ id: item.id.slice(0, 80), title: item.title.slice(0, 60), date: item.date.slice(0, 10), mood: String(item.mood ?? '♡').slice(0, 8), text: item.text.slice(0, 1200), createdAt: item.createdAt.slice(0, 40) }))
        : [];
    const wishes = Array.isArray(raw.wishes)
        ? raw.wishes.filter((item) => !!item && typeof item.id === 'string' && typeof item.text === 'string' && typeof item.createdAt === 'string').slice(-80)
            .map(item => ({ id: item.id.slice(0, 80), text: item.text.slice(0, 100), done: item.done === true, createdAt: item.createdAt.slice(0, 40) }))
        : [];
    return { capsules, moments, wishes };
}
function loadExtraState() {
    try {
        return normalizeExtraState(JSON.parse(localStorage.getItem(EXTRA_STORAGE_KEY) || 'null'));
    }
    catch {
        return { ...EXTRA_DEFAULT };
    }
}
function saveExtraState() {
    try {
        localStorage.setItem(EXTRA_STORAGE_KEY, JSON.stringify(extraState));
    }
    catch {
        expToast('O armazenamento deste aparelho está cheio. Exporte ou apague algumas anotações.');
    }
}
function extraField(labelText, control, help = '') {
    const wrap = make('label', 'exp-field');
    wrap.append(make('span', 'exp-field-label', labelText), control);
    if (help)
        wrap.append(make('small', 'exp-muted', help));
    return wrap;
}
function extraDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = make('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function extraListEmpty(message) {
    return make('p', 'exp-muted exp-empty', message);
}
function extraExport(data, filename) {
    const payload = { app: 'Surpresa para Noa', exportedAt: new Date().toISOString(), ...data };
    extraDownload(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), filename);
}
function openNoaTimeCapsule() {
    const panel = openModal('Cápsula do tempo', 'Escreva uma mensagem para uma data futura. Ela fica guardada neste navegador e só aparece como desbloqueada quando a data chegar.');
    const form = make('form', 'exp-form');
    const title = make('input', 'exp-input');
    title.maxLength = 48;
    title.placeholder = 'Título da cápsula';
    title.required = true;
    const date = make('input', 'exp-input');
    date.type = 'date';
    date.min = extraToday();
    const suggestedDate = new Date();
    suggestedDate.setFullYear(suggestedDate.getFullYear() + 1);
    date.value = `${suggestedDate.getFullYear()}-${String(suggestedDate.getMonth() + 1).padStart(2, '0')}-${String(suggestedDate.getDate()).padStart(2, '0')}`;
    date.required = true;
    const message = make('textarea', 'exp-input exp-textarea');
    message.rows = 4;
    message.maxLength = 1200;
    message.placeholder = 'O que você gostaria de lembrar quando essa data chegar?';
    message.required = true;
    const save = button('Guardar cápsula');
    save.type = 'submit';
    const notice = make('p', 'exp-muted', 'As cápsulas ficam somente neste aparelho. Não são enviadas para a internet.');
    form.append(extraField('Nome da cápsula', title), extraField('Data para abrir', date), extraField('Mensagem', message), save);
    const list = make('div', 'exp-record-list');
    list.id = 'noa-capsule-list';
    const renderCapsules = () => {
        list.replaceChildren();
        if (!extraState.capsules.length) {
            list.append(extraListEmpty('Nenhuma cápsula criada ainda.'));
            return;
        }
        [...extraState.capsules].sort((a, b) => a.date.localeCompare(b.date)).forEach(item => {
            const unlocked = item.date <= extraToday();
            const card = make('article', `exp-record ${unlocked ? 'is-unlocked' : 'is-locked'}`);
            const top = make('div', 'exp-record-top');
            const formattedDate = item.date.split('-').reverse().join('/');
            top.append(make('strong', '', item.title), make('span', 'exp-pill', unlocked ? 'Desbloqueada' : `Abre em ${formattedDate}`));
            const copy = make('p', 'exp-muted', unlocked ? item.message : `Esta mensagem continua fechada até ${formattedDate}.`);
            const del = button('Excluir', 'exp-mini-button');
            del.addEventListener('click', () => {
                extraState.capsules = extraState.capsules.filter(entry => entry.id !== item.id);
                saveExtraState();
                renderCapsules();
            });
            card.append(top, copy, del);
            list.append(card);
        });
    };
    form.addEventListener('submit', event => {
        event.preventDefault();
        const cleanTitle = extraClean(title.value, 48);
        const cleanMessage = String(message.value || '').trim().slice(0, 1200);
        if (!cleanTitle || !cleanMessage || !date.value || date.value < extraToday()) {
            expToast('Confira o título, a mensagem e escolha uma data de hoje em diante.');
            return;
        }
        if (extraState.capsules.length >= 30) {
            expToast('Limite de 30 cápsulas atingido. Exporte e remova algumas antes de criar outra.');
            return;
        }
        extraState.capsules.push({ id: extraId(), title: cleanTitle, date: date.value, message: cleanMessage, createdAt: new Date().toISOString() });
        saveExtraState();
        title.value = '';
        message.value = '';
        renderCapsules();
        expToast('Cápsula guardada. ♡');
    });
    panel.body.append(form, notice, make('h4', 'exp-subheading', 'Suas cápsulas'), list);
    renderCapsules();
    const exportButton = button('Exportar cápsulas', 'exp-outline');
    exportButton.addEventListener('click', () => extraExport({ capsules: extraState.capsules }, 'capsulas-noa.json'));
    panel.body.append(exportButton);
}
function openNoaJournal() {
    const panel = openModal('Diário de pequenos momentos', 'Guarde uma lembrança, uma frase ou algo bom que aconteceu. As anotações ficam neste aparelho.');
    const form = make('form', 'exp-form');
    const title = make('input', 'exp-input');
    title.maxLength = 60;
    title.placeholder = 'O título deste momento';
    title.required = true;
    const date = make('input', 'exp-input');
    date.type = 'date';
    date.value = extraToday();
    date.required = true;
    const mood = make('select', 'exp-input');
    const moods = [['♡', 'Carinho'], ['✦', 'Alegria'], ['☁', 'Calma'], ['☾', 'Saudade'], ['♫', 'Inspiração'], ['☂', 'Dia difícil']];
    moods.forEach(([value, label]) => {
        const option = make('option');
        option.value = value;
        option.textContent = `${value} ${label}`;
        mood.append(option);
    });
    const text = make('textarea', 'exp-input exp-textarea');
    text.rows = 4;
    text.maxLength = 1200;
    text.placeholder = 'Conte esse pequeno momento…';
    text.required = true;
    const submit = button('Salvar momento');
    submit.type = 'submit';
    form.append(extraField('Título', title), extraField('Data', date), extraField('Como foi o dia?', mood), extraField('Sua lembrança', text), submit);
    const list = make('div', 'exp-record-list');
    const render = () => {
        list.replaceChildren();
        if (!extraState.moments.length) {
            list.append(extraListEmpty('Seu diário ainda está em branco. Você pode começar com algo bem pequeno.'));
            return;
        }
        [...extraState.moments].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).forEach(item => {
            const card = make('article', 'exp-record');
            const top = make('div', 'exp-record-top');
            top.append(make('strong', '', `${item.mood || '♡'} ${item.title}`), make('time', 'exp-muted', item.date.split('-').reverse().join('/')));
            const copy = make('p', 'exp-muted', item.text);
            const del = button('Excluir', 'exp-mini-button');
            del.addEventListener('click', () => {
                extraState.moments = extraState.moments.filter(entry => entry.id !== item.id);
                saveExtraState();
                render();
            });
            card.append(top, copy, del);
            list.append(card);
        });
    };
    form.addEventListener('submit', event => {
        event.preventDefault();
        const cleanTitle = extraClean(title.value, 60);
        const cleanText = String(text.value).trim().slice(0, 1200);
        if (!cleanTitle || !cleanText || !date.value) {
            expToast('Preencha o título, a data e a lembrança.');
            return;
        }
        if (extraState.moments.length >= 100) {
            expToast('Limite de 100 momentos atingido. Exporte suas anotações antes de continuar.');
            return;
        }
        extraState.moments.push({ id: extraId(), title: cleanTitle, date: date.value, mood: mood.value, text: cleanText, createdAt: new Date().toISOString() });
        saveExtraState();
        title.value = '';
        text.value = '';
        render();
        expToast('Momento guardado. ♡');
    });
    panel.body.append(form, make('h4', 'exp-subheading', 'Momentos guardados'), list);
    const exportButton = button('Exportar diário', 'exp-outline');
    exportButton.addEventListener('click', () => extraExport({ moments: extraState.moments }, 'diario-noa.json'));
    panel.body.append(exportButton);
    render();
}
function openNoaWishJar() {
    const panel = openModal('Pote de desejos', 'Anote vontades, planos e pequenas coisas que gostaria de viver. Tire um desejo do pote quando quiser uma ideia.');
    const form = make('form', 'exp-inline-form');
    const input = make('input', 'exp-input');
    input.maxLength = 100;
    input.placeholder = 'Escreva um desejo…';
    input.required = true;
    const add = button('Adicionar');
    add.type = 'submit';
    form.append(input, add);
    const draw = button('Tirar um desejo do pote', 'exp-wish-draw');
    const chosen = make('blockquote', 'exp-random-message', 'Seus desejos ficam esperando aqui. ✨');
    const list = make('div', 'exp-record-list');
    const render = () => {
        list.replaceChildren();
        if (!extraState.wishes.length) {
            list.append(extraListEmpty('Adicione um desejo para começar.'));
            return;
        }
        [...extraState.wishes].reverse().forEach(item => {
            const card = make('article', `exp-record ${item.done ? 'is-done' : ''}`);
            const line = make('div', 'exp-wish-line');
            const text = make('span', '', `${item.done ? '✓' : '✧'} ${item.text}`);
            const toggle = button(item.done ? 'Desfazer' : 'Realizado', 'exp-mini-button');
            toggle.addEventListener('click', () => { item.done = !item.done; saveExtraState(); render(); });
            const del = button('×', 'exp-mini-button');
            del.setAttribute('aria-label', 'Excluir desejo');
            del.addEventListener('click', () => {
                extraState.wishes = extraState.wishes.filter(entry => entry.id !== item.id);
                saveExtraState();
                render();
            });
            line.append(text, toggle, del);
            card.append(line);
            list.append(card);
        });
    };
    form.addEventListener('submit', event => {
        event.preventDefault();
        const value = extraClean(input.value, 100);
        if (!value)
            return;
        if (extraState.wishes.length >= 80) {
            expToast('Limite de 80 desejos atingido.');
            return;
        }
        extraState.wishes.push({ id: extraId(), text: value, done: false, createdAt: new Date().toISOString() });
        input.value = '';
        saveExtraState();
        render();
    });
    draw.addEventListener('click', () => {
        const pending = extraState.wishes.filter(item => !item.done);
        if (!pending.length) {
            chosen.textContent = 'Não há desejos pendentes no pote. Adicione um novo!';
            return;
        }
        const item = pending[Math.floor(Math.random() * pending.length)];
        chosen.textContent = `✧ ${item.text}`;
    });
    panel.body.append(form, draw, chosen, make('h4', 'exp-subheading', 'Seus desejos'), list);
    render();
}
function openNoaDrawingStudio() {
    const panel = openModal('Pequeno ateliê', 'Desenhe com o dedo ou com o mouse. O desenho fica apenas nesta sessão, até você baixar a imagem.');
    const controls = make('div', 'exp-draw-controls');
    const color = make('input');
    color.type = 'color';
    color.value = '#b94b78';
    color.setAttribute('aria-label', 'Cor do pincel');
    const size = make('input');
    size.type = 'range';
    size.min = '2';
    size.max = '36';
    size.value = '8';
    size.setAttribute('aria-label', 'Espessura do pincel');
    const sizeLabel = make('span', 'exp-muted', '8 px');
    size.addEventListener('input', () => { sizeLabel.textContent = `${size.value} px`; });
    const clear = button('Apagar tudo', 'exp-outline');
    const download = button('Baixar desenho');
    controls.append(extraField('Cor', color), extraField('Espessura', size), sizeLabel, clear, download);
    const canvas = make('canvas', 'exp-drawing-canvas');
    canvas.width = 900;
    canvas.height = 560;
    canvas.setAttribute('aria-label', 'Área de desenho. Arraste o dedo para desenhar.');
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#fffafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }
    let drawing = false;
    let last = null, mid = null, activePointer = null;
    const point = (event, rect) => ({ x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height });
    const strokeStyle = () => { if (!ctx)
        return; ctx.strokeStyle = color.value; ctx.lineWidth = Number(size.value); };
    canvas.addEventListener('pointerdown', event => {
        if (!ctx || drawing || !event.isPrimary)
            return;
        drawing = true;
        activePointer = event.pointerId;
        canvas.setPointerCapture?.(event.pointerId);
        const p = point(event, canvas.getBoundingClientRect());
        last = mid = p;
        strokeStyle();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + .1, p.y + .1);
        ctx.stroke();
    });
    canvas.addEventListener('pointermove', event => {
        if (!drawing || !ctx || event.pointerId !== activePointer || !last || !mid)
            return;
        const rect = canvas.getBoundingClientRect(), samples = event.getCoalescedEvents?.() || [];
        strokeStyle();
        ctx.beginPath();
        ctx.moveTo(mid.x, mid.y);
        for (const sample of samples.length ? samples : [event]) {
            const p = point(sample, rect);
            const next = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
            ctx.quadraticCurveTo(last.x, last.y, next.x, next.y);
            last = p;
            mid = next;
        }
        ctx.stroke();
    });
    const end = (event) => { if (event.pointerId !== activePointer)
        return; if (ctx && last && mid) {
        strokeStyle();
        ctx.beginPath();
        ctx.moveTo(mid.x, mid.y);
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
    } drawing = false; last = mid = null; activePointer = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);
    clear.addEventListener('click', () => {
        if (!ctx)
            return;
        drawing = false;
        last = mid = null;
        activePointer = null;
        ctx.fillStyle = '#fffafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
    download.addEventListener('click', () => canvas.toBlob(blob => {
        if (blob)
            extraDownload(blob, 'desenho-noa.png');
        else
            expToast('Não foi possível preparar a imagem.');
    }, 'image/png'));
    panel.body.append(controls, canvas, make('p', 'exp-muted', 'Dica: vire o celular na horizontal para ter mais espaço para desenhar.'));
}
function openNoaVoiceNote() {
    const panel = openModal('Gravar um recado de voz', 'A gravação usa o microfone somente depois que você tocar em começar. O áudio não é enviado para nenhum servidor.');
    const status = make('p', 'exp-voice-status', 'Pronto para gravar.');
    const start = button('Começar gravação');
    const stop = button('Finalizar gravação', 'exp-outline');
    stop.disabled = true;
    const playback = make('audio', 'exp-recorded-audio');
    playback.controls = true;
    playback.hidden = true;
    const download = button('Baixar recado', 'exp-outline');
    download.hidden = true;
    let recorder = null;
    let stream = null;
    let chunks = [];
    let objectUrl = null;
    let recordedBlob = null;
    let disposed = false;
    const cleanup = () => {
        disposed = true;
        if (recorder && recorder.state !== 'inactive') {
            try {
                recorder.stop();
            }
            catch { }
        }
        stream?.getTracks().forEach(track => track.stop());
        if (objectUrl)
            URL.revokeObjectURL(objectUrl);
        stream = null;
        recorder = null;
        objectUrl = null;
        recordedBlob = null;
    };
    modalCleanup = cleanup;
    start.addEventListener('click', async () => {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            status.textContent = 'Este navegador não oferece gravação de áudio. Tente Chrome ou Samsung Internet atualizados.';
            return;
        }
        try {
            const requestedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (disposed || !modal) {
                requestedStream.getTracks().forEach(track => track.stop());
                return;
            }
            stream = requestedStream;
            const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported?.(type));
            recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
            chunks = [];
            recorder.addEventListener('dataavailable', event => { if (event.data?.size)
                chunks.push(event.data); });
            const activeRecorder = recorder;
            recorder.addEventListener('stop', () => {
                if (disposed)
                    return;
                const blob = new Blob(chunks, { type: activeRecorder.mimeType || 'audio/webm' });
                recordedBlob = blob;
                if (objectUrl)
                    URL.revokeObjectURL(objectUrl);
                objectUrl = URL.createObjectURL(blob);
                playback.src = objectUrl;
                playback.hidden = false;
                download.hidden = false;
                status.textContent = `Recado gravado (${Math.max(1, Math.round(blob.size / 1024))} KB). Ele continua somente neste aparelho até você baixá-lo.`;
                stream?.getTracks().forEach(track => track.stop());
                stream = null;
            });
            recorder.start(250);
            status.textContent = 'Gravando… toque em finalizar quando terminar.';
            start.disabled = true;
            stop.disabled = false;
        }
        catch (error) {
            status.textContent = error instanceof DOMException && error.name === 'NotAllowedError'
                ? 'Permissão de microfone negada. Você pode liberá-la nas permissões do navegador.'
                : 'Não foi possível iniciar o microfone neste aparelho.';
            stream?.getTracks().forEach(track => track.stop());
            stream = null;
        }
    });
    stop.addEventListener('click', () => {
        if (recorder && recorder.state !== 'inactive')
            recorder.stop();
        start.disabled = false;
        stop.disabled = true;
    });
    download.addEventListener('click', () => {
        if (!recordedBlob)
            return;
        const extension = recordedBlob.type.includes('mp4') ? 'm4a' : 'webm';
        extraDownload(recordedBlob, `recado-de-voz-noa.${extension}`);
    });
    const actions = make('div', 'exp-voice-actions');
    actions.append(start, stop);
    panel.body.append(status, actions, playback, download);
}
function openNoaPostcardMaker() {
    const panel = openModal('Criar um cartão de lembrança', 'Escolha uma foto da galeria, escreva uma frase e gere um cartão como imagem para guardar ou compartilhar.');
    const form = make('div', 'exp-form');
    const select = make('select', 'exp-input');
    config_1.CONFIG.gallery.forEach((item, index) => {
        const option = make('option');
        option.value = String(index);
        option.textContent = `${String(index + 1).padStart(2, '0')} · ${item.cap || item.alt || 'Fotografia'}`.slice(0, 70);
        select.append(option);
    });
    const caption = make('textarea', 'exp-input exp-textarea');
    caption.rows = 2;
    caption.maxLength = 100;
    caption.value = 'Uma lembrança para guardar com carinho ♡';
    const canvas = make('canvas', 'exp-postcard-canvas');
    canvas.width = 900;
    canvas.height = 1120;
    const ctx = canvas.getContext('2d');
    const draw = () => {
        if (!ctx)
            return;
        const item = config_1.CONFIG.gallery[Number(select.value)] || config_1.CONFIG.gallery[0];
        if (!item)
            return;
        const image = new Image();
        image.onload = () => {
            ctx.fillStyle = '#180f1b';
            ctx.fillRect(0, 0, 900, 1120);
            const gradient = ctx.createLinearGradient(0, 0, 900, 1120);
            gradient.addColorStop(0, '#422038');
            gradient.addColorStop(1, '#130e1b');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 900, 1120);
            ctx.strokeStyle = '#edb4ca';
            ctx.lineWidth = 4;
            ctx.strokeRect(34, 34, 832, 1052);
            const box = { x: 82, y: 88, w: 736, h: 730 };
            const scale = Math.max(box.w / image.width, box.h / image.height);
            const sw = box.w / scale;
            const sh = box.h / scale;
            const sx = (image.width - sw) / 2;
            const sy = (image.height - sh) / 2;
            ctx.save();
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function')
                ctx.roundRect(box.x, box.y, box.w, box.h, 18);
            else
                ctx.rect(box.x, box.y, box.w, box.h);
            ctx.clip();
            ctx.drawImage(image, sx, sy, sw, sh, box.x, box.y, box.w, box.h);
            ctx.restore();
            ctx.fillStyle = '#f9dce8';
            ctx.textAlign = 'center';
            ctx.font = '600 38px Georgia';
            ctx.fillText('UMA LEMBRANÇA ♡', 450, 890);
            ctx.font = '30px Georgia';
            const words = caption.value.trim().split(/\s+/);
            let line = '';
            let y = 950;
            for (const word of words) {
                const test = line ? `${line} ${word}` : word;
                if (ctx.measureText(test).width > 720 && line) {
                    ctx.fillText(line, 450, y);
                    line = word;
                    y += 43;
                }
                else
                    line = test;
            }
            if (line)
                ctx.fillText(line, 450, y);
            ctx.font = '24px Georgia';
            ctx.fillStyle = '#dba2ba';
            ctx.fillText('— Kauê', 450, 1040);
        };
        image.onerror = () => expToast('Não foi possível carregar esta foto.');
        image.src = item.src || item.thumb || item.thumbFallback || '';
    };
    const render = button('Atualizar cartão', 'exp-outline');
    render.addEventListener('click', draw);
    const save = button('Baixar cartão');
    save.addEventListener('click', () => canvas.toBlob(blob => {
        if (blob)
            extraDownload(blob, 'cartao-de-lembranca-noa.png');
        else
            expToast('Não foi possível preparar o cartão.');
    }, 'image/png'));
    form.append(extraField('Fotografia', select), extraField('Mensagem', caption));
    panel.body.append(form, canvas, render, save);
    select.addEventListener('change', draw);
    caption.addEventListener('input', draw);
    draw();
}
function openNoaConstellation() {
    const panel = openModal('Constelação de memórias', 'Cada estrela representa uma parte da história. Toque em uma delas para ler a lembrança.');
    const map = make('div', 'exp-constellation');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 600 330');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const positions = [{ x: 70, y: 220 }, { x: 190, y: 100 }, { x: 325, y: 190 }, { x: 440, y: 80 }, { x: 535, y: 235 }];
    for (let index = 0; index < positions.length - 1; index++) {
        const start = positions[index];
        const end = positions[index + 1];
        const line = document.createElementNS(svg.namespaceURI, 'path');
        line.setAttribute('d', `M${start.x} ${start.y} L${end.x} ${end.y}`);
        line.setAttribute('class', 'exp-star-line');
        svg.append(line);
    }
    map.append(svg);
    const info = make('article', 'exp-constellation-info');
    info.append(make('strong', '', 'Escolha uma estrela'), make('p', 'exp-muted', 'Uma lembrança será revelada aqui.'));
    config_1.CONFIG.timeline.forEach((item, index) => {
        const position = positions[index % positions.length];
        const node = button('✦', 'exp-star-node');
        node.style.left = `${position.x / 6}%`;
        node.style.top = `${position.y / 3.3}%`;
        node.setAttribute('aria-label', `Memória ${index + 1}: ${item.d}`);
        node.addEventListener('click', () => {
            map.querySelectorAll('.exp-star-node').forEach(star => star.classList.remove('active'));
            node.classList.add('active');
            info.replaceChildren(make('strong', '', item.d), make('p', 'exp-muted', item.t));
            (0, motion_1.animateMotion)(info, [{ opacity: .45, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'ease-out' });
        });
        map.append(node);
    });
    panel.body.append(map, info);
}
function openNoaBreathingPause() {
    const panel = openModal('Uma pausa tranquila', 'Um pequeno exercício visual de respiração. Não é uma avaliação nem substitui orientação profissional; apenas acompanhe o círculo no seu ritmo.');
    const stage = make('div', 'exp-breath-stage');
    const circle = make('div', 'exp-breath-circle');
    const label = make('strong', 'exp-breath-label', 'Quando quiser, comece.');
    stage.append(circle, label);
    const toggle = button('Começar pausa');
    let timer = 0;
    let running = false;
    let phase = 0;
    const phases = [{ text: 'Inspire devagar', duration: 4000 }, { text: 'Solte o ar', duration: 6000 }];
    const tick = () => {
        if (!running)
            return;
        const current = phases[phase];
        label.textContent = current.text;
        circle.classList.toggle('inhale', phase === 0);
        circle.classList.toggle('exhale', phase === 1);
        timer = window.setTimeout(() => { phase = (phase + 1) % 2; tick(); }, current.duration);
    };
    toggle.addEventListener('click', () => {
        running = !running;
        if (running) {
            phase = 0;
            toggle.textContent = 'Encerrar pausa';
            tick();
        }
        else {
            if (timer)
                clearTimeout(timer);
            circle.classList.remove('inhale', 'exhale');
            label.textContent = 'Pausa encerrada. Obrigado por reservar esse momento.';
            toggle.textContent = 'Recomeçar';
        }
    });
    modalCleanup = () => { running = false; if (timer)
        clearTimeout(timer); };
    panel.body.append(stage, toggle);
}
function buildExperienceSection() {
    const root = $('#experience-content');
    if (!root)
        return;
    const grid = make('div', 'exp-grid');
    addFeatureCard(grid, '✉', 'Carta secreta', 'Uma mensagem com efeito de escrita.', openSecretLetter);
    addFeatureCard(grid, '🎁', 'Caixa misteriosa', 'Abra presentes e encontre frases especiais.', openMysteryBox);
    addFeatureCard(grid, '✦', 'Raspadinha', 'Raspe a superfície para revelar uma mensagem.', openScratchCard);
    addFeatureCard(grid, '🧩', 'Jogo da memória', 'Encontre pares e desbloqueie uma conquista.', openMemoryGame);
    addFeatureCard(grid, '🔎', 'Enigma', 'Resolva uma pergunta sobre o começo da história.', openRiddle);
    addFeatureCard(grid, '📷', 'Fotos flutuantes', 'Explore a galeria e guarde suas favoritas.', openFloatingGallery);
    addFeatureCard(grid, '♡', 'Mensagem aleatória', 'Uma frase carinhosa para abrir quando quiser.', openRandomMessage);
    addFeatureCard(grid, '⌁', 'Modo cinematográfico', 'Amplie a atmosfera e esconda distrações.', () => {
        const active = document.documentElement.classList.toggle('noa-cinema');
        const trigger = $('#exp-cinema-toggle');
        if (trigger)
            trigger.textContent = active ? 'Sair do modo cinema' : 'Ativar modo cinema';
        expToast(active ? 'Modo cinematográfico ativado' : 'Modo cinematográfico desativado');
    });
    addFeatureCard(grid, '⏳', 'Cápsula do tempo', 'Guarde uma mensagem para abrir em uma data futura.', openNoaTimeCapsule);
    addFeatureCard(grid, '📖', 'Diário de momentos', 'Registre dias, sentimentos e pequenas lembranças.', openNoaJournal);
    addFeatureCard(grid, '✨', 'Pote de desejos', 'Anote planos e sorteie uma ideia para realizar.', openNoaWishJar);
    addFeatureCard(grid, '🎨', 'Pequeno ateliê', 'Desenhe com o dedo e baixe sua criação.', openNoaDrawingStudio);
    addFeatureCard(grid, '🎙', 'Recado de voz', 'Grave uma mensagem no aparelho, sem enviar para servidores.', openNoaVoiceNote);
    addFeatureCard(grid, '💌', 'Criar cartão', 'Monte um cartão com uma foto e sua própria frase.', openNoaPostcardMaker);
    addFeatureCard(grid, '🌌', 'Constelação', 'Explore uma representação das memórias da história.', openNoaConstellation);
    addFeatureCard(grid, '☁', 'Pausa tranquila', 'Acompanhe uma animação de respiração no seu ritmo.', openNoaBreathingPause);
    root.append(grid);
    const heading = make('div', 'u-section-heading');
    const eyebrow = make('span', 'exp-eyebrow', 'THE UNIVERSE OF YOU · EDIÇÃO 7');
    const title = make('h3', '', 'Além das estrelas · seis novos destinos');
    const count = make('p', 'u-progress');
    heading.append(eyebrow, title, count);
    const worlds = make('div', 'exp-grid u-world-grid');
    const openWorld = (id) => {
        const world = universe_1.WORLDS.find(w => w.id === id);
        if (!world)
            return;
        const panel = openModal(world.title, world.description);
        modalCleanup = (0, universe_1.mountUniverse)(id, panel, openWorld);
    };
    for (const world of universe_1.WORLDS) {
        addFeatureCard(worlds, world.icon, world.title, world.description, () => openWorld(world.id));
        worlds.lastElementChild.dataset.worldCard = world.id;
    }
    const dashboard = make('div', 'u-dashboard');
    const track = make('div', 'u-progress-track');
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', 'Mundos descobertos');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', String(universe_1.WORLDS.length));
    const fill = make('span');
    track.append(fill);
    const filters = make('div', 'u-filterbar');
    const search = make('input');
    search.type = 'search';
    search.placeholder = 'Encontrar uma experiência…';
    search.setAttribute('aria-label', 'Pesquisar mundos');
    const filter = make('select');
    filter.setAttribute('aria-label', 'Filtrar experiências');
    for (const [v, t] of [['all', 'Todos os mundos'], ['games', 'Minigames'], ['new', 'Ainda não descobertos'], ['done', 'Já descobertos']]) {
        const o = make('option', '', t);
        o.value = v;
        filter.append(o);
    }
    filters.append(search, filter);
    const result = make('p', 'u-filter-result');
    result.setAttribute('role', 'status');
    dashboard.append(track, filters, result);
    const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const update = () => { const n = (0, universe_1.universeProgress)(); count.textContent = `${n} de ${universe_1.WORLDS.length} novas descobertas`; track.setAttribute('aria-valuenow', String(n)); fill.style.width = `${n / universe_1.WORLDS.length * 100}%`; let visible = 0; universe_1.WORLDS.forEach((w, i) => { const card = worlds.children[i]; const done = (0, universe_1.universeDiscovered)(w.id); card.dataset.discovered = String(done); const arrow = card.querySelector('.exp-card-arrow'); if (arrow)
        arrow.textContent = done ? 'Descoberto ✓' : 'Abrir →'; const match = normalize(w.title + ' ' + w.description).includes(normalize(search.value.trim())); const category = filter.value === 'all' || (filter.value === 'games' && ['stars', 'path', 'puzzle'].includes(w.id)) || (filter.value === 'new' && !done) || (filter.value === 'done' && done); card.hidden = !(match && category); if (!card.hidden)
        visible++; }); result.textContent = visible ? `${visible} ${visible === 1 ? 'experiência disponível' : 'experiências disponíveis'}` : 'Nenhuma experiência encontrada.'; };
    search.addEventListener('input', update);
    filter.addEventListener('change', update);
    document.addEventListener('universe-progress', update);
    update();
    root.append(heading, dashboard, worlds);
    if ('IntersectionObserver' in window) {
        const cardObserver = new IntersectionObserver(entries => entries.forEach(entry => { entry.target.dataset.offscreen = String(!entry.isIntersecting); }), { rootMargin: '80px' });
        root.querySelectorAll('.exp-card').forEach(card => cardObserver.observe(card));
    }
    const sceneButtons = $('#scene-buttons');
    sceneButtons?.querySelectorAll('[data-noa-scene]').forEach(item => {
        item.addEventListener('click', () => setScene(item.dataset.noaScene));
    });
    applySavedScene();
    const soundToggle = $('#ambient-toggle');
    const volume = $('#ambient-volume');
    const mode = $('#ambient-mode');
    const canvas = $('#audio-visualizer');
    if (soundToggle && volume instanceof HTMLInputElement && mode instanceof HTMLSelectElement && canvas instanceof HTMLCanvasElement) {
        audio = new AudioExperience(canvas);
        soundToggle.addEventListener('click', async () => {
            if (soundToggle.getAttribute('aria-pressed') === 'true') {
                audio?.stop();
                soundToggle.setAttribute('aria-pressed', 'false');
                soundToggle.textContent = 'Ativar som ambiente';
                return;
            }
            try {
                await audio?.start(mode.value, Number(volume.value));
                soundToggle.setAttribute('aria-pressed', 'true');
                soundToggle.textContent = 'Desativar som ambiente';
            }
            catch (error) {
                expToast(error instanceof Error ? error.message : 'Não foi possível iniciar o áudio.');
            }
        });
        volume.addEventListener('input', () => audio?.setVolume(Number(volume.value)));
        mode.addEventListener('change', async () => {
            if (soundToggle.getAttribute('aria-pressed') !== 'true')
                return;
            try {
                await audio?.start(mode.value, Number(volume.value));
            }
            catch {
                expToast('Não foi possível trocar o som ambiente.');
            }
        });
        document.addEventListener('visibilitychange', () => { if (document.hidden) {
            audio?.stop();
            soundToggle.setAttribute('aria-pressed', 'false');
            soundToggle.textContent = 'Ativar som ambiente';
        } });
    }
    const install = $('#pwa-install');
    install?.addEventListener('click', async () => {
        if (installPrompt) {
            await installPrompt.prompt();
            const result = await installPrompt.userChoice;
            installPrompt = null;
            install.textContent = result.outcome === 'accepted' ? 'Aplicativo instalado' : 'Instalar na tela inicial';
            return;
        }
        openInstallHelp();
    });
    $('#share-surprise')?.addEventListener('click', async () => {
        const shareData = { title: document.title, text: 'Uma surpresa especial ♡', url: location.href };
        try {
            if (navigator.share)
                await navigator.share(shareData);
            else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(location.href);
                expToast('Link copiado!');
            }
            else
                expToast('Use o menu do navegador para compartilhar esta página.');
        }
        catch { }
    });
    $('#export-progress')?.addEventListener('click', () => {
        extraExport({ progress, extraExperiences: extraState, universe: (0, universe_1.exportUniverse)() }, 'backup-completo-noa.json');
        expToast('Backup completo preparado.');
    });
    $('#import-progress')?.addEventListener('click', () => {
        const picker = make('input');
        picker.type = 'file';
        picker.accept = 'application/json,.json';
        picker.hidden = true;
        document.body.append(picker);
        picker.addEventListener('change', async () => {
            const file = picker.files?.[0];
            picker.remove();
            if (!file)
                return;
            if (file.size > 1024 * 1024) {
                expToast('O arquivo de backup é maior que 1 MB.');
                return;
            }
            try {
                const parsed = JSON.parse(await file.text());
                if (!parsed || typeof parsed !== 'object' || (!parsed.progress && !parsed.extraExperiences)) {
                    expToast('Esse arquivo não parece ser um backup desta experiência.');
                    return;
                }
                if (!window.confirm('Restaurar este backup? Os dados atuais deste aparelho serão substituídos.'))
                    return;
                if (parsed.progress) {
                    progress = normalizeProgress(parsed.progress);
                    saveProgress();
                }
                extraState = parsed.extraExperiences ? normalizeExtraState(parsed.extraExperiences) : { ...EXTRA_DEFAULT };
                saveExtraState();
                if (parsed.universe)
                    (0, universe_1.importUniverse)(parsed.universe);
                applySavedScene();
                expToast('Backup restaurado neste aparelho. ♡');
            }
            catch {
                expToast('Não foi possível ler o backup. Verifique se o arquivo JSON está íntegro.');
            }
        }, { once: true });
        picker.click();
    });
    $('#reset-progress')?.addEventListener('click', () => {
        const confirmed = window.confirm('Apagar as descobertas e favoritos salvos neste aparelho?');
        if (!confirmed)
            return;
        progress = { ...DEFAULT_PROGRESS, favoriteIds: [], openedSecrets: [] };
        extraState = { ...EXTRA_DEFAULT, capsules: [], moments: [], wishes: [] };
        saveExtraState();
        saveProgress();
        (0, universe_1.resetUniverse)();
        applySavedScene();
        expToast('Progresso local reiniciado.');
    });
    const favButton = $('#show-favorites');
    favButton?.addEventListener('click', () => openFloatingGallery(true));
    void loadProgress();
    void registerServiceWorker();
}
function openInstallHelp() {
    const panel = openModal('Instalar no celular', 'A instalação depende do navegador e de a página estar publicada em HTTPS.');
    const steps = make('ol', 'exp-install-steps');
    [
        'Abra esta página no Chrome ou Samsung Internet.',
        'Toque no menu do navegador (⋮).',
        'Escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.',
        'Confirme. O ícone aparecerá junto dos outros aplicativos.',
    ].forEach(step => steps.append(make('li', '', step)));
    panel.body.append(steps, make('p', 'exp-muted', 'Em iPhone/iPad, use Compartilhar → Adicionar à Tela de Início. O modo offline fica disponível depois que a página e seus arquivos forem carregados pelo menos uma vez.'));
}
async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol))
        return;
    try {
        const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
        void registration.update().catch(() => { });
    }
    catch {
        expToast('O modo offline não pôde ser ativado neste navegador.');
    }
}
window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    const install = $('#pwa-install');
    if (install)
        install.textContent = 'Instalar aplicativo';
});
window.addEventListener('appinstalled', () => {
    const install = $('#pwa-install');
    if (install)
        install.textContent = 'Aplicativo instalado';
    expToast('Surpresa adicionada à tela inicial!');
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal)
        closeModal();
});
buildExperienceSection();

},
"./cinematic":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCinema = initCinema;
const music_visuals_1 = require("./music-visuals");
const TAU = Math.PI * 2;
const root = document.documentElement;
const clampC = (v, a, b) => Math.max(a, Math.min(b, v));
const motionOff = () => root.dataset.motion === 'reduced';
const quality = () => root.dataset.q === 'low' ? 0 : root.dataset.q === 'high' ? 2 : 1;
class Surface {
    constructor(canvas) {
        this.canvas = canvas;
        this.w = 0;
        this.h = 0;
        this.dpr = 0;
        this.ctx = canvas.getContext('2d');
    }
    resize() {
        const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
        if (!w || !h || !this.ctx)
            return false;
        const dpr = Math.min(devicePixelRatio || 1, [1, 1.5, 2][quality()], Math.sqrt(2300000 / (w * h)));
        if (w !== this.w || h !== this.h || dpr !== this.dpr) {
            this.w = w;
            this.h = h;
            this.dpr = dpr;
            this.canvas.width = Math.max(1, Math.round(w * dpr));
            this.canvas.height = Math.max(1, Math.round(h * dpr));
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        return true;
    }
    clear() { this.ctx?.clearRect(0, 0, this.w, this.h); }
    release() { this.canvas.width = this.canvas.height = 1; this.w = this.h = this.dpr = 0; }
}
const particleCounts = [34, 68, 108];
const stars = Array.from({ length: Math.max(...particleCounts) }, (_, i) => ({
    x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random(),
    seed: Math.random() * TAU, speed: .045 + Math.random() * .07, heart: i % 7 === 0,
}));
let rainLens = null;
function lensSprite() { if (rainLens)
    return rainLens; const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; const c = canvas.getContext('2d'); if (!c)
    return null; const g = c.createRadialGradient(22, 18, 2, 32, 32, 30); g.addColorStop(0, '#fff0fbcc'); g.addColorStop(.28, '#c9b6dd33'); g.addColorStop(.65, '#27244255'); g.addColorStop(.82, '#150f2e77'); g.addColorStop(.92, '#bcbce98a'); g.addColorStop(1, '#0000'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); c.strokeStyle = '#e8ddff99'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(32, 32, 24, 28, 0, 3.5, 5.1); c.stroke(); c.strokeStyle = '#f6d2ec66'; c.beginPath(); c.ellipse(32, 32, 24, 28, 0, .35, 1.4); c.stroke(); rainLens = canvas; return canvas; }
const musicHues = { wine: 332, amber: 38, violet: 269, silver: 214, rose: 341 };
let jewelHue = 332;
const mixes = new WeakMap();
const musicTints = { wine: '#df78a4', amber: '#e9bb79', violet: '#aa8bf4', silver: '#a9c9ef', rose: '#f5a6c8' };
const nebulaCache = new Map();
function noise2(x, y, seed) { const a = Math.floor(x), b = Math.floor(y), u = x - a, v = y - b; const f = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7 + seed * 41.9) * 43758.5453; return n - Math.floor(n); }; const sx = u * u * (3 - 2 * u), sy = v * v * (3 - 2 * v); return (f(a, b) * (1 - sx) + f(a + 1, b) * sx) * (1 - sy) + (f(a, b + 1) * (1 - sx) + f(a + 1, b + 1) * sx) * sy; }
function nebulaPlanes(tint) {
    let planes = nebulaCache.get(tint);
    if (planes)
        return planes;
    planes = [];
    const rgb = [parseInt(tint.slice(1, 3), 16), parseInt(tint.slice(3, 5), 16), parseInt(tint.slice(5, 7), 16)];
    for (let k = 0; k < 3; k++) {
        const cv = document.createElement('canvas');
        cv.width = 192;
        cv.height = 112;
        const ctx = cv.getContext('2d');
        if (!ctx)
            continue;
        const w = cv.width, h = cv.height, density = new Float32Array(w * h), img = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                const u = x / w, v = y / h, warp = (noise2(u * 5, v * 4, k * 11) - .5) * .16;
                let sum = 0, amp = .56;
                for (let o = 0; o < 4; o++) {
                    const scale = 3 * (1 << o);
                    sum += amp * noise2((u + warp) * scale * 1.7, (v - warp * .65) * scale, k * 13 + o);
                    amp *= .49;
                }
                const ridge = Math.exp(-Math.pow((v - .5 - .19 * Math.sin(u * 5 + k) - warp) / .32, 2)), edge = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
                density[y * w + x] = clampC((sum - .27) * 2.35, 0, 1) * ridge * edge;
            }
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                const j = y * w + x, d = density[j], a = density[Math.max(0, y - 2) * w + Math.max(0, x - 3)], b = density[Math.max(0, y - 5) * w + Math.max(0, x - 7)], light = Math.exp(-(a + b) * 1.2), rim = clampC((d - a) * 3.5, 0, 1), glow = clampC(d * 1.4, 0, 1), i = j * 4;
                for (let ch = 0; ch < 3; ch++)
                    img.data[i + ch] = Math.min(255, Math.round(rgb[ch] * (.30 + .66 * light + .30 * rim) + glow * 22 + rim * 38));
                img.data[i + 3] = Math.round(d * (64 + glow * 112));
            }
        ctx.putImageData(img, 0, 0);
        planes.push(cv);
    }
    if (nebulaCache.size >= 6)
        nebulaCache.delete(nebulaCache.keys().next().value);
    nebulaCache.set(tint, planes);
    return planes;
}
const paletteTransitions = new WeakMap();
function drawNebulaLayers(s, t, dt, x, y, tint, strength, depth) {
    const c = s.ctx, w = s.w, h = s.h;
    let p = paletteTransitions.get(s);
    if (!p) {
        p = { from: tint, to: tint, amount: 1 };
        paletteTransitions.set(s, p);
    }
    if (p.to !== tint) {
        p.from = p.amount > .5 ? p.to : p.from;
        p.to = tint;
        p.amount = p.from === tint ? 1 : 0;
    }
    p.amount = motionOff() ? 1 : Math.min(1, p.amount + dt * .95);
    const u = p.amount * p.amount * (3 - 2 * p.amount);
    const draw = (key, weight) => { if (weight < .005)
        return; const planes = nebulaPlanes(key); for (let i = 0; i < Math.min(planes.length, quality() === 0 ? 2 : 3); i++) {
        const z = .18 + i * .19, zoom = 1.15 + z * .55 + depth * .035, xx = (w - w * zoom) / 2 + Math.sin(t * .045 + i * 2) * w * .035 + x * 19 * z, yy = (h - h * zoom) / 2 + Math.cos(t * .035 + i) * h * .04 + y * 17 * z;
        c.globalAlpha = strength * weight;
        c.drawImage(planes[i], xx, yy, w * zoom, h * zoom);
    } };
    c.save();
    if (p.from !== p.to)
        draw(p.from, 1 - u);
    draw(p.to, p.from === p.to ? 1 : u);
    c.restore();
}
let wetSample = null;
function snapshotWet(s) { const cv = wetSample || (wetSample = document.createElement('canvas')), w = [160, 240, 320][quality()], h = Math.max(1, Math.min(480, Math.round(w * s.h / s.w))); if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
} const ctx = cv.getContext('2d'); if (!ctx)
    return null; ctx.clearRect(0, 0, w, h); ctx.drawImage(s.canvas, 0, 0, w, h); return cv; }
function drawAtmosphere(s, t, dt, x, y, _gate) {
    if (!s.resize())
        return false;
    const c = s.ctx, w = s.w, h = s.h, scene = root.dataset.noaScene === 'rain' ? 'rain' : root.dataset.noaScene === 'aurora' ? 'aurora' : 'stars';
    let mix = mixes.get(s);
    if (!mix) {
        mix = { stars: scene === 'stars' ? 1 : 0, rain: scene === 'rain' ? 1 : 0, aurora: scene === 'aurora' ? 1 : 0 };
        mixes.set(s, mix);
    }
    (0, music_visuals_1.blendAtmosphere)(mix, scene, dt, motionOff());
    const sw = mix.stars, rw = mix.rain, aw = mix.aurora;
    s.clear();
    const energy = music_visuals_1.audioVisual.energy, bass = music_visuals_1.audioVisual.bass, treble = music_visuals_1.audioVisual.treble;
    const dynamics = music_visuals_1.audioVisual.dynamics, accent = Math.max(music_visuals_1.audioVisual.accent, music_visuals_1.audioVisual.beat * .65);
    const tint = musicTints[(0, music_visuals_1.visualMood)()] || '#d5a2ce';
    const score = music_visuals_1.audioVisual.score, depth = music_visuals_1.audioVisual.depth;
    drawNebulaLayers(s, t, dt, x, y, tint, (sw + .42 * aw + .23 * rw) * (.65 + score * .20 + dynamics * .12), depth);
    if (energy > .01) {
        const g = c.createRadialGradient(w * .5, h * .45, 0, w * .5, h * .45, Math.max(w, h) * .7);
        g.addColorStop(0, tint);
        g.addColorStop(1, '#0000');
        c.globalAlpha = .025 + energy * .09 + dynamics * .10 + music_visuals_1.audioVisual.contrast * .06;
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
        c.globalAlpha = 1;
    }
    const vignette = c.createRadialGradient(w * .5, h * .44, 0, w * .5, h * .48, Math.max(w, h) * .76);
    vignette.addColorStop(0, 'rgba(255,255,255,0)');
    vignette.addColorStop(.72, 'rgba(18,12,26,.16)');
    vignette.addColorStop(1, 'rgba(4,3,7,.42)');
    if (sw > .001) {
        c.globalAlpha = sw;
        for (let i = 0; i < 4; i++) {
            const rx = w * (.14 + i * .22 + Math.sin(t * .085 + i * 1.5) * .06), ry = h * (.24 + i * .14 + Math.cos(t * .105 + i) * .05), r = Math.min(w, h) * (.34 + i * .09);
            const g = c.createRadialGradient(rx, ry, 0, rx, ry, r);
            g.addColorStop(0, ['#8f4c712a', '#bb6b9d24', '#8768c026', '#6a8ecf21'][i]);
            g.addColorStop(.46, ['#8f4c7114', '#bb6b9d12', '#8768c014', '#6a8ecf10'][i]);
            g.addColorStop(1, '#0000');
            c.fillStyle = g;
            c.fillRect(rx - r, ry - r, r * 2, r * 2);
        }
    }
    c.globalAlpha = 1;
    if (rw > .001) {
        c.globalAlpha = rw;
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#899fce12');
        g.addColorStop(1, '#19234635');
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
        for (let i = 0; i < 3; i++) {
            const rx = w * (.2 + i * .3), ry = h * (.82 + .05 * Math.sin(t * .2 + i)), r = Math.max(1, Math.min(w, h) * .36);
            const reflection = c.createRadialGradient(rx, ry, 0, rx, ry, r);
            reflection.addColorStop(0, ['#d16b9f25', '#a48acf21', '#70a3db21'][i]);
            reflection.addColorStop(1, '#0000');
            c.fillStyle = reflection;
            c.fillRect(rx - r, ry - r, r * 2, r * 2);
        }
    }
    c.globalAlpha = 1;
    if (aw > .001) {
        c.globalAlpha = aw;
        for (let band = 0; band < 3; band++) {
            const y0 = h * (.24 + band * .12), height = h * (.20 + band * .025 + bass * .05 + dynamics * .04), phase = t * (.28 + band * .05) + band * 1.9;
            const wave = (u) => y0 + h * (.075 * Math.sin(u * TAU + phase) + .035 * Math.sin(u * TAU * 2 - phase * .7));
            const gradient = c.createLinearGradient(0, y0 - height, 0, y0 + height * .45);
            gradient.addColorStop(0, '#0000');
            gradient.addColorStop(.48, ['#64d9b417', '#be91f323', '#8aa7fa20'][band]);
            gradient.addColorStop(.85, ['#7be6ca38', '#e7a3de34', '#8fb8ff31'][band]);
            gradient.addColorStop(1, '#0000');
            c.fillStyle = gradient;
            c.beginPath();
            c.moveTo(0, wave(0) - height);
            for (let k = 1; k <= 24; k++) {
                const u = k / 24;
                c.lineTo(u * w, wave(u) - height * (.82 + .12 * Math.sin(u * TAU + phase)));
            }
            for (let k = 24; k >= 0; k--) {
                const u = k / 24;
                c.lineTo(u * w, wave(u));
            }
            c.closePath();
            c.fill();
            if (quality() > 0) {
                c.globalAlpha = aw * .19;
                c.strokeStyle = tint;
                c.lineWidth = 5 + 3 * dynamics;
                c.beginPath();
                c.moveTo(0, wave(0) + 3);
                for (let k = 1; k <= 24; k++) {
                    const u = k / 24;
                    c.lineTo(w * u, wave(u) + 3);
                }
                c.stroke();
                c.globalAlpha = aw;
            }
            c.strokeStyle = ['#a3f5d865', '#f5b8e360', '#a5c7ff55'][band];
            c.lineWidth = 1.4 + treble * .65 + accent * .25;
            c.beginPath();
            c.moveTo(0, wave(0));
            for (let k = 1; k <= 32; k++) {
                const u = k / 32;
                c.lineTo(w * u, wave(u));
            }
            c.stroke();
            const rays = [12, 20, 30][quality()];
            c.strokeStyle = ['#a3f5d8', '#f5b8e3', '#a5c7ff'][band];
            c.lineWidth = .7;
            for (let k = 0; k < rays; k++) {
                const u = (k + .5) / rays, yy = wave(u);
                c.globalAlpha = aw * (.06 + (.08 + dynamics * .055) * (.5 + .5 * Math.sin(k * 2.1 + phase)));
                c.beginPath();
                c.moveTo(u * w, yy);
                c.quadraticCurveTo(u * w - 3, yy - height * .18, u * w - 8 - Math.sin(phase + k * .3) * 9, yy - height * (.45 + .25 * Math.sin(k + phase)));
                c.stroke();
            }
            c.globalAlpha = aw;
        }
    }
    if (sw > .001) {
        const phase = (t % 12) / 2.4;
        if (phase < 1) {
            const sx = w * (.1 + phase * .7), sy = h * (.14 + phase * .18);
            const tail = Math.min(w * .22, 170);
            const grad = c.createLinearGradient(sx - tail, sy - tail * .45, sx, sy);
            grad.addColorStop(0, 'rgba(255,210,230,0)');
            grad.addColorStop(1, 'rgba(255,236,244,.8)');
            c.globalAlpha = sw * Math.sin(phase * Math.PI);
            c.strokeStyle = grad;
            c.lineWidth = 1.35;
            c.beginPath();
            c.moveTo(sx - tail, sy - tail * .45);
            c.lineTo(sx, sy);
            c.stroke();
            c.globalAlpha = 1;
        }
    }
    const amount = Math.min(stars.length, particleCounts[quality()]);
    for (let i = 0; i < amount; i++) {
        const p = stars[i];
        p.z = (p.z + dt * p.speed) % 1;
        const depth = .42 + p.z * .78;
        const px = w * (.5 + p.x * depth * .54) + x * 28 * p.z;
        const py = h * (.5 + p.y * depth * .54) + y * 26 * p.z;
        const r = (.65 + p.z * 2.15) * (1 + treble * .22);
        const a = (.24 + p.z * .5) * (.65 + .35 * Math.sin(t * 2 + p.seed)) * Math.min(1, p.z * 12, (1 - p.z) * 12);
        c.globalAlpha = Math.min(1, a * (1 + energy * .35));
        if (rw > .001) {
            const yy = ((py + t * (150 + p.z * 250)) % (h + 80) + h + 80) % (h + 80) - 40;
            const xx = ((px - t * (18 + p.z * 22)) % (w + 40) + w + 40) % (w + 40) - 20;
            const len = (9 + p.z * 34) * (1 + bass * .38 + dynamics * .15);
            c.strokeStyle = i % 7 === 0 ? '#ffc9e3' : '#b9d6f5';
            c.lineWidth = .45 + p.z * 1.15;
            c.globalAlpha = rw * Math.min(1, a * (.8 + bass * .25));
            c.beginPath();
            c.moveTo(xx, yy);
            c.lineTo(xx - len * .17, yy + len);
            c.stroke();
            if (p.z > .68) {
                c.globalAlpha = rw * Math.min(1, a * (.8 + bass * .25));
                c.strokeStyle = '#f2e5ff';
                c.beginPath();
                c.moveTo(xx - len * .13, yy + len * .76);
                c.lineTo(xx - len * .17, yy + len);
                c.stroke();
            }
        }
        if (sw + aw > .001) {
            c.globalAlpha = (sw + aw) * Math.min(1, a * (1 + energy * .35));
            if (p.heart) {
                c.fillStyle = scene === 'aurora' ? '#bfeee0' : '#f7a9cf';
                c.save();
                c.translate(px, py);
                c.rotate(Math.sin(t + p.seed) * .4);
                c.beginPath();
                c.moveTo(0, r * 1.6);
                c.bezierCurveTo(-r * 4, -r, -r * 2, -r * 3, 0, -r);
                c.bezierCurveTo(r * 2, -r * 3, r * 4, -r, 0, r * 1.6);
                c.fill();
                c.restore();
            }
            else {
                c.fillStyle = scene === 'aurora' ? (i % 2 ? '#91e8d2' : '#c7a7ff') : (i % 3 ? '#ffd5e9' : '#e7ca91');
                c.beginPath();
                c.arc(px, py, r * .65, 0, TAU);
                c.fill();
                if (i % 11 === 0) {
                    c.globalAlpha = (sw + aw) * a * .48;
                    c.fillRect(px - r * 2, py - .35, r * 4, .7);
                    c.fillRect(px - .35, py - r * 2, .7, r * 4);
                }
            }
        }
    }
    if (rw > .001) {
        const count = [5, 8, 12][quality()], sample = snapshotWet(s);
        for (let i = 0; i < count; i++) {
            const seed = stars[i].seed, merge = Math.pow(.5 + .5 * Math.sin(t * .65 + seed), 5), radius = (3 + (i % 4) * 2.4) * Math.sqrt(1 + .5 * merge);
            const dx = w * (.035 + .93 * ((i * .61803398875) % 1)) + Math.sin(t * .22 + seed) * 4;
            const travel = t * (8 + i % 4 * 3) + Math.sin(t * .58 + seed) * 3;
            const dy = ((h * ((i * .381966) % 1) + travel) % (h + 2 * radius)) - radius;
            const stretch = 1 + .22 * merge + .07 * Math.sin(t * .58 + seed);
            if (sample && dx >= radius && dx <= w - radius && dy >= radius * 1.2 && dy <= h - radius * 1.2) {
                const sx = sample.width / w, sy = sample.height / h;
                c.save();
                c.beginPath();
                c.ellipse(dx, dy, radius * .82 / stretch, radius * stretch, 0, 0, TAU);
                c.clip();
                c.globalAlpha = rw * .72;
                c.drawImage(sample, (dx - radius * .45) * sx, (dy - radius * .55) * sy, radius * .9 * sx, radius * 1.1 * sy, dx - radius, dy - radius * 1.2, radius * 2, radius * 2.4);
                c.restore();
            }
            const lens = lensSprite();
            if (lens) {
                c.globalAlpha = rw * (.38 + dynamics * .16);
                c.drawImage(lens, dx - radius / stretch, dy - radius * 1.2 * stretch, radius * 2 / stretch, radius * 2.4 * stretch);
                if (i % 3 === 0 && merge < .95) {
                    const small = radius * .43 * Math.sqrt(1 - merge);
                    c.globalAlpha = rw * .4 * (1 - merge);
                    c.drawImage(lens, dx + radius * (1 - merge) - small, dy - radius * (1 - merge) - small, small * 2, small * 2.4);
                }
            }
            if (i % 3 === 0) {
                c.globalAlpha = rw * (.12 + dynamics * .08);
                c.strokeStyle = tint;
                c.lineWidth = .6;
                c.beginPath();
                c.moveTo(dx, dy - radius);
                c.quadraticCurveTo(dx - 2, dy - radius * 2.4, dx + 1, dy - radius * 4);
                c.stroke();
            }
        }
    }
    c.globalAlpha = 1;
    c.fillStyle = vignette;
    c.fillRect(0, 0, w, h);
    return true;
}
const mesh = [];
const rings = [[.52, -6.5], [.80, -5.2], [.96, -3.4], [1, 0], [.96, 3.4], [.80, 5.2], [.52, 6.5]].map(([scale, z]) => Array.from({ length: 44 }, (_, i) => {
    const a = Math.min(i, 44 - i) / 44 * TAU, side = i > 22 ? -1 : 1;
    return [16 * Math.pow(Math.sin(a), 3) * scale * side, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * scale - 2, z];
}));
function cut(points, shade) { const [a, b, c] = points, u = b.map((v, i) => v - a[i]), v = c.map((n, i) => n - a[i]); const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const len = Math.hypot(...n); if (len > 1e-8)
    mesh.push({ points, shade, normal: n.map(x => x / len) }); }
const front = [0, -1, 6.8], back = [0, -1, -6.8];
for (let i = 0; i < 44; i++) {
    const j = (i + 1) % 44;
    for (let k = 0; k < rings.length - 1; k++) {
        const a = rings[k][i], b = rings[k][j], c = rings[k + 1][j], d = rings[k + 1][i], shade = .70 + .07 * k;
        if (k === 1 || k === 4) {
            if (i < 22) {
                cut([a, b, c], shade);
                cut([a, c, d], shade);
            }
            else {
                cut([a, b, d], shade);
                cut([b, c, d], shade);
            }
        }
        else
            cut([a, b, c, d], shade);
    }
    cut([back, rings[0][j], rings[0][i]], .95);
    cut([front, rings[6][i], rings[6][j]], 1);
}
const envW = 48, envH = 24, envMap = new Float32Array(envW * envH);
for (let j = 0; j < envH; j++)
    for (let i = 0; i < envW; i++) {
        const az = i / envW * TAU, el = j / (envH - 1) * Math.PI - Math.PI / 2, x = Math.cos(el) * Math.cos(az), y = Math.sin(el), z = Math.cos(el) * Math.sin(az);
        envMap[j * envW + i] = clampC(.12 + .46 * Math.pow(Math.max(0, -.47 * x - .5 * y + .72 * z), 12) + .30 * Math.pow(Math.max(0, .7 * x - .18 * y + .69 * z), 22) + .22 * Math.exp(-Math.pow((y + .24) * 7, 2)) + .22 * Math.pow(Math.max(0, -z), 18), 0, 1);
    }
function sampleEnv(x, y, z) { const u = ((Math.atan2(z, x) / TAU + 1) % 1) * envW, v = (Math.asin(clampC(y, -1, 1)) / Math.PI + .5) * (envH - 1), i = Math.floor(u) % envW, j = Math.floor(v), f = u - Math.floor(u), g = v - j, k = Math.min(j + 1, envH - 1), a = envMap[j * envW + i], b = envMap[j * envW + (i + 1) % envW], d = envMap[k * envW + i], e = envMap[k * envW + (i + 1) % envW]; return (a + (b - a) * f) * (1 - g) + (d + (e - d) * f) * g; }
function renderHeart(s, t, px, py) {
    if (!s.resize())
        return false;
    const c = s.ctx, w = s.w, h = s.h;
    s.clear();
    const targetHue = musicHues[(0, music_visuals_1.visualMood)()] ?? 332;
    jewelHue += (((targetHue - jewelHue + 540) % 360) - 180) * .055;
    const envHue = jewelHue, musicLight = music_visuals_1.audioVisual.dynamics * .65 + music_visuals_1.audioVisual.score * .35;
    const yaw = Math.sin(t * .9) * .82 + px * .24, pitch = Math.sin(t * .72) * .22 + py * .20;
    const ca = Math.cos(yaw), sa = Math.sin(yaw), cb = Math.cos(pitch), sb = Math.sin(pitch);
    const scale = Math.min(w / 39, h / 37), cy = h * .5 + Math.sin(t * 1.3) * 5;
    const rotate = ([x, y, z]) => { const X = x * ca + z * sa, Z = -x * sa + z * ca; return [X, y * cb - Z * sb, y * sb + Z * cb]; };
    const project = ([x, y, z]) => { const k = 72 / (72 - z); return [w / 2 + x * k * scale, cy + y * k * scale]; };
    const glow = c.createRadialGradient(w / 2, cy, 0, w / 2, cy, Math.min(w, h) * .5);
    glow.addColorStop(0, 'rgba(238,100,167,.32)');
    glow.addColorStop(.42, 'rgba(202,116,194,.14)');
    glow.addColorStop(1, 'rgba(238,100,167,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(245,191,213,.30)';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(w / 2, cy, w * .43, h * .18, -.24, 0, TAU);
    c.stroke();
    c.globalAlpha = .22;
    c.strokeStyle = 'rgba(255,236,244,.28)';
    c.beginPath();
    c.ellipse(w / 2, cy + 2, w * .35, h * .145, -.24, 0, TAU);
    c.stroke();
    c.globalAlpha = 1;
    c.save();
    c.translate(w * .5 + Math.sin(yaw) * scale * 2, Math.min(h * .94, cy + scale * 14));
    c.scale(1, .25);
    c.globalCompositeOperation = 'screen';
    for (let k = 0; k < 5; k++) {
        const rr = Math.max(2, scale * (2.7 + k * .72)), cx = Math.sin(yaw * 1.8 + k * 1.1) * scale * 2.2, cy2 = Math.cos(pitch + k) * scale * .8, g = c.createRadialGradient(cx, cy2, rr * .30, cx, cy2, rr);
        g.addColorStop(0, '#0000');
        g.addColorStop(.65, `hsla(${envHue - 20 + k * 12},90%,70%,${(.045 + musicLight * .035) * (1 - k * .12)})`);
        g.addColorStop(1, '#0000');
        c.fillStyle = g;
        c.fillRect(cx - rr, cy2 - rr, rr * 2, rr * 2);
    }
    c.restore();
    const cache = new Map();
    const sample = (v) => { let data = cache.get(v); if (!data) {
        const p = rotate(v);
        data = { p, q: project(p) };
        cache.set(v, data);
    } return data; };
    const faces = mesh.map(f => { const vertices = f.points.map(sample), p = vertices.map(v => v.p); return { p, q: vertices.map(v => v.q), shade: f.shade, normal: rotate(f.normal), z: p.reduce((a, v) => a + v[2], 0) / p.length }; }).sort((a, b) => a.z - b.z);
    const highlights = [];
    for (const f of faces) {
        const [nx, ny, nz] = f.normal;
        const back = nz <= 0;
        if (back) {
            c.fillStyle = `hsl(${envHue - 6},46%,${13 + 12 * Math.abs(nz)}%)`;
            c.beginPath();
            f.q.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
            c.closePath();
            c.fill();
            continue;
        }
        const center = f.p.reduce((a, v) => [a[0] + v[0] / f.p.length, a[1] + v[1] / f.p.length, a[2] + v[2] / f.p.length], [0, 0, 0]);
        const viewLen = Math.hypot(center[0], center[1], 72 - center[2]);
        const vx = -center[0] / viewLen, vy = -center[1] / viewLen, vz = (72 - center[2]) / viewLen;
        const nv = clampC(nx * vx + ny * vy + nz * vz, 0, 1);
        const key = Math.max(0, -.38 * nx - .62 * ny + .685 * nz), fill = Math.max(0, .72 * nx - .12 * ny + .683 * nz), rim = Math.pow(1 - nv, 2.6);
        const spec = Math.pow(Math.max(0, -.21 * nx - .34 * ny + .916 * nz), 48);
        const fresnel = .04 + .96 * Math.pow(1 - nv, 5);
        const bounce = Math.max(0, .42 * nx + .78 * ny + .46 * nz);
        const light = clampC((.13 + .58 * key + .12 * fill + .10 * bounce + .19 * fresnel + .34 * spec) * f.shade, 0, 1);
        const reflectedX = 2 * nv * nx - vx, reflectedY = 2 * nv * ny - vy;
        const softbox = Math.pow(Math.max(0, 1 - Math.abs(reflectedX + .43) * 2.4 - Math.abs(reflectedY + .35) * 1.5), 2);
        const internal = Math.pow(Math.max(0, .5 + .5 * Math.sin(reflectedX * 8.2 + reflectedY * 5.5 + nz * 4)), 5) * (.18 + .82 * rim);
        const prism = Math.sin(reflectedX * 5.4 + reflectedY * 3.8 + nz * 2.2) * rim;
        const transmit = (ior) => { const eta = 1 / ior, k = Math.sqrt(Math.max(0, 1 - eta * eta * (1 - nv * nv))), d = eta * nv - k; const tx = -eta * vx + d * nx, ty = -eta * vy + d * ny; return Math.pow(Math.max(0, 1 - Math.abs(tx + .18) * 2.1 - Math.abs(ty - .23) * 1.65), 2); };
        const tr = transmit(1.51), tg = transmit(1.54), tb = transmit(1.57), transmission = (1 - fresnel) * (.32 * tr + .36 * tg + .32 * tb);
        const bounce2 = Math.pow(Math.max(0, 1 - Math.abs(reflectedX * .81 - reflectedY * .58 - .11) * 3.2), 6) * transmission;
        const bounce3 = bounce2 * rim * .42;
        const focus = Math.max(0, 1 - Math.abs(reflectedX * .57 + reflectedY * .82 - .16) * 4.2);
        const caustic = Math.pow(Math.max(0, 1 - Math.abs(tr - tb) * 4), 3) * transmission * softbox * (.65 + .35 * focus * focus);
        const reflectedZ = 2 * nv * nz - vz;
        const mapLight = sampleEnv(reflectedX, reflectedY, reflectedZ);
        const spectrumSplit = clampC((tb - tr) * 8, -1, 1);
        const envReflection = Math.pow(Math.max(0, .55 + .45 * reflectedZ), 3) * (.22 + .78 * fresnel);
        const envStrip = Math.pow(Math.max(0, 1 - Math.abs(reflectedY + .23) * 3.5), 4) * (.35 + .65 * Math.max(0, reflectedZ));
        const hue = envHue - 12 + light * 24 + rim * 10 + prism * 18 + (tb - tr) * 42, L = clampC(9 + light * 71 + softbox * 17 + internal * 12 + transmission * 23 + bounce2 * 6 + bounce3 * 7 + caustic * 12 + envReflection * (4 + musicLight * 9) + envStrip * (3 + musicLight * 5) + mapLight * (9 + musicLight * 8), 8, 97), sat = 40 + light * 30;
        const energy = Math.max(0, (L - 72) / 25) * Math.max(spec, softbox, caustic);
        if (energy > .13) {
            const q = project(center);
            highlights.push({ x: q[0], y: q[1], energy, hue });
        }
        c.globalAlpha = .88 + .12 * clampC(fresnel + softbox, 0, 1);
        c.fillStyle = `hsl(${hue},${sat}%,${L}%)`;
        if ((spec > .12 || fresnel > .20 || softbox > .22) && w > 190) {
            const q = f.q, top = q.reduce((a, b) => a[1] < b[1] ? a : b), bottom = q.reduce((a, b) => a[1] > b[1] ? a : b);
            if (bottom[1] - top[1] > 4) {
                const g = c.createLinearGradient(top[0], top[1], bottom[0], bottom[1]);
                g.addColorStop(0, `hsl(${hue + 9},${sat}%,${Math.min(96, L + 14)}%)`);
                g.addColorStop(.35, `hsl(${hue + spectrumSplit * 16},${Math.min(90, sat + Math.abs(spectrumSplit) * 15)}%,${L}%)`);
                g.addColorStop(1, `hsl(${hue - 10 - spectrumSplit * 12},${sat}%,${Math.max(13, L - 12)}%)`);
                c.fillStyle = g;
            }
        }
        c.strokeStyle = `rgba(255,229,242,${.045 + fresnel * .25 + spec * .36})`;
        c.lineWidth = .55;
        c.beginPath();
        f.q.forEach(([x, y], i) => { if (i)
            c.lineTo(x, y);
        else
            c.moveTo(x, y); });
        c.closePath();
        c.fill();
        c.globalAlpha = 1;
        c.stroke();
    }
    highlights.sort((a, b) => b.energy - a.energy);
    c.save();
    c.globalCompositeOperation = 'screen';
    for (const spot of highlights.slice(0, [3, 5, 7][quality()])) {
        const r = Math.max(3, scale * 1.5), g = c.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, r);
        g.addColorStop(0, `hsla(${spot.hue} 80% 88% / ${Math.min(.27, spot.energy * .34)})`);
        g.addColorStop(.3, `hsla(${spot.hue} 80% 75% / .07)`);
        g.addColorStop(1, '#0000');
        c.fillStyle = g;
        c.fillRect(spot.x - r, spot.y - r, r * 2, r * 2);
    }
    c.restore();
    for (let i = 0; i < 3; i++) {
        const a = t * .8 + i * TAU / 3, xx = w / 2 + Math.cos(a) * scale * 8, yy = cy + Math.sin(a) * scale * 8, rr = Math.max(3, scale * .75), strength = .10 + .09 * Math.sin(t * 1.7 + i);
        const g = c.createRadialGradient(xx, yy, 0, xx, yy, rr);
        g.addColorStop(0, `rgba(255,222,245,${strength})`);
        g.addColorStop(1, '#ffb6e800');
        c.fillStyle = g;
        c.fillRect(xx - rr, yy - rr, rr * 2, rr * 2);
    }
    for (let i = 0; i < 3; i++) {
        const a = t * (.65 + i * .12) + i * TAU / 3;
        const x = w / 2 + Math.cos(a) * w * .43, y = cy + Math.sin(a) * h * .18 - Math.cos(a) * w * .1;
        c.fillStyle = i === 0 ? '#fff5dd' : '#f8b9d9';
        c.beginPath();
        c.arc(x, y, 2.1, 0, TAU);
        c.fill();
    }
    c.globalAlpha = .25;
    for (let i = 0; i < 7; i++) {
        const a = t * .55 + i * TAU / 7, rx = w * .25 + Math.sin(i * 3.2 + t) * w * .03, ry = h * .10 + Math.cos(i * 1.7 + t) * h * .02;
        c.fillStyle = i % 2 ? '#f4c4dc' : '#ffe9f1';
        c.beginPath();
        c.arc(w / 2 + Math.cos(a) * rx, cy + Math.sin(a) * ry, 1.2 + (i % 3) * .35, 0, TAU);
        c.fill();
    }
    c.globalAlpha = 1;
    return true;
}
function initCinema() {
    const main = new Surface(document.querySelector('#fx'));
    const gate = document.querySelector('#gate');
    const gateCanvas = document.createElement('canvas');
    gateCanvas.className = 'cinema-gate-field';
    gateCanvas.setAttribute('aria-hidden', 'true');
    gate.prepend(gateCanvas);
    const intro = new Surface(gateCanvas);
    const pre = document.querySelector('#pre');
    const preField = pre?.querySelector('.pre-field');
    const preJewel = pre?.querySelector('.pre-jewel');
    let bootField = preField ? new Surface(preField) : null;
    let bootJewel = preJewel ? new Surface(preJewel) : null;
    let gateReleased = false;
    const stage = document.querySelector('.exp-heart-stage');
    const sculpture = document.createElement('canvas');
    sculpture.className = 'cinema-heart';
    sculpture.setAttribute('aria-hidden', 'true');
    stage.append(sculpture);
    const heart = new Surface(sculpture);
    let visible = false, last = 0, elapsed = 0, frame = 0, x = 0, y = 0, tx = 0, ty = 0;
    const tilt = document.querySelector('#tilt');
    const obs = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible)
        wake(); }) : null;
    if (obs)
        obs.observe(stage);
    else
        visible = true;
    function updatePointer(e) {
        if (!e.isPrimary)
            return;
        tx = clampC(e.clientX / Math.max(innerWidth, 1) * 2 - 1, -1, 1);
        ty = clampC(e.clientY / Math.max(innerHeight, 1) * 2 - 1, -1, 1);
    }
    window.addEventListener('pointerdown', updatePointer, { passive: true });
    window.addEventListener('pointermove', updatePointer, { passive: true });
    window.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') {
        tx = 0;
        ty = 0;
    } }, { passive: true });
    window.addEventListener('pointercancel', () => { tx = 0; ty = 0; }, { passive: true });
    const failures = new WeakSet();
    function paint(surface, render, owner, ready) {
        try {
            const ok = render();
            if (owner && ready)
                owner.classList.toggle(ready, ok);
            if (ok) {
                failures.delete(surface);
                surface.canvas.dataset.frameTime = elapsed.toFixed(3);
            }
        }
        catch (error) {
            if (owner && ready)
                owner.classList.remove(ready);
            if (!failures.has(surface)) {
                failures.add(surface);
                console.warn('[cinema] recuperação da superfície', error);
            }
        }
    }
    const active = () => !document.hidden && !document.body.classList.contains('exp-modal-open') && !root.classList.contains('salon-open');
    let costTotal = 0, costCount = 0;
    let lastCallback = 0, backup = 0, watchdog = 0, probe = 0;
    function schedule() { if (!frame && !backup && active() && !motionOff())
        frame = requestAnimationFrame(draw); }
    function draw(now) {
        frame = 0;
        lastCallback = performance.now();
        const costStart = lastCallback;
        if (!active()) {
            last = 0;
            return;
        }
        const still = motionOff();
        const delta = still ? 0 : last ? Math.min(Math.max(0, (now - last) / 1000), .1) : 1 / 60;
        if (!still && last && quality() === 0 && now - last < 30) {
            schedule();
            return;
        }
        last = now;
        elapsed += delta;
        x += (tx - x) * Math.min(1, delta * 6);
        y += (ty - y) * Math.min(1, delta * 6);
        const t = still ? 0 : elapsed;
        const opening = !gate.hidden && !gate.classList.contains('gone');
        try {
            if (pre?.isConnected && !pre.classList.contains('open')) {
                if (bootField)
                    paint(bootField, () => drawAtmosphere(bootField, t, delta, x, y, true));
                if (bootJewel)
                    paint(bootJewel, () => renderHeart(bootJewel, t + .65, x, y), pre, 'pre-rendered');
            }
            else if (opening) {
                paint(intro, () => drawAtmosphere(intro, t, delta, x, y, true));
                if (!still && !gate.classList.contains('opening')) {
                    const rx = x * .65 + Math.sin(t * .95) * .32, ry = y * .65 + Math.cos(t * .75) * .25;
                    tilt.style.setProperty('--ry', String(rx));
                    tilt.style.setProperty('--rx', String(ry));
                    gate.style.setProperty('--px', String(rx));
                    gate.style.setProperty('--py', String(ry));
                }
            }
            else if (root.dataset.read !== 'on')
                paint(main, () => drawAtmosphere(main, t, delta, x, y, false));
            else
                main.clear();
            if (gate.hidden && !gateReleased) {
                intro.release();
                gateReleased = true;
            }
            if (!pre?.isConnected && (bootField || bootJewel)) {
                for (const surface of [bootField, bootJewel])
                    surface?.release();
                bootField = null;
                bootJewel = null;
            }
            if (visible)
                paint(heart, () => renderHeart(heart, t, x, y), stage, 'cinema-mesh-ready');
        }
        finally {
            if (!still && !opening) {
                costTotal += performance.now() - costStart;
                costCount++;
                if (costCount >= 90) {
                    document.dispatchEvent(new CustomEvent('noa-render-budget', { detail: costTotal / costCount }));
                    costTotal = 0;
                    costCount = 0;
                }
            }
            schedule();
        }
    }
    function suspend() { cancelAnimationFrame(frame); frame = 0; clearInterval(backup); backup = 0; clearInterval(watchdog); watchdog = 0; cancelAnimationFrame(probe); probe = 0; last = 0; }
    function wake() {
        if (!active()) {
            suspend();
            return;
        }
        if (motionOff()) {
            suspend();
            draw(performance.now());
            return;
        }
        if (!watchdog) {
            lastCallback = performance.now();
            watchdog = window.setInterval(() => {
                if (!active() || motionOff()) {
                    suspend();
                    return;
                }
                if (performance.now() - lastCallback > 650) {
                    cancelAnimationFrame(frame);
                    frame = 0;
                    if (!backup)
                        backup = window.setInterval(() => { if (active() && !motionOff())
                            draw(performance.now()); }, 34);
                    cancelAnimationFrame(probe);
                    probe = requestAnimationFrame(now => { probe = 0; if (!active() || motionOff())
                        return; clearInterval(backup); backup = 0; draw(now); });
                }
                else if (backup) {
                    cancelAnimationFrame(probe);
                    probe = requestAnimationFrame(now => { probe = 0; if (!active() || motionOff())
                        return; clearInterval(backup); backup = 0; draw(now); });
                }
            }, 700);
        }
        schedule();
    }
    document.addEventListener('visibilitychange', wake);
    new MutationObserver(wake).observe(root, { attributes: true, attributeFilter: ['data-motion', 'data-q', 'data-noa-scene', 'data-read', 'data-salon-palette', 'class'] });
    new MutationObserver(wake).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', wake, { passive: true });
    window.addEventListener('pageshow', wake);
    window.addEventListener('focus', wake);
    wake();
}

},
"./memory-film":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initMemoryFilm = initMemoryFilm;
function initMemoryFilm(gallery) {
    const root = document.querySelector('#memory-film');
    if (!root || !gallery.length)
        return;
    const all = [...gallery.filter(g => g.kind === 'desenhos').slice(0, 5), ...gallery.filter(g => g.kind !== 'desenhos').slice(0, 5)];
    const stage = root.querySelector('.film-stage');
    const layers = [...root.querySelectorAll('.film-art')];
    const caption = root.querySelector('.film-description');
    const counter = root.querySelector('.film-counter');
    const dots = root.querySelector('.film-dots');
    const meter = root.querySelector('.film-meter i');
    const play = root.querySelector('[data-film=play]');
    const reduced = () => document.documentElement.dataset.motion === 'reduced';
    let index = 0, active = 0, elapsed = 0, last = 0, raf = 0, visible = false, playing = true, started = false;
    let pointer = null;
    const duration = 6000;
    const fmt = (n) => String(n).padStart(2, '0');
    const buttons = all.map((item, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-label', `Imagem ${i + 1}: ${item.alt || item.cap || 'Memória'}`);
        button.addEventListener('click', () => show(i, true));
        dots.append(button);
        return button;
    });
    function show(i, manual = false) {
        index = (i + all.length) % all.length;
        elapsed = 0;
        last = 0;
        if (started) {
            layers[active].classList.remove('is-active');
            active = 1 - active;
        }
        started = true;
        const item = all[index], layer = layers[active];
        layer.replaceChildren();
        const img = document.createElement('img');
        img.alt = item.alt || item.cap || 'Imagem da galeria';
        img.decoding = 'async';
        img.draggable = false;
        img.src = item.thumbFallback || item.thumb || item.src;
        img.onerror = () => { if (img.src !== new URL(item.src, location.href).href)
            img.src = item.src; };
        layer.append(img);
        layer.classList.add('is-active');
        caption.textContent = item.cap || item.alt || 'Um detalhe especial';
        caption.setAttribute('aria-live', manual ? 'polite' : 'off');
        counter.textContent = `${fmt(index + 1)} / ${fmt(all.length)}`;
        layers.forEach((l, k) => l.setAttribute('aria-hidden', String(k !== active)));
        buttons.forEach((b, k) => b.setAttribute('aria-current', String(k === index)));
        meter.style.transform = 'scaleX(0)';
    }
    function sync() {
        const running = playing && !reduced();
        const unobscured = !document.body.classList.contains('exp-modal-open');
        root.dataset.playing = String(running && visible && !document.hidden && unobscured);
        play.textContent = running ? 'Ⅱ Pausar' : '▶ Reproduzir';
        play.setAttribute('aria-pressed', String(running));
        play.setAttribute('aria-label', running ? 'Pausar filme' : 'Reproduzir filme');
        play.disabled = reduced();
        play.title = reduced() ? 'Movimento reduzido está ativo nas preferências.' : '';
        if (running && visible && !document.hidden && unobscured) {
            if (!raf) {
                last = 0;
                raf = requestAnimationFrame(tick);
            }
        }
        else {
            cancelAnimationFrame(raf);
            raf = 0;
            last = 0;
        }
    }
    function tick(now) {
        raf = 0;
        if (!playing || reduced() || !visible || document.hidden || document.body.classList.contains('exp-modal-open'))
            return;
        if (last)
            elapsed += Math.min(now - last, 100);
        last = now;
        if (elapsed >= duration)
            show(index + 1);
        meter.style.transform = `scaleX(${elapsed / duration})`;
        raf = requestAnimationFrame(tick);
    }
    play.addEventListener('click', () => { playing = !playing; sync(); });
    root.querySelector('[data-film=prev]').addEventListener('click', () => show(index - 1, true));
    root.querySelector('[data-film=next]').addEventListener('click', () => show(index + 1, true));
    stage.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        show(index + (e.key === 'ArrowRight' ? 1 : -1), true);
    } });
    stage.addEventListener('pointerdown', e => { if (e.isPrimary)
        pointer = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
    stage.addEventListener('pointerup', e => { if (pointer?.id === e.pointerId) {
        const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3)
            show(index + (dx < 0 ? 1 : -1), true);
        pointer = null;
    } });
    stage.addEventListener('pointercancel', () => { pointer = null; });
    root.hidden = false;
    show(0);
    sync();
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: .2 }).observe(stage);
    }
    else {
        visible = true;
        sync();
    }
    document.addEventListener('visibilitychange', sync);
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

},
"./stellar":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StellarRenderer = void 0;
const music_visuals_1 = require("./music-visuals");
const vertex = `attribute vec2 a; void main(){gl_Position=vec4(a,0.,1.);}`;
const fragment = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 res, tilt; uniform float time, kind, planet, pulse, quality; uniform vec3 musicTint; uniform float musicLight;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+19.19);return fract((p.x+p.y)*p.z);}
float fieldNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return .55*fieldNoise(p)+.28*fieldNoise(p*2.03)+.12*fieldNoise(p*4.17)+.05*fieldNoise(p*8.31);}
mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
vec3 palette(float p){if(p<.5)return vec3(.92,.27,.49);if(p<1.5)return vec3(.14,.53,.96);if(p<2.5)return vec3(.54,.29,.95);return vec3(.97,.59,.18);}
// Approximate microfacet BRDF (GGX distribution, Schlick Fresnel, Smith visibility).
vec3 microfacet(vec3 N,vec3 L,vec3 V,vec3 albedo,float rough,float metal){vec3 H=normalize(L+V);float nl=max(dot(N,L),0.),nv=max(dot(N,V),.001),nh=max(dot(N,H),0.),vh=max(dot(V,H),0.);float a=rough*rough,a2=a*a;float den=nh*nh*(a2-1.)+1.;float D=a2/(3.14159*den*den);float k=(rough+1.)*(rough+1.)/8.;float G=nl/(nl*(1.-k)+k)*nv/(nv*(1.-k)+k);vec3 F0=mix(vec3(.04),albedo,metal);vec3 F=F0+(1.-F0)*pow(1.-vh,5.);vec3 spec=D*G*F/max(4.*nl*nv,.001);return ((1.-F)*(1.-metal)*albedo/3.14159+spec)*nl;}
vec3 filmic(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec2 uv=(gl_FragCoord.xy-.5*res)/min(res.x,res.y);vec2 p=uv-tilt*.045;float t=time;vec3 tint=palette(planet);vec3 color=vec3(.008,.004,.020);float n=fbm(vec3(p*2.6,t*.045));float cloud=fbm(vec3(p*5.+n*2.,t*.025));color+=vec3(.16,.037,.22)*pow(n,2.)*.95+vec3(.025,.045,.11)*cloud*.32;vec2 grid=floor((p+vec2(t*.001,0.))*160.);float star=hash(vec3(grid,1.));vec2 cell=fract((p+vec2(t*.001,0.))*160.)-.5;float spark=step(.994,star)*exp(-dot(cell,cell)*26.)*(.65+.35*sin(t*2.+star*300.));color+=spark*vec3(1.,.81,.88);
if(kind<.5){
 vec3 sunlight=normalize(planet<.5?vec3(-.62,.58,.53):planet<1.5?vec3(-.46,.76,.46):planet<2.5?vec3(.56,.58,.59):vec3(-.78,.32,.54));
 p-=vec2(sin(t*.58)*.052,cos(t*.73)*.024);vec3 plane=normalize(vec3(-.16+.22*sin(t*.62),.86,.48+.12*sin(t*.46+.7)));vec3 ro=vec3(0.,0.,3.75),rd=normalize(vec3(p*2.7,-3.));float b=dot(ro,rd),d=b*b-dot(ro,ro)+1.;float nearest=100.;
 if(d>0.){nearest=-b-sqrt(d);vec3 pos=ro+rd*nearest;vec3 normal=normalize(pos),q=normal;q.xz=rot(mod(t*.53,6.2831853))*q.xz;float f=fbm(q*4.6),detail=fbm(q*15.+f*3.);float bands=.5+.5*sin(q.y*21.+f*6.+detail*1.5);float land=smoothstep(.36,.7,f*.65+detail*.35);if(planet>.5&&planet<1.5){land=smoothstep(.48,.57,f);bands*=.22;}else if(planet>1.5&&planet<2.5){land=pow(1.-abs(2.*detail-1.),2.);bands*=.18;}else if(planet>2.5){land=.5+.5*sin(q.y*25.+f*5.);bands=land;}float ridge=pow(1.-abs(2.*detail-1.),3.);float polar=smoothstep(.69,.97,abs(q.y)+.06*f);vec3 albedo=mix(tint*.16,tint*1.13,land*.74+bands*.17+ridge*.09);if(planet>.5&&planet<1.5)albedo=mix(tint*.22,mix(tint,vec3(.24,.78,.69),.34),land);else if(planet>1.5&&planet<2.5)albedo=mix(tint*.13,tint*1.26,land);else if(planet>2.5)albedo=mix(tint*.28,vec3(1.,.76,.40),land);albedo=mix(albedo,vec3(.80,.72,.85),polar*(planet>2.5?.08:.34));vec3 light=sunlight;float diffuse=max(dot(normal,light),0.);float fresnel=pow(1.-max(dot(normal,-rd),0.),3.);vec3 planeN=plane;float ld=dot(light,planeN);float shadow=1.;if(abs(ld)>.001){float sr=-dot(pos,planeN)/ld;float rr=length(pos+light*sr);if(sr>.001)shadow=1.-.50*smoothstep(1.18,1.29,rr)*(1.-smoothstep(1.70,1.81,rr));}vec3 shadingN=normal;if(quality>.55){vec3 tex=q*19.;float bump=fieldNoise(tex);vec3 grad=vec3(fieldNoise(tex+vec3(.18,0.,0.))-bump,fieldNoise(tex+vec3(0.,.18,0.))-bump,fieldNoise(tex+vec3(0.,0.,.18))-bump);grad-=q*dot(grad,q);grad.xz=rot(-mod(t*.53,6.2831853))*grad.xz;shadingN=normalize(normal-grad*(planet>1.5&&planet<2.5?1.05:.66));}vec3 cloudPoint=normalize(normal+light*.065);cloudPoint.xz=rot(mod(t*.69,6.2831853))*cloudPoint.xz;float cloudShadow=smoothstep(.50,.76,fbm(cloudPoint*9.+vec3(4.1,0.,0.)));shadow*=1.-cloudShadow*(planet>1.5&&planet<2.5?.09:.27)*diffuse;float rough=planet<.5?.42+land*.22:planet<1.5?mix(.19,.70,land):planet<2.5?.30+land*.26:.78;float metal=planet>1.5&&planet<2.5?.19:.025;vec3 lit=microfacet(shadingN,light,-rd,albedo,rough,metal);vec3 hemi=mix(vec3(.035,.021,.048),vec3(.10,.075,.13),normal.y*.5+.5);color=albedo*hemi+lit*3.25*shadow+tint*fresnel*(.06+diffuse*.37)+albedo*.045*max(0.,dot(normal,normalize(vec3(.74,-.4,.2))));}
 // A second spherical shell rotates independently and has its own terminator.
 float shellR=1.025,cs=b*b-dot(ro,ro)+shellR*shellR;vec3 sun=sunlight;
 if(cs>0.){float ct=-b-sqrt(cs);if(ct>0.&&ct<nearest){vec3 cp=normalize(ro+rd*ct),cq=cp;cq.xz=rot(mod(t*.69,6.2831853))*cq.xz;float cover=smoothstep(.50,.76,fbm(cq*9.+vec3(4.1,0.,0.)));float light=max(0.,dot(cp,sun));float cloudRim=pow(1.-max(0.,dot(cp,-rd)),3.);float fade=smoothstep(0.,.26,dot(cp,-rd));color=mix(color,vec3(.85,.70,.86)*(.12+light*.82),cover*(.39+.11*cloudRim)*fade*(planet>1.5&&planet<2.5?.35:1.));}}
 // Analytic atmosphere, short optical-depth quadrature. Surface and sky share the same light vector.
 float atmosphere=1.105,ad=b*b-dot(ro,ro)+atmosphere*atmosphere;
 if(ad>0.){float lo=max(0.,-b-sqrt(ad)),hi=min(nearest,-b+sqrt(ad));float span=max(0.,hi-lo);vec3 air=vec3(0.);float optical=0.;
 float steps=quality>.55?4.:2.;for(int j=0;j<4;j++){if(float(j)>=steps)break;float f=(float(j)+.5)/steps;vec3 ap=ro+rd*(lo+span*f);float ht=clamp((length(ap)-1.)/(atmosphere-1.),0.,1.);float density=exp(-ht*4.5);vec3 an=normalize(ap);float solar=smoothstep(-.23,.2,dot(an,sun));float mu=clamp(dot(-rd,sun),-1.,1.);float rayleigh=.75*(1.+mu*mu);float mie=.22/pow(max(.22,1.34-1.16*mu),1.5);float forward=.42*rayleigh+.34*mie;float weight=density*span/steps;optical+=weight;air+=mix(vec3(.42,.37,.84),tint*.55+vec3(.28,.14,.06),solar)*weight*solar*forward;}
 color=color*exp(-optical*.55)+air*1.6+musicTint*optical*musicLight*.28;}
 float rim=length(p);color+=tint*.10*exp(-pow(abs(rim-.307)*23.,2.))*(d<0.?1.:.14);
 float den=dot(rd,plane);if(abs(den)>.001){float tr=-dot(ro,plane)/den;vec3 hit=ro+rd*tr;float r=length(hit);if(tr>0.&&tr<nearest&&r>1.20&&r<1.79){float detailFade=smoothstep(160.,380.,min(res.x,res.y));float grain=fieldNoise(hit*12.);float wave=.5+.5*sin(r*145.+grain*1.7);float ring=mix(.48+.24*sin(r*39.),.26+.74*wave*wave,detailFade);ring*=1.-.88*exp(-pow((r-1.44)*67.,2.));ring*=1.-.55*exp(-pow((r-1.64)*90.,2.));float footprint=clamp(3.5/min(res.x,res.y),.004,.045);float edge=smoothstep(1.20-footprint,1.26+footprint,r)*(1.-smoothstep(1.72-footprint,1.79+footprint,r));vec3 L=sunlight;float oc=dot(hit,L),disc=oc*oc-dot(hit,hit)+1.;float ringShadow=oc<0.&&disc>0.?.24:1.;color=mix(color,mix(tint,vec3(1.,.83,.65),.63)*ring*ringShadow*.84,edge*.64);nearest=tr;}}
 // Three independently orbiting spherical satellites; nearest ray hit wins.
 for(int i=0;i<3;i++){float j=float(i),a=t*(.66+j*.12)+j*2.0944;vec3 center=vec3(cos(a)*(1.48+j*.12),sin(a)*.38,sin(a)*1.32);float radius=.067+j*.027;vec3 mr=ro-center;float mb=dot(mr,rd),md=mb*mb-dot(mr,mr)+radius*radius;if(md>0.){float mt=-mb-sqrt(md);if(mt>0.&&mt<nearest){vec3 normal=normalize(mr+rd*mt);float light=max(dot(normal,sunlight),0.);vec3 mc=mix(vec3(.73,.57,.87),vec3(.96,.77,.45),j*.5);color=mc*(.13+light*.95);nearest=mt;}}}
}else if(kind<1.5){vec2 q=rot(.09*sin(t*.35))*p;q.y*=1.+.12*sin(t*.43);float r=length(q);float a=atan(q.y,q.x);for(int i=0;i<5;i++){float k=float(i);float rr=.16+k*.073+.009*sin(t*1.8+a*8.+k);float width=max(1./120.,1.35/min(res.x,res.y));float line=exp(-abs(r-rr)/width);float halo=exp(-abs(r-rr)*25.);float bloom=exp(-abs(r-rr)*9.)*.025;float run=.45+.55*pow(.5+.5*sin(a*5.-t*1.8+k*1.2),5.);color+=(vec3(.75,.29,.59)+vec3(.3,.35,.21)*run)*(line*.65+halo*.09+bloom)*run;}color+=vec3(.32,.1,.35)*exp(-r*7.)*(1.+pulse);float iris=.5+.5*sin(a*12.+r*32.-t*2.1);color+=vec3(.23,.11,.32)*pow(iris,4.)*exp(-pow((r-.22)*8.,2.));}
else{for(int i=0;i<4;i++){float k=float(i);float ridge=.08+.13*k+.11*sin(p.x*4.5+t*.22+k)+.055*sin(p.x*11.-t*.14+k*2.);float dist=abs(p.y-ridge);float ribbon=exp(-dist*17.)+.24*exp(-dist*5.);float glow=exp(-dist*3.)*.035;float ray=.65+.35*sin(p.x*42.+sin(p.x*8.+t)*3.+k);vec3 c=mix(vec3(.12,.64,.51),vec3(.68,.25,.85),k/3.);color+=c*(ribbon+glow)*ray*.48+vec3(.25,.15,.32)*exp(-dist*36.)*ray*.14;}}
if(kind>.5&&quality>.82){float trans=1.;vec3 lightFog=vec3(0.);for(int j=0;j<6;j++){float z=float(j)*.34;vec3 q=vec3(p*2.8+tilt*.028*z,z+t*.025);float density=smoothstep(.43,.79,fieldNoise(q*2.8+fieldNoise(q)*.65))*exp(-abs(p.y)*1.8);float opacity=1.-exp(-density*.14);lightFog+=trans*opacity*mix(vec3(.22,.13,.38),musicTint,.42);trans*=1.-opacity;}color=color*mix(1.,trans,.16)+lightFog*(.35+.12*musicLight);}
float vignette=1.-.32*smoothstep(.25,.9,length(uv));color*=vignette;float lum=dot(max(color,0.),vec3(.2126,.7152,.0722));float shoulder=smoothstep(.35,1.2,lum);color+=color*shoulder*.09;float exposure=(kind<.5?1.12:1.18)+musicLight*.055;color=filmic(max(color,0.)*exposure);gl_FragColor=vec4(pow(color,vec3(1./2.2)),1.);}`;
const postVertex = `attribute vec2 a; varying vec2 uv; void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}`;
const postBlur = `precision mediump float; varying vec2 uv; uniform sampler2D image; uniform vec2 pixel; uniform float threshold;
vec3 sampleLight(vec2 p){vec3 c=texture2D(image,p).rgb;float l=dot(c,vec3(.2126,.7152,.0722));return c*mix(1.,smoothstep(.58,.88,l),threshold);}
void main(){vec3 c=sampleLight(uv)*.28; c+=(sampleLight(uv+pixel*vec2(1.,1.))+sampleLight(uv+pixel*vec2(-1.,1.))+sampleLight(uv+pixel*vec2(1.,-1.))+sampleLight(uv-pixel))*.18;gl_FragColor=vec4(c,1.);}`;
const postComposite = `precision mediump float; varying vec2 uv; uniform sampler2D image,glow,wide; uniform float intensity;void main(){vec3 c=texture2D(image,uv).rgb;vec3 b=texture2D(glow,uv).rgb*.16+texture2D(wide,uv).rgb*.11;gl_FragColor=vec4(clamp(c+b*intensity*(1.-c*.38),0.,1.),1.);}`;
class OpticalPost {
    constructor(g) {
        this.g = g;
        this.blur = null;
        this.composite = null;
        this.targets = [];
        this.locations = new Map();
        try {
            this.blur = this.link(postBlur);
            this.composite = this.link(postComposite);
        }
        catch (e) {
            this.dispose();
            throw e;
        }
    }
    link(source) { const g = this.g; const shaders = []; let p = null; try {
        for (const [type, code] of [[g.VERTEX_SHADER, postVertex], [g.FRAGMENT_SHADER, source]]) {
            const s = g.createShader(type);
            if (!s)
                throw Error('post shader');
            shaders.push(s);
            g.shaderSource(s, code);
            g.compileShader(s);
            if (!g.getShaderParameter(s, g.COMPILE_STATUS))
                throw Error('post compile');
        }
        p = g.createProgram();
        if (!p)
            throw Error('post program');
        for (const s of shaders)
            g.attachShader(p, s);
        g.bindAttribLocation(p, 0, 'a');
        g.linkProgram(p);
        if (!g.getProgramParameter(p, g.LINK_STATUS))
            throw Error('post link');
        return p;
    }
    catch (e) {
        if (p)
            g.deleteProgram(p);
        throw e;
    }
    finally {
        for (const s of shaders)
            g.deleteShader(s);
    } }
    uniform(p, key) { let m = this.locations.get(p); if (!m) {
        m = new Map();
        this.locations.set(p, m);
    } if (!m.has(key))
        m.set(key, this.g.getUniformLocation(p, key)); return m.get(key) ?? null; }
    clearTargets() { for (const t of this.targets) {
        this.g.deleteFramebuffer(t.fb);
        this.g.deleteTexture(t.tex);
    } this.targets = []; }
    target(w, h) { const g = this.g, tex = g.createTexture(), fb = g.createFramebuffer(); if (!tex || !fb) {
        if (tex)
            g.deleteTexture(tex);
        if (fb)
            g.deleteFramebuffer(fb);
        throw Error('post allocation');
    } const t = { tex, fb, w, h }; this.targets.push(t); g.bindTexture(g.TEXTURE_2D, tex); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE); g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null); g.bindFramebuffer(g.FRAMEBUFFER, fb); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0); if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE)
        throw Error('post framebuffer'); return t; }
    begin(w, h) { const g = this.g; if (this.targets[0]?.w !== w || this.targets[0]?.h !== h) {
        this.clearTargets();
        this.target(w, h);
        this.target(Math.max(1, w >> 2), Math.max(1, h >> 2));
        this.target(Math.max(1, w >> 3), Math.max(1, h >> 3));
    } g.bindFramebuffer(g.FRAMEBUFFER, this.targets[0].fb); g.viewport(0, 0, w, h); }
    finish(w, h) { const g = this.g, b = this.blur, p = this.composite, [scene, small, wide] = this.targets; g.useProgram(b); for (const [input, out, threshold] of [[scene, small, 1], [small, wide, 0]]) {
        g.bindFramebuffer(g.FRAMEBUFFER, out.fb);
        g.viewport(0, 0, out.w, out.h);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, input.tex);
        g.uniform1i(this.uniform(b, 'image'), 0);
        g.uniform2f(this.uniform(b, 'pixel'), 1.6 / input.w, 1.6 / input.h);
        g.uniform1f(this.uniform(b, 'threshold'), threshold);
        g.drawArrays(g.TRIANGLES, 0, 3);
    } g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, w, h); g.useProgram(p); g.uniform1f(this.uniform(p, 'intensity'), .85 + music_visuals_1.audioVisual.dynamics * .2 + music_visuals_1.audioVisual.beat * .09); [scene, small, wide].forEach((t, i) => { g.activeTexture(g.TEXTURE0 + i); g.bindTexture(g.TEXTURE_2D, t.tex); g.uniform1i(this.uniform(p, ['image', 'glow', 'wide'][i]), i); }); g.drawArrays(g.TRIANGLES, 0, 3); g.activeTexture(g.TEXTURE0); }
    dispose() { this.clearTargets(); if (this.blur)
        this.g.deleteProgram(this.blur); if (this.composite)
        this.g.deleteProgram(this.composite); this.blur = this.composite = null; this.locations.clear(); }
}
class StellarRenderer {
    constructor(kind) {
        this.kind = kind;
        this.canvas = document.createElement('canvas');
        this.gl = null;
        this.program = null;
        this.buffer = null;
        this.post = null;
        this.postFailed = false;
        this.locations = {};
        this.lost = false;
        this.disposed = false;
        this.last = -Infinity;
        this.onLost = (e) => { e.preventDefault(); this.lost = true; this.post = null; this.canvas.hidden = true; };
        this.onRestore = () => { if (this.disposed)
            return; this.lost = false; this.postFailed = false; try {
            this.init();
        }
        catch {
            this.lost = true;
        } };
        this.canvas.className = 'u-gpu-canvas';
        this.canvas.setAttribute('aria-hidden', 'true');
        this.canvas.hidden = true;
        this.canvas.addEventListener('webglcontextlost', this.onLost);
        this.canvas.addEventListener('webglcontextrestored', this.onRestore);
        try {
            this.gl = this.canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
            this.init();
        }
        catch {
            this.lost = true;
        }
    }
    init() { const g = this.gl; if (!g)
        return; const make = (type, source) => { const s = g.createShader(type); if (!s)
        throw Error('shader'); g.shaderSource(s, source); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) {
        const log = g.getShaderInfoLog(s);
        g.deleteShader(s);
        throw Error('shader compile: ' + log);
    } return s; }; let v = null, f = null, p = null; try {
        v = make(g.VERTEX_SHADER, vertex);
        f = make(g.FRAGMENT_SHADER, fragment);
        p = g.createProgram();
        if (!p)
            throw Error('program');
        g.attachShader(p, v);
        g.attachShader(p, f);
        g.bindAttribLocation(p, 0, 'a');
        g.linkProgram(p);
        if (!g.getProgramParameter(p, g.LINK_STATUS))
            throw Error('link');
        g.useProgram(p);
        this.buffer = g.createBuffer();
        if (!this.buffer)
            throw Error('buffer');
        g.bindBuffer(g.ARRAY_BUFFER, this.buffer);
        g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
        const a = g.getAttribLocation(p, 'a');
        g.enableVertexAttribArray(a);
        g.vertexAttribPointer(a, 2, g.FLOAT, false, 0, 0);
        for (const key of ['res', 'tilt', 'time', 'kind', 'planet', 'pulse', 'quality', 'musicTint', 'musicLight'])
            this.locations[key] = g.getUniformLocation(p, key);
        this.program = p;
        this.last = -Infinity;
    }
    catch (e) {
        if (p)
            g.deleteProgram(p);
        if (this.buffer)
            g.deleteBuffer(this.buffer);
        this.buffer = null;
        this.program = null;
        throw e;
    }
    finally {
        if (v)
            g.deleteShader(v);
        if (f)
            g.deleteShader(f);
    } }
    draw(w, h, time, yaw, pitch, planet, pulse, low, budget = 1) {
        const g = this.gl, p = this.program;
        if (!g || !p || this.lost || this.disposed || g.isContextLost())
            return false;
        const ratio = Math.min(devicePixelRatio || 1, (low ? .85 : 1.35) * budget, Math.sqrt((low ? 120000 : 320000) / (w * h)) * budget);
        const x = Math.max(1, Math.round(w * ratio)), y = Math.max(1, Math.round(h * ratio));
        const resized = this.canvas.width !== x || this.canvas.height !== y;
        if (resized) {
            this.canvas.width = x;
            this.canvas.height = y;
        }
        if (resized || this.last === -Infinity)
            g.viewport(0, 0, x, y);
        const now = performance.now();
        if (!resized && !this.canvas.hidden && now - this.last < (low ? 32 : 16))
            return true;
        this.last = now;
        let optical = false;
        if (!low && budget >= .78 && !this.postFailed) {
            try {
                this.post ?? (this.post = new OpticalPost(g));
                this.post.begin(x, y);
                optical = true;
            }
            catch {
                this.post?.dispose();
                this.post = null;
                this.postFailed = true;
            }
        }
        else if (this.post) {
            this.post.dispose();
            this.post = null;
        }
        if (!optical) {
            g.bindFramebuffer(g.FRAMEBUFFER, null);
            g.viewport(0, 0, x, y);
        }
        g.useProgram(p);
        const l = this.locations;
        g.uniform2f(l.res, x, y);
        g.uniform2f(l.tilt, yaw, pitch);
        g.uniform1f(l.time, time);
        g.uniform1f(l.kind, this.kind);
        g.uniform1f(l.planet, planet);
        g.uniform1f(l.pulse, pulse);
        g.uniform1f(l.quality, low ? .45 : budget);
        const tint = (0, music_visuals_1.environmentRGB)();
        g.uniform3f(l.musicTint, tint[0], tint[1], tint[2]);
        g.uniform1f(l.musicLight, music_visuals_1.audioVisual.dynamics * .55 + music_visuals_1.audioVisual.accent * .15 + music_visuals_1.audioVisual.score * .30);
        g.drawArrays(g.TRIANGLES, 0, 3);
        if (optical) {
            try {
                this.post.finish(x, y);
            }
            catch {
                this.post?.dispose();
                this.post = null;
                this.postFailed = true;
                g.bindFramebuffer(g.FRAMEBUFFER, null);
                g.viewport(0, 0, x, y);
                g.useProgram(p);
                g.drawArrays(g.TRIANGLES, 0, 3);
            }
        }
        this.canvas.dataset.post = optical && !this.postFailed ? 'bloom' : 'direct';
        this.canvas.hidden = false;
        return true;
    }
    dispose() { this.disposed = true; this.canvas.removeEventListener('webglcontextlost', this.onLost); this.canvas.removeEventListener('webglcontextrestored', this.onRestore); const g = this.gl; this.post?.dispose(); this.post = null; if (g) {
        if (this.buffer)
            g.deleteBuffer(this.buffer);
        if (this.program)
            g.deleteProgram(this.program);
        g.getExtension('WEBGL_lose_context')?.loseContext();
    } this.canvas.remove(); this.gl = null; this.program = null; }
}
exports.StellarRenderer = StellarRenderer;

},
"./planet":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanetTexture = void 0;
const music_visuals_1 = require("./music-visuals");
const TAU = Math.PI * 2, W = 512, H = 256;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
let terrain = null, cloud = null;
const hash = (x, y, z) => { let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
const lerp = (a, b, t) => a + (b - a) * t;
function noise(x, y, z) { const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z); let a = x - ix, b = y - iy, c = z - iz; a = a * a * (3 - 2 * a); b = b * b * (3 - 2 * b); c = c * c * (3 - 2 * c); return lerp(lerp(lerp(hash(ix, iy, iz), hash(ix + 1, iy, iz), a), lerp(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), a), b), lerp(lerp(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), a), lerp(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), a), b), c); }
function fbm(x, y, z) { return .56 * noise(x, y, z) + .27 * noise(x * 2.07 + 7, y * 2.07, z * 2.07) + .12 * noise(x * 4.23, y * 4.23 + 5, z * 4.23) + .05 * noise(x * 8.5, y * 8.5, z * 8.5 + 3); }
function prepareMap() {
    if (terrain && cloud)
        return;
    terrain = new Float32Array(W * H);
    cloud = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
        const lat = (.5 - y / (H - 1)) * Math.PI, ny = Math.sin(lat), rad = Math.cos(lat);
        for (let x = 0; x < W; x++) {
            const lon = x / W * TAU, rx = Math.sin(lon) * rad, rz = Math.cos(lon) * rad;
            const f = fbm(rx * 4.6, ny * 4.6, rz * 4.6), detail = fbm(rx * 14 + f * 2, ny * 14, rz * 14), band = .5 + .5 * Math.sin(ny * 19 + f * 8 + detail * 1.8), ridge = 1 - Math.abs(2 * detail - 1);
            terrain[y * W + x] = clamp(.20 + f * .72 + band * .19 + ridge * .11, .13, .97);
            cloud[y * W + x] = clamp((fbm(rx * 8 + 4, ny * 8, rz * 8) - .48) * 1.8, 0, .55);
        }
    }
}
function sample(map, u, v) { const x = (u | 0) & (W - 1), y = Math.min(H - 2, v | 0), fx = u - Math.floor(u), fy = v - y, x1 = (x + 1) & (W - 1), a = y * W; return lerp(lerp(map[a + x], map[a + x1], fx), lerp(map[a + W + x], map[a + W + x1], fx), fy); }
const worlds = new Map();
let lastAtlasHue = -1;
function worldMap(hue, limit) {
    prepareMap();
    const old = worlds.get(hue);
    if (old) {
        if (hue !== lastAtlasHue) {
            worlds.delete(hue);
            worlds.set(hue, old);
        }
        lastAtlasHue = hue;
        while (worlds.size > limit)
            worlds.delete(worlds.keys().next().value);
        return old;
    }
    const ground = new Float32Array(W * H), weather = new Float32Array(W * H), relief = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
        const latitude = (y / (H - 1) - .5) * Math.PI, polar = Math.abs(Math.sin(latitude));
        for (let x = 0; x < W; x++) {
            const i = y * W + x, lon = x / W * TAU, v = terrain[i], c = cloud[i];
            if (hue === 330) {
                ground[i] = clamp(v * .84 + .13, .12, .98);
                weather[i] = c * .85;
            }
            else if (hue === 203) {
                const land = clamp((v - .52) * 4 + .5, 0, 1);
                ground[i] = .24 + .49 * land + .15 * polar;
                weather[i] = c * .72;
            }
            else if (hue === 270) {
                const ridge = 1 - Math.abs(2 * v - 1);
                ground[i] = clamp(.18 + .65 * ridge * ridge + .09 * Math.cos(lon * 3) * Math.cos(latitude), .1, .95);
                weather[i] = c * .28;
            }
            else {
                const belt = .5 + .5 * Math.sin(latitude * 25 + v * 5);
                ground[i] = .24 + .49 * belt + .19 * v;
                weather[i] = c * .38 + .12 * belt;
            }
        }
    }
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
            const i = y * W + x;
            const dx = ground[y * W + ((x - 1) & (W - 1))] - ground[y * W + ((x + 1) & (W - 1))], dy = ground[Math.max(0, y - 1) * W + x] - ground[Math.min(H - 1, y + 1) * W + x];
            relief[i] = dx * .52 + dy * .28;
        }
    const result = { ground, cloud: weather, relief };
    worlds.set(hue, result);
    lastAtlasHue = hue;
    while (worlds.size > limit)
        worlds.delete(worlds.keys().next().value);
    return result;
}
const SINE_N = 2048, SINE_MASK = SINE_N - 1, SINE_RATE = SINE_N / TAU;
const sineLut = Float32Array.from({ length: SINE_N }, (_, i) => Math.sin(i / SINE_RATE));
function fastSin(a) { const x = a * SINE_RATE, i = Math.floor(x), f = x - i; return lerp(sineLut[i & SINE_MASK], sineLut[(i + 1) & SINE_MASK], f); }
const ridgeTone = (ridge, valley) => ridge * .12 - valley * .04;
class PlanetTexture {
    constructor() {
        this.surface = document.createElement('canvas');
        this.context = this.surface.getContext('2d');
        this.image = null;
        this.geometry = null;
        this.pixels = null;
        this.lastFrame = -1;
        this.lastHue = -1;
        this.geometryHue = -1;
    }
    prepare(size, hue) { const ctx = this.context; if (!ctx)
        return; this.surface.width = this.surface.height = size; this.image = ctx.createImageData(size, size); this.geometry = new Float32Array(size * size * 9); this.lastFrame = -1; const g = this.geometry, data = this.image.data, indices = []; this.geometryHue = hue; const l = hue === 203 ? [-.46, -.76, .46] : hue === 270 ? [.56, -.58, .59] : hue === 330 ? [-.62, -.58, .53] : [-.78, -.32, .54], len = Math.hypot(...l), L = l.map(n => n / len); const half = [L[0], L[1], L[2] + 1], hlen = Math.hypot(...half); for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const nx = (x + .5 - size / 2) / (size / 2 - 1), ny = (y + .5 - size / 2) / (size / 2 - 1), r2 = nx * nx + ny * ny;
            if (r2 >= 1)
                continue;
            const nz = Math.sqrt(1 - r2), i = y * size + x, k = i * 9;
            indices.push(i);
            const diffuse = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
            g[k] = ((Math.atan2(nx, nz) / TAU + 1) % 1) * W;
            g[k + 1] = (.5 + Math.asin(ny) / Math.PI) * (H - 1);
            g[k + 2] = .11 + diffuse * 1.2;
            g[k + 3] = Math.pow(1 - nz, 3.2) * (.08 + diffuse * .29);
            g[k + 4] = diffuse;
            g[k + 5] = Math.pow(Math.max(0, (nx * half[0] + ny * half[1] + nz * half[2]) / hlen), 24) * .26;
            g[k + 6] = Math.pow(Math.abs(g[k + 1] / (H - 1) - .5) * 2, 1.7);
            g[k + 7] = Math.pow(Math.max(0, .24 - g[k + 2]), 2.2) * (.25 + .75 * g[k + 6]);
            g[k + 8] = g[k + 1] / (H - 1) * 7;
            data[i * 4 + 3] = Math.round(255 * clamp((1 - Math.sqrt(r2)) * (size / 2 - 1) + .5, 0, 1));
        } this.pixels = Uint32Array.from(indices); }
    draw(hue, t, size, rate) {
        const map = worldMap(hue, size <= 144 ? 2 : 4);
        const ctx = this.context;
        if (!ctx || !terrain || !cloud)
            return this.surface;
        if (!this.image || size !== this.surface.width || this.geometryHue !== hue)
            this.prepare(size, hue);
        const frame = Math.floor(t * rate);
        if (!this.image || !this.geometry || !this.pixels || (frame === this.lastFrame && hue === this.lastHue))
            return this.surface;
        const palette = hue === 330 ? { deep: [84, 36, 58], mid: [196, 112, 154], high: [255, 221, 235], accent: [250, 193, 221] } : hue === 203 ? { deep: [28, 58, 96], mid: [85, 162, 232], high: [219, 241, 255], accent: [169, 214, 255] } : hue === 270 ? { deep: [57, 37, 88], mid: [156, 114, 226], high: [232, 218, 255], accent: [208, 179, 255] } : { deep: [106, 68, 32], mid: [233, 172, 99], high: [255, 234, 196], accent: [255, 213, 145] };
        const data = this.image.data, g = this.geometry, shift = (t * (hue === 203 ? .38 : hue === 270 ? .46 : hue === 330 ? .53 : .65) / TAU * W) % W, cloudShift = (t * (hue === 203 ? .56 : hue === 270 ? .51 : hue === 330 ? .62 : .78) / TAU * W) % W;
        const env = (0, music_visuals_1.environmentRGB)(), react = music_visuals_1.audioVisual.dynamics * .09 + music_visuals_1.audioVisual.accent * .025 + music_visuals_1.audioVisual.score * .05;
        for (const i of this.pixels) {
            const k = i * 9, j = i * 4, u = (g[k] + shift) % W, v = g[k + 1], ground = sample(map.ground, u, v), relief = sample(map.relief, u, v), wisps = sample(map.cloud, (g[k] + cloudShift) % W, v) * g[k + 4], cloudShadow = sample(map.cloud, (g[k] + cloudShift + 2.6) % W, v) * g[k + 4], terminator = g[k + 2], rim = g[k + 3], spec = g[k + 5], polar = g[k + 6], ridge = Math.max(0, (ground - .58) * 2.2), valley = Math.max(0, (.45 - ground) * 2), shadow = 1 - .28 * cloudShadow, light = clamp(terminator * (ground * 1.05 + relief * 1.35 + ridgeTone(ridge, valley)) * shadow + rim * .65, .025, 1);
            const frost = Math.max(0, polar * .82 - (ground - .52) * .38), aurora = Math.max(0, .12 + fastSin((u / W) * TAU * 3.5 + t * .38 + g[k + 8]) * .12) * polar * Math.max(0, .15 + terminator * .85), nightGlow = g[k + 7], cloudLight = wisps * (.65 + .35 * terminator);
            for (let z = 0; z < 3; z++) {
                const base = palette.deep[z] * (1 - light) + palette.mid[z] * light;
                const alpine = (palette.high[z] - base) * (.04 + ridge * .26 + frost * .38) * (.12 + .88 * terminator / 1.31);
                const basin = (palette.deep[z] - base) * valley * .08;
                const cloud = (z === 2 ? 130 : 150) * cloudLight;
                const sparkle = (palette.accent[z] - base) * (spec * .72 + aurora * (z === 1 ? .18 : .28) + nightGlow * (z === 2 ? .22 : .09));
                const microRelief = relief * (palette.high[z] - palette.deep[z]) * .14 * terminator;
                const value = base + alpine + basin + cloud + sparkle + rim * (palette.accent[z] - base) * .32 + microRelief + react * env[z] * (rim * 95 + spec * 80 + cloudLight * 32);
                data[j + z] = Math.min(255, Math.max(0, value));
            }
        }
        ctx.putImageData(this.image, 0, 0);
        this.lastFrame = frame;
        this.lastHue = hue;
        return this.surface;
    }
    dispose() { this.surface.width = this.surface.height = 1; this.image = null; this.geometry = null; this.pixels = null; }
}
exports.PlanetTexture = PlanetTexture;

},
"./atelier":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Atelier = exports.ATELIER_WORLDS = void 0;
const music_visuals_1 = require("./music-visuals");
exports.ATELIER_WORLDS = [
    { id: 'palace', icon: '♜', title: 'Palácio de cristal', description: 'Atravesse três salões de cristal e descubra sua luz.' },
    { id: 'islands', icon: '☁', title: 'Ilhas flutuantes', description: 'Viaje entre ilhas suspensas e cachoeiras luminosas.' },
    { id: 'rose', icon: '✿', title: 'Rosa eterna', description: 'Desperte uma rosa de cristal, pétala por pétala.' },
    { id: 'clock', icon: '◷', title: 'Relógio das memórias', description: 'Movimente o mecanismo e revele pequenos desejos.' },
    { id: 'butterflies', icon: '❦', title: 'Borboletas de cristal', description: 'Acompanhe asas iridescentes em uma dança luminosa.' },
    { id: 'ocean', icon: '≋', title: 'Oceano dos sonhos', description: 'Mergulhe entre águas-vivas e correntes bioluminescentes.' },
];
const TAU = 2 * Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v) => { const d = Math.hypot(...v) || 1; return [v[0] / d, v[1] / d, v[2] / d]; };
const key = norm([-.55, -.72, -.6]), fill = norm([.65, -.12, -.4]), rim = norm([.25, -.5, .85]);
const halfway = norm([key[0], key[1], key[2] - 1]);
const prismProfiles = new Map();
const UP = [0, -1, 0], FRONT = [0, 0, 1];
function prismProfile(n) { let p = prismProfiles.get(n); if (!p) {
    p = { ring: Array.from({ length: n }, (_, i) => [Math.cos(i * TAU / n), Math.sin(i * TAU / n)]), normals: Array.from({ length: n }, (_, i) => [-Math.cos((i + .5) * TAU / n), 0, -Math.sin((i + .5) * TAU / n)]) };
    prismProfiles.set(n, p);
} return p; }
const archProfile = Array.from({ length: 13 }, (_, j) => { const a = Math.PI + j * Math.PI / 12; return [1.65 * Math.cos(a), -.78 + 1.03 * Math.sin(a)]; });
function lightTerms(n, shiny) { return { d: Math.abs(dot(n, key)), b: Math.abs(dot(n, fill)), r: Math.abs(dot(n, rim)), spec: Math.pow(Math.abs(dot(n, halfway)), shiny ? 30 : 18) * 14, edgeLight: Math.pow(1 - Math.abs(n[2]), 3.) }; }
const staticLighting = new WeakMap();
class Atelier {
    glowStamp(h) { const key = ((Math.round(h / 15) * 15) % 360 + 360) % 360; let stamp = this.glowStamps.get(key); if (stamp)
        return stamp; stamp = document.createElement('canvas'); stamp.width = stamp.height = 48; const c = stamp.getContext('2d'); if (!c)
        return null; const g = c.createRadialGradient(24, 24, 0, 24, 24, 24); g.addColorStop(0, `hsla(${key} 90% 90% / .95)`); g.addColorStop(.25, `hsla(${key} 85% 72% / .40)`); g.addColorStop(1, `hsla(${key} 85% 70% / 0)`); c.fillStyle = g; c.fillRect(0, 0, 48, 48); this.glowStamps.set(key, stamp); return stamp; }
    penumbra() { if (this.shadowStamp)
        return this.shadowStamp; const s = document.createElement('canvas'); s.width = s.height = 96; const c = s.getContext('2d'); if (!c)
        return null; const g = c.createRadialGradient(48, 48, 0, 48, 48, 48); g.addColorStop(0, '#08051199'); g.addColorStop(.38, '#08051162'); g.addColorStop(1, '#08051100'); c.fillStyle = g; c.fillRect(0, 0, 96, 96); return this.shadowStamp = s; }
    defocus() { if (this.bokehStamp)
        return this.bokehStamp; const s = document.createElement('canvas'); s.width = s.height = 64; const c = s.getContext('2d'); if (!c)
        return null; const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#ffd2e44d'); g.addColorStop(.48, '#ed94c52e'); g.addColorStop(.75, '#ed94c51c'); g.addColorStop(1, '#ed94c500'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); return this.bokehStamp = s; }
    dispose() { for (const s of [this.shadowStamp, this.bokehStamp])
        if (s)
            s.width = s.height = 1; this.shadowStamp = this.bokehStamp = null; for (const s of this.glowStamps.values())
        s.width = s.height = 1; this.glowStamps.clear(); this.faces.length = this.lines.length = this.sparks.length = this.shadows.length = 0; }
    constructor(kind) {
        this.kind = kind;
        this.faces = [];
        this.lines = [];
        this.sparks = [];
        this.shadows = [];
        this.state = 0;
        this.lastTime = -1;
        this.shadowStamp = null;
        this.bokehStamp = null;
        this.glowStamps = new Map();
    }
    face(p, h, l = 50, s = 60, edge = .15, normal) { this.faces.push({ p, h, s, l, edge, normal }); }
    line(a, b, color, width = 1) { this.lines.push({ a, b, color, width }); }
    spark(p, r, h) { this.sparks.push({ p, r, h }); }
    prism(x, y, z, r, height, hue, n = 6) {
        const profile = prismProfile(n), top = [], bottom = [];
        for (const [cx, cz] of profile.ring) {
            const xx = x + r * cx, zz = z + r * cz;
            top.push([xx, y - height, zz]);
            bottom.push([xx, y, zz]);
        }
        this.face(top, hue, 72, 60, .15, UP);
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            this.face([top[i], top[j], bottom[j], bottom[i]], hue + i * 2, 48, 60, .15, profile.normals[i]);
        }
    }
    jewel(x, y, z, r, h, t) { const ring = Array.from({ length: 7 }, (_, i) => { const a = i * TAU / 7 + t; return [x + r * Math.cos(a), y, z + r * Math.sin(a)]; }); for (let i = 0; i < 7; i++) {
        const j = (i + 1) % 7;
        this.face([ring[i], ring[j], [x, y - r * 1.75, z]], h + i * 2, 58);
        this.face([ring[j], ring[i], [x, y + r * 1.15, z]], h + i * 2, 40);
    } }
    gear(x, y, z, r, n, t, h) { const points = []; for (let i = 0; i < n * 4; i++) {
        const a = i * TAU / (n * 4) + t, rad = r * (i % 4 === 1 || i % 4 === 2 ? 1 : .83);
        points.push([x + rad * Math.cos(a), y + rad * Math.sin(a), z]);
    } for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        const a = points[i], b = points[j];
        const inner = (p) => [x + (p[0] - x) * .53, y + (p[1] - y) * .53, z];
        this.face([a, b, inner(b), inner(a)], h, 61, 65, .2);
        this.face([a, [a[0], a[1], z + .075], [b[0], b[1], z + .075], b], h, 32, 55, .08);
    } for (let i = 0; i < 6; i++) {
        const a = t + i * TAU / 6;
        this.line([x, y, z - .01], [x + Math.cos(a) * r * .64, y + Math.sin(a) * r * .64, z - .01], '#e9bd88', 3);
    } this.jewel(x, y, z - .05, r * .14, h, t); }
    render(c, w, h, t, value, pulse, project, low) {
        this.faces.length = this.lines.length = this.sparks.length = this.shadows.length = 0;
        const dt = this.lastTime < 0 ? 1 / 60 : Math.max(0, t - this.lastTime);
        this.lastTime = t;
        this.state += (value - this.state) * (document.documentElement.dataset.motion === 'reduced' ? 1 : 1 - Math.exp(-dt * 7));
        const v = this.state;
        switch (this.kind) {
            case 'palace': {
                const travel = (t * .16 + v * .83) % 2.6;
                for (let i = 6; i >= 0; i--) {
                    const z = i * 1.25 + .8 - travel;
                    const hue = 316 + i * 4 + v * 8;
                    this.face([[-2.3, 1.1, z], [-2.3, 1.1, z + 1.25], [2.3, 1.1, z + 1.25], [2.3, 1.1, z]], hue, 24, 35, .3, UP);
                    for (const x of [-1.62, 1.62]) {
                        this.shadows.push({ p: [x, 1.095, z], r: .32 });
                        this.shadows.push({ p: [x + .23, 1.094, z + .20], r: .45, soft: true });
                        this.prism(x, 1.1, z, .20, .18, 38, 8);
                        this.prism(x, .92, z, .14, 2.15, hue, 8);
                        this.prism(x, -1.23, z, .24, .16, 42, 8);
                        this.jewel(x, -1.52, z, .14, hue, t * .4);
                        this.spark([x, -1.55, z - .04], .10, 43);
                    }
                    const a = archProfile.map(([x, y]) => [x, y, z]);
                    for (let j = 0; j < 12; j++) {
                        const p = a[j], q = a[j + 1];
                        this.face([p, q, [q[0] * .87, q[1] * .88, z], [p[0] * .87, p[1] * .88, z]], hue, 62, 55, .36, FRONT);
                    }
                }
                this.jewel(0, -.2, 1.1, .34, 330 + v * 12, t * .5);
                this.spark([0, -.2, 1], .20, 335);
                break;
            }
            case 'islands': {
                for (let i = 0; i < 3; i++) {
                    const a = t * .14 + i * TAU / 3 + v * .7, x = Math.cos(a) * 1.24, z = 2 + Math.sin(a) * 1.15, y = .25 + Math.sin(t * .72 + i) * .12, r = .66;
                    const top = Array.from({ length: 9 }, (_, j) => { const b = j * TAU / 9; return [x + Math.cos(b) * r, y, z + Math.sin(b) * r]; });
                    this.face(top, 158, 43, 35, .25);
                    for (let j = 0; j < 9; j++) {
                        this.face([top[j], top[(j + 1) % 9], [x, y + .78, z]], 270 + j * 3, 40, 36, .15);
                    }
                    for (let j = 0; j < 4; j++) {
                        const p = j * 1.9;
                        const xx = x + .28 * Math.cos(p), zz = z + .28 * Math.sin(p);
                        this.prism(xx, y, zz, .025, .19, 37, 5);
                        this.jewel(xx, y - .24, zz, .12, 325 + i * 15, t * .35 + j);
                    }
                    const wx = x + r * .7, wz = z - r * .42;
                    for (let j = 0; j < 12; j++) {
                        const s = (j / 12 + t * .5) % 1;
                        this.spark([wx + Math.sin(s * 5 + t) * .05, y + s * 1.15, wz], .025 * (1 - s) + .008, 190);
                    }
                    this.line([wx, y, wz], [wx + .06, y + .96, wz], '#a4e4f477', 2);
                }
                break;
            }
            case 'rose': {
                const open = .52 + .48 * clamp(v / 3, 0, 1) + .035 * Math.sin(t * .6), angle = t * .20;
                const cy = -.39, cz = .18;
                let stem = [0, 1.03, cz];
                for (let j = 1; j <= 12; j++) {
                    const u = j / 12, next = [.075 * Math.sin(u * Math.PI), 1.03 + (cy - 1.03) * u, cz + .07 * Math.sin(u * Math.PI)];
                    this.line(stem, next, '#81bb98', 4);
                    stem = next;
                }
                for (const side of [-1, 1]) {
                    const p = [.03, .66, cz], q = [side * .78, .22, cz + .01], r = [side * .31, .34, cz - .16], m = [side * .38, .42, cz + .02];
                    this.face([p, r, q, m], 155, 43, 43, .26);
                    this.face([p, m, q, [side * .32, .58, cz + .07]], 147, 35, 40, .2);
                    this.line(p, q, '#a1c6a975', 1);
                }
                const tilt = .54, ct = Math.cos(tilt), st = Math.sin(tilt);
                const bloom = (p) => [p[0], cy + (p[1] - cy) * ct - (p[2] - cz) * st, cz + (p[1] - cy) * st + (p[2] - cz) * ct];
                for (let layer = 0; layer < 4; layer++) {
                    const count = 5 + layer * 2, segments = low ? 6 : 9;
                    for (let i = 0; i < count; i++) {
                        const a = i * TAU / count + angle + layer * .62, length = .40 + layer * .17, petals = [];
                        for (let j = 0; j <= segments; j++) {
                            const u = j / segments, r = .05 + layer * .035 + length * Math.pow(u, .9) * open, yy = cy + .20 - (.63 - layer * .05) * Math.sin(u * Math.PI * .69) + u * u * (open - .5) * .31;
                            const width = (Math.pow(Math.sin(Math.PI * u * .84), .8)) * (.19 + layer * .052);
                            const center = [Math.cos(a) * r, yy, cz + Math.sin(a) * r];
                            const curl = .11 * Math.sin(u * Math.PI * .85) + .045 * u * u + .022 * Math.sin(u * 6 + i * 1.3 + t * .9);
                            petals.push([bloom([center[0] - Math.sin(a) * width, yy + curl, center[2] + Math.cos(a) * width]), bloom(center), bloom([center[0] + Math.sin(a) * width, yy + curl, center[2] - Math.cos(a) * width])]);
                        }
                        for (let j = 0; j < segments; j++)
                            for (let k = 0; k < 2; k++)
                                this.face([petals[j][k], petals[j + 1][k], petals[j + 1][k + 1], petals[j][k + 1]], 326 + layer * 5, 55 + layer * 3, 64 + j / segments * 8, .035);
                        this.line(petals[1][1], petals[segments][1], '#ffbdcf28', .55);
                    }
                }
                this.jewel(0, cy - .05, cz, .095, 43, t * .3);
                this.spark([0, cy - .12, cz], .13, 42);
                break;
            }
            case 'clock': {
                const z = .55, a = t * .42 + v * TAU / 12;
                this.gear(0, 0, z, .96, 24, a, 42);
                this.gear(-1.07, .50, z + .16, .37, 12, -a * 2, 32);
                this.gear(1.01, -.54, z + .16, .37, 12, -a * 2, 33);
                for (let i = 0; i < 12; i++) {
                    const b = i * TAU / 12;
                    this.jewel(Math.sin(b) * .78, -Math.cos(b) * .78, z - .10, .034, 43, b);
                }
                for (const [angle, r, width] of [[a * .23, .59, 4], [a * .75, .71, 2]])
                    this.line([0, 0, z - .14], [Math.sin(angle) * r, -Math.cos(angle) * r, z - .14], '#fff0ce', width);
                this.spark([0, 0, z - .16], .12, 45);
                break;
            }
            case 'butterflies': {
                for (let i = 0; i < 5; i++) {
                    const a = t * (.42 + i * .025) + i * 1.31 + v * .5, x = Math.sin(a) * 1.12, y = Math.cos(a * 1.4) * .55, z = 1.3 + Math.cos(a) * .83, scale = .28 + i * .035, flap = .20 + .80 * Math.abs(Math.sin(t * 5.6 + i * .7));
                    for (const side of [-1, 1]) {
                        const p = [x, y, z], q = [x + side * scale * 1.35 * flap, y - scale, z - scale * .7 * (1 - flap)], r = [x + side * scale * 2.15 * flap, y - scale * .14, z - scale * (1 - flap)], s = [x + side * scale * .9 * flap, y + scale * .43, z - scale * .5 * (1 - flap)];
                        this.face([p, q, r], 280 + i * 13 + v * 10, 67, 78, .38);
                        this.face([p, r, s], 323 + i * 5, 58, 75, .38);
                        this.face([p, s, [x + side * scale * .54 * flap, y + scale * .85, z]], 296 + i * 6, 61, 70, .25);
                    }
                    this.line([x, y - scale * .3, z], [x, y + scale * .55, z], '#f3d7bf', 2);
                    this.spark([x, y, z - .04], .048, 320);
                }
                break;
            }
            case 'ocean': {
                for (let i = 0; i < 4; i++) {
                    const a = t * .45 + i * 1.6 + v * .3, x = Math.sin(a) * 1.3, y = -.4 + Math.cos(a * .8) * .38, z = .05 + i * .48, r = .38 + i * .045, pump = 1 + .12 * Math.sin(t * 2.5 + i);
                    const ring = Array.from({ length: 12 }, (_, j) => { const b = j * TAU / 12; return [x + r * pump * Math.cos(b), y, z + r * pump * Math.sin(b)]; });
                    for (let j = 0; j < 12; j++) {
                        this.face([ring[j], ring[(j + 1) % 12], [x, y - r * .83, z]], 190 + i * 20 + v * 12, 55, 76, .28);
                    }
                    for (let j = 0; j < 7; j++) {
                        const b = j * TAU / 7;
                        let p = [x + r * .7 * Math.cos(b), y, z + r * .7 * Math.sin(b)];
                        for (let k = 1; k <= 8; k++) {
                            const s = k / 8, q = [p[0] + Math.sin(t * 1.9 + s * 4 + j) * .026, y + s * .91, p[2] + Math.cos(t + s * 3 + j) * .016];
                            this.line(p, q, `hsla(${190 + i * 22} 85% 75% / ${.8 - s * .55})`, 1.4);
                            p = q;
                        }
                    }
                    this.spark([x, y - .08, z - .06], .16, 190 + i * 20);
                }
                break;
            }
        }
        if (this.kind === 'palace') {
            for (let i = 0; i < (low ? 2 : 3); i++) {
                const x = w * (.18 + i * .32), phase = Math.sin(t * .38 + i) * w * .035, g = c.createLinearGradient(x, 0, x + w * .18, h);
                g.addColorStop(0, '#f3cca42c');
                g.addColorStop(.55, '#c69bd317');
                g.addColorStop(1, '#ab8fc000');
                c.fillStyle = g;
                c.beginPath();
                c.moveTo(x - 9, 0);
                c.lineTo(x + 9, 0);
                c.lineTo(x + w * .31 + phase, h);
                c.lineTo(x + w * .05 + phase, h);
                c.closePath();
                c.fill();
            }
        }
        if (this.kind === 'ocean') {
            c.save();
            const water = c.createLinearGradient(0, 0, 0, h);
            water.addColorStop(0, '#164b625c');
            water.addColorStop(.5, '#163a573b');
            water.addColorStop(1, '#031526bf');
            c.fillStyle = water;
            c.fillRect(0, 0, w, h);
            for (let i = 0; i < 7; i++) {
                const x = w * (i / 6 + .025 * Math.sin(t * .4 + i));
                const ray = c.createLinearGradient(x, 0, x + w * .25, h);
                ray.addColorStop(0, '#95e8f52b');
                ray.addColorStop(1, '#95e8f500');
                c.fillStyle = ray;
                c.beginPath();
                c.moveTo(x - 8, 0);
                c.lineTo(x + 9, 0);
                c.lineTo(x + w * .29, h);
                c.lineTo(x + w * .12, h);
                c.fill();
            }
            c.restore();
        }
        if (this.kind === 'rose' || this.kind === 'butterflies') {
            const stamp = this.defocus(), bokehCount = low ? 8 : 15;
            for (let i = 0; stamp && i < bokehCount; i++) {
                const z = .75 + (i * .61803398875 % 1) * 5.4, x = w * (.5 + .47 * Math.sin(i * 2.399 + t * .08 / z)), y = h * (.5 + .44 * Math.cos(i * 1.73 + t * .1 / z));
                const focus = 2.4, coc = Math.abs(1 / focus - 1 / z), r = Math.min(w, h) * (.012 + .14 * coc);
                c.drawImage(stamp, x - r, y - r, r * 2, r * 2);
            }
        }
        if (this.kind === 'islands') {
            for (let i = 0; i < 4; i++) {
                const y = h * (.57 + i * .095), x = w * (.5 + Math.sin(t * .16 + i) * .32);
                const g = c.createRadialGradient(x, y, 0, x, y, w * .42);
                g.addColorStop(0, '#cce0f333');
                g.addColorStop(1, '#cce0f300');
                c.fillStyle = g;
                c.fillRect(0, y - w * .42, w, w * .84);
            }
        }
        const projected = new Map();
        const cached = (p) => { let q = projected.get(p); if (!q) {
            q = project(p);
            projected.set(p, q);
        } return q; };
        const commands = [];
        const musicalHue = { wine: 332, amber: 38, violet: 269, silver: 214, rose: 341 };
        const ambientHue = musicalHue[(0, music_visuals_1.visualMood)()];
        for (const f of this.faces) {
            const q = f.p.map(cached);
            const normal = f.normal ?? norm(cross(sub(f.p[1], f.p[0]), sub(f.p[2], f.p[0])));
            let terms = f.normal ? staticLighting.get(normal) : undefined;
            if (!terms) {
                terms = lightTerms(normal, this.kind === 'clock');
                if (f.normal)
                    staticLighting.set(normal, terms);
            }
            const { d, b, r, spec, edgeLight } = terms;
            const z = q.reduce((s, p) => s + p.z, 0) / q.length;
            const organic = this.kind === 'rose' || this.kind === 'ocean' || this.kind === 'butterflies';
            const haze = clamp(z * .065, 0, .39);
            const crystal = this.kind === 'palace' || this.kind === 'butterflies';
            const prism = crystal ? Math.sin(normal[0] * 5.2 + normal[1] * 3.1) * edgeLight * 12 : 0;
            const ao = this.kind === 'palace' ? 1 - .14 * clamp((f.p[0][1] + .25) / 1.35, 0, 1) : 1;
            const indirect = .035 + .065 * clamp((1 - normal[1]) * .5, 0, 1);
            const hue = f.h + ((((ambientHue ?? f.h) - f.h + 540) % 360) - 180) * (.05 + music_visuals_1.audioVisual.dynamics * .09);
            const materialSpec = this.kind === 'clock' ? 1.22 : crystal ? 1.12 : this.kind === 'islands' ? .42 : .62;
            const luminance = clamp((f.l * (.36 + .66 * d + .15 * b + indirect) * ao + r * 10 + spec * materialSpec + edgeLight * (organic ? 12 : crystal ? 10 : 5)) * (1 - haze) + 34 * haze + (crystal ? music_visuals_1.audioVisual.score * 2.5 + music_visuals_1.audioVisual.beat * 2 : music_visuals_1.audioVisual.dynamics * 1.5), 10, 91);
            commands.push({ z, draw: () => { c.beginPath(); q.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); if (!low && (organic || this.kind === 'palace')) {
                    const top = q.reduce((a, b) => a.y < b.y ? a : b), bottom = q.reduce((a, b) => a.y > b.y ? a : b);
                    if (Math.abs(bottom.y - top.y) > 3) {
                        const g = c.createLinearGradient(top.x, top.y, bottom.x, bottom.y);
                        g.addColorStop(0, `hsl(${hue + 4 + prism} ${f.s}% ${clamp(luminance + 15, 0, 96)}%)`);
                        g.addColorStop(.34, `hsl(${hue} ${f.s}% ${luminance}%)`);
                        g.addColorStop(1, `hsl(${hue - 6 - prism} ${f.s}% ${clamp(luminance - 16, 8, 94)}%)`);
                        c.fillStyle = g;
                    }
                    else
                        c.fillStyle = `hsl(${hue} ${f.s}% ${luminance}%)`;
                }
                else
                    c.fillStyle = `hsl(${hue} ${f.s}% ${luminance}%)`; c.fill(); if (f.edge) {
                    c.strokeStyle = `hsla(${hue + 12} 70% 88% / ${f.edge})`;
                    c.lineWidth = .65;
                    c.stroke();
                } } });
        }
        const stamp = this.shadows.length ? this.penumbra() : null;
        for (const shadow of this.shadows) {
            const p = cached(shadow.p), spread = shadow.soft ? 1 + clamp(p.z * .055, 0, .32) : .82, rx = shadow.r * p.k * spread, ry = rx * .31;
            if (stamp)
                commands.push({ z: p.z + .002, draw: () => { c.globalAlpha = shadow.soft ? .62 : 1; c.drawImage(stamp, p.x - rx, p.y - ry, 2 * rx, 2 * ry); c.globalAlpha = 1; } });
        }
        for (const line of this.lines) {
            const a = project(line.a), b = project(line.b);
            commands.push({ z: (a.z + b.z) / 2, draw: () => { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.strokeStyle = line.color; c.lineWidth = line.width; c.stroke(); } });
        }
        for (const s of this.sparks) {
            const p = project(s.p), r = Math.max(1, s.r * p.k), stamp = this.glowStamp(s.h);
            if (stamp)
                commands.push({ z: p.z, draw: () => { c.drawImage(stamp, p.x - r * 2.1, p.y - r * 2.1, r * 4.2, r * 4.2); } });
        }
        commands.sort((a, b) => b.z - a.z);
        for (const command of commands)
            command.draw();
        const vignette = c.createRadialGradient(w * .5, h * .5, Math.min(w, h) * .22, w * .5, h * .5, Math.hypot(w, h) * .58);
        vignette.addColorStop(0, '#09061500');
        vignette.addColorStop(1, '#090615bb');
        c.fillStyle = vignette;
        c.fillRect(0, 0, w, h);
        if (pulse > 0) {
            c.fillStyle = `rgba(255,218,235,${pulse * .045})`;
            c.fillRect(0, 0, w, h);
        }
    }
}
exports.Atelier = Atelier;

},
"./universe":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORLDS = void 0;
exports.universeProgress = universeProgress;
exports.universeDiscovered = universeDiscovered;
exports.exportUniverse = exportUniverse;
exports.importUniverse = importUniverse;
exports.resetUniverse = resetUniverse;
exports.mountUniverse = mountUniverse;
const motion_1 = require("./motion");
const atelier_1 = require("./atelier");
const planet_1 = require("./planet");
const stellar_1 = require("./stellar");
const config_1 = require("./config");
exports.WORLDS = [
    { id: 'portal', icon: '◉', title: 'Portal do universo', description: 'Atravesse um arco de luz e descubra o seu céu.' },
    { id: 'garden', icon: '✿', title: 'Jardim encantado', description: 'Cultive flores de cristal que guardam mensagens.' },
    { id: 'book', icon: '❧', title: 'Livro da história', description: 'Folheie a carta original em um livro animado.' },
    { id: 'museum', icon: '◇', title: 'Museu das memórias', description: 'Percorra uma exposição das suas artes.' },
    { id: 'space', icon: '◎', title: 'Um universo só seu', description: 'Viaje por quatro planetas e descubra mensagens.' },
    { id: 'music', icon: '♫', title: 'Caixa de música', description: 'Abra uma caixa iluminada com melodia original.' },
    { id: 'lantern', icon: '♧', title: 'Festival das lanternas', description: 'Escreva um desejo e envie uma lanterna ao céu.' },
    { id: 'finale', icon: '✧', title: 'Grande final', description: 'Uma pequena sequência de cinema dedicada a você.' },
    { id: 'stars', icon: '✦', title: 'Colecionadora de estrelas', description: 'Capture oito estrelas luminosas sem limite de tempo.' },
    { id: 'path', icon: '⌘', title: 'Caminho das constelações', description: 'Memorize e repita a ordem das estrelas.' },
    { id: 'calendar', icon: '◷', title: 'Calendário de surpresas', description: 'Escreva mensagens que só aparecem na data escolhida.' },
    { id: 'aurora', icon: '≈', title: 'Aurora dos desejos', description: 'Pinte o céu com luzes que se movem em ondas.' },
    { id: 'puzzle', icon: '▦', title: 'Mosaico de memórias', description: 'Reconstrua uma arte da galeria em um quebra-cabeça.' },
    { id: 'guide', icon: '☾', title: 'Guardiã do universo', description: 'Uma personagem guia para escolher a próxima aventura.' },
    ...atelier_1.ATELIER_WORLDS,
];
const TAU = Math.PI * 2;
const clampU = (n, a, b) => Math.min(b, Math.max(a, n));
const reduced = motion_1.motionReduced;
const node = (tag, cls = '', text = '') => { const e = document.createElement(tag); e.className = cls; e.textContent = text; return e; };
const action = (text, fn, cls = 'u-button') => { const b = node('button', cls, text); b.type = 'button'; if (cls === 'u-star-target')
    (0, motion_1.bindMovingControl)(b, fn);
else
    b.addEventListener('click', fn); return b; };
const readLocal = (key, fallback) => { try {
    return JSON.parse(localStorage.getItem('noa-universe-' + key) || 'null') ?? fallback;
}
catch {
    return fallback;
} };
const writeLocal = (key, value) => { try {
    localStorage.setItem('noa-universe-' + key, JSON.stringify(value));
}
catch { } };
const wishes = ['Que seus dias tenham espaço para tudo o que você ama.', 'Que você sempre encontre tempo para criar, sonhar e descansar.', 'Que a vida lhe devolva toda a gentileza que você oferece.', 'Que nunca faltem pequenos motivos para sorrir.'];
const arts = config_1.CONFIG.gallery.filter(g => g.kind === 'desenhos');
const discovered = new Set((() => { const v = readLocal('discoveries', []); return Array.isArray(v) ? v.filter(x => exports.WORLDS.some(w => w.id === x)) : []; })());
function universeProgress() { return discovered.size; }
function universeDiscovered(id) { return discovered.has(id); }
function exportUniverse() { return { discoveries: [...discovered], lanterns: textRecords('lanterns'), calendar: textRecords('calendar') }; }
function importUniverse(raw) { const v = raw && typeof raw === 'object' ? raw : {}; discovered.clear(); if (Array.isArray(v.discoveries))
    for (const id of v.discoveries)
        if (exports.WORLDS.some(w => w.id === id))
            discovered.add(id); writeLocal('discoveries', [...discovered]); for (const k of ['lanterns', 'calendar']) {
    const records = v[k];
    writeLocal(k, Array.isArray(records) ? records.filter(r => r && typeof r.text === 'string' && r.text.length <= 300 && (k === 'lanterns' || typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date))).map(r => ({ text: r.text, ...(k === 'calendar' ? { date: r.date } : {}) })).slice(-30) : []);
} document.dispatchEvent(new Event('universe-progress')); }
function resetUniverse() { discovered.clear(); for (const k of ['discoveries', 'lanterns', 'calendar', 'scores']) {
    try {
        localStorage.removeItem('noa-universe-' + k);
    }
    catch { }
} document.dispatchEvent(new Event('universe-progress')); }
function discover(id) { discovered.add(id); writeLocal('discoveries', [...discovered]); document.dispatchEvent(new Event('universe-progress')); }
function vibrate() { try {
    navigator.vibrate?.(18);
}
catch { } }
class UniverseScene {
    suspend() { if (this.frame !== null)
        cancelAnimationFrame(this.frame); this.frame = null; clearTimeout(this.backup); this.backup = 0; this.last = this.lastRaf = 0; this.samples = this.sum = this.pressure = 0; this.lastMeasure = performance.now(); this.calmWindows = 0; }
    constructor(world) {
        this.world = world;
        this.stage = node('div', 'u-stage');
        this.canvas = node('canvas', 'u-canvas');
        this.overlay = node('div', 'u-overlay');
        this.ctx = this.canvas.getContext('2d');
        this.gpu = null;
        this.atelier = null;
        this.observer = null;
        this.visible = true;
        this.pressure = 0;
        this.budget = 1;
        this.samples = 0;
        this.sum = 0;
        this.lastMeasure = 0;
        this.calmWindows = 0;
        this.frame = null;
        this.backup = 0;
        this.lastRaf = 0;
        this.last = 0;
        this.time = 0;
        this.dead = false;
        this.heartbeat = 0;
        this.watchdog = 0;
        this.frames = 0;
        this.lastReport = 0;
        this.lastError = false;
        this.w = 1;
        this.h = 1;
        this.dpr = 1;
        this.cyaw = 1;
        this.syaw = 0;
        this.cpitch = 1;
        this.spitch = 0;
        this.yaw = 0;
        this.pitch = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.tiltOn = false;
        this.stars = Array.from({ length: 112 }, (_, i) => ({ x: Math.sin(i * 127.1) * 2.4, y: Math.cos(i * 71.9) * 1.55, z: (i * .61803398875) % 1 * 8, s: (i * .377) % 1 }));
        this.orientation = (e) => { if (e.gamma !== null && e.beta !== null) {
            this.targetX = clampU(e.gamma / 45, -1, 1);
            this.targetY = clampU((e.beta - 45) / 60, -1, 1);
        } };
        this.onVisibility = () => { this.last = 0; this.checkVisibility(); };
        this.checkVisibility = () => { if (this.dead)
            return; const r = this.stage.getBoundingClientRect(); const dialog = this.stage.closest('.exp-dialog'); const d = dialog?.getBoundingClientRect(); this.visible = this.stage.isConnected && r.width > 0 && r.height > 0 && r.bottom > Math.max(0, (d?.top ?? 0)) - 40 && r.top < Math.min(innerHeight, (d?.bottom ?? innerHeight)) + 40 && r.right > 0 && r.left < innerWidth; if (this.visible && !document.hidden) {
            this.wake();
        }
        else
            this.suspend(); };
        this.backupTick = () => { this.backup = 0; if (this.dead || !this.visible || document.hidden)
            return; this.tick(performance.now()); if (performance.now() - this.lastRaf > 600)
            this.backup = window.setTimeout(this.backupTick, 33); };
        this.revive = () => { if (this.dead)
            return; this.checkVisibility(); if (this.visible && !document.hidden && performance.now() - this.lastRaf > 600) {
            if (this.frame !== null)
                cancelAnimationFrame(this.frame);
            this.frame = null;
            this.wake();
            if (!this.backup)
                this.backup = window.setTimeout(this.backupTick, 33);
        } };
        this.value = 0;
        this.pulse = 0;
        this.flowers = [];
        this.lanterns = [];
        this.onFrame = (now) => { this.frame = null; clearTimeout(this.backup); this.backup = 0; this.lastRaf = performance.now(); this.tick(now); };
        this.tick = (now) => {
            if (this.dead || document.hidden || !this.visible)
                return;
            this.heartbeat = performance.now();
            const elapsed = this.last ? now - this.last : 0;
            const dt = Math.min(.10, Math.max(0, elapsed / 1000));
            this.last = now;
            if (!reduced()) {
                this.time += dt;
                const blend = 1 - Math.exp(-dt * (this.atelier ? 3.8 : 5));
                this.yaw += (this.targetX - this.yaw) * blend;
                this.pitch += (this.targetY - this.pitch) * blend;
            }
            this.pulse = Math.max(0, this.pulse - dt);
            const drift = this.atelier && !reduced() ? Math.sin(this.time * .31) * .035 + Math.sin(this.time * .13) * .018 : 0;
            const rise = this.atelier && !reduced() ? Math.sin(this.time * .23) * .018 + Math.sin(this.time * .41) * .006 : 0;
            this.cyaw = Math.cos(this.yaw * .14 + drift);
            this.syaw = Math.sin(this.yaw * .14 + drift);
            this.cpitch = Math.cos(this.pitch * .09 + rise);
            this.spitch = Math.sin(this.pitch * .09 + rise);
            const start = performance.now();
            try {
                this.draw();
                this.lastError = false;
            }
            catch (error) {
                if (!this.lastError)
                    console.warn('NOA: recuperando cena', this.world, error);
                this.lastError = true;
                if (this.gpu) {
                    this.gpu.dispose();
                    this.gpu = null;
                }
            }
            finally {
                this.frames++;
                if (now - this.lastReport >= 250) {
                    this.stage.dataset.sceneTime = this.time.toFixed(3);
                    this.stage.dataset.sceneFrames = String(this.frames);
                    this.lastReport = now;
                }
                const cost = performance.now() - start;
                this.samples++;
                this.sum += cost;
                if (elapsed > 23 && elapsed < 250)
                    this.pressure++;
                if (now - this.lastMeasure >= 1200 && this.samples >= 12) {
                    const avg = this.sum / this.samples, ratio = this.pressure / this.samples;
                    if (avg > (this.world === 'palace' ? 10.5 : 12) || ratio > .35) {
                        this.budget = Math.max(.60, this.budget - .12);
                        this.calmWindows = 0;
                    }
                    else if (avg < 7 && ratio < .12) {
                        if (++this.calmWindows >= 3) {
                            this.budget = Math.min(1, this.budget + .06);
                            this.calmWindows = 0;
                        }
                    }
                    else
                        this.calmWindows = 0;
                    this.stage.dataset.renderScale = this.budget.toFixed(2);
                    this.stage.dataset.frameCost = avg.toFixed(2);
                    this.samples = this.sum = this.pressure = 0;
                    this.lastMeasure = now;
                }
                this.wake();
            }
        };
        this.planetTexture = null;
        this.stage.dataset.world = world;
        if (atelier_1.ATELIER_WORLDS.some(w => w.id === world))
            this.atelier = new atelier_1.Atelier(world);
        this.canvas.setAttribute('aria-hidden', 'true');
        this.stage.append(this.canvas, this.overlay);
        if (['space', 'portal', 'aurora'].includes(world)) {
            this.gpu = new stellar_1.StellarRenderer(world === 'space' ? 0 : world === 'portal' ? 1 : 2);
            this.stage.prepend(this.gpu.canvas);
        }
        this.stage.addEventListener('pointermove', e => { if (!e.isPrimary || this.tiltOn)
            return; const r = this.stage.getBoundingClientRect(); this.targetX = clampU((e.clientX - r.left) / r.width * 2 - 1, -1, 1); this.targetY = clampU((e.clientY - r.top) / r.height * 2 - 1, -1, 1); }, { passive: true });
        this.stage.addEventListener('pointerleave', () => { if (!this.tiltOn)
            this.targetX = this.targetY = 0; });
        this.stage.addEventListener('pointerdown', e => { if (!e.isPrimary || this.tiltOn)
            return; const r = this.stage.getBoundingClientRect(); this.targetX = clampU((e.clientX - r.left) / r.width * 2 - 1, -1, 1); this.targetY = clampU((e.clientY - r.top) / r.height * 2 - 1, -1, 1); }, { passive: true });
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver(this.checkVisibility, { rootMargin: '40px' });
            this.observer.observe(this.stage);
        }
        document.addEventListener('visibilitychange', this.onVisibility);
        document.addEventListener('noa-motion-change', this.onVisibility);
        window.addEventListener('pageshow', this.onVisibility);
        window.addEventListener('focus', this.onVisibility);
        window.addEventListener('resize', this.checkVisibility, { passive: true });
        document.addEventListener('scroll', this.checkVisibility, { capture: true, passive: true });
        this.watchdog = window.setInterval(this.revive, 600);
        queueMicrotask(this.checkVisibility);
    }
    async tilt() { if (this.tiltOn) {
        this.tiltOn = false;
        window.removeEventListener('deviceorientation', this.orientation);
        this.targetX = this.targetY = 0;
        return 'Ativar inclinação';
    } try {
        const api = window.DeviceOrientationEvent;
        if (!api)
            return 'Inclinação indisponível';
        if (api.requestPermission && await api.requestPermission() !== 'granted')
            return 'Permissão não concedida';
        if (this.dead)
            return 'Inclinação indisponível';
        window.addEventListener('deviceorientation', this.orientation);
        this.tiltOn = true;
        return 'Desativar inclinação';
    }
    catch {
        return 'Inclinação indisponível';
    } }
    stop() { this.dead = true; this.suspend(); clearInterval(this.watchdog); this.gpu?.dispose(); this.observer?.disconnect(); document.removeEventListener('visibilitychange', this.onVisibility); document.removeEventListener('noa-motion-change', this.onVisibility); window.removeEventListener('pageshow', this.onVisibility); window.removeEventListener('focus', this.onVisibility); window.removeEventListener('resize', this.checkVisibility); document.removeEventListener('scroll', this.checkVisibility, true); window.removeEventListener('deviceorientation', this.orientation); this.planetTexture?.dispose(); this.atelier?.dispose(); this.atelier = null; this.canvas.width = this.canvas.height = 1; }
    wake() { if (this.frame === null && !this.dead && this.visible && !document.hidden) {
        if (!this.lastRaf)
            this.lastRaf = performance.now();
        this.frame = requestAnimationFrame(this.onFrame);
    } }
    project([x, y, z]) { const xx = x * this.cyaw + z * this.syaw, zz = z * this.cyaw - x * this.syaw; const yy = y * this.cpitch - zz * this.spitch, depth = zz * this.cpitch + y * this.spitch; const scale = Math.min(this.w, this.h) * .91 / (3.4 + Math.max(-1.8, depth)); return { x: this.w / 2 + xx * scale, y: this.h * .50 + yy * scale, k: scale, z: depth }; }
    dot(p, r, color, glow = false) { const c = this.ctx, q = this.project(p); const size = Math.max(.6, r * q.k); c.fillStyle = color; if (glow) {
        c.shadowColor = color;
        c.shadowBlur = Math.min(16, size * 3);
    } c.beginPath(); c.arc(q.x, q.y, size, 0, TAU); c.fill(); c.shadowBlur = 0; }
    line(a, b, color, width = 1) { const c = this.ctx, p = this.project(a), q = this.project(b); c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke(); }
    poly(points, fill, stroke = 'rgba(255,224,238,.2)') { const c = this.ctx; c.beginPath(); points.forEach((p, i) => { const q = this.project(p); if (i)
        c.lineTo(q.x, q.y);
    else
        c.moveTo(q.x, q.y); }); c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = stroke; c.lineWidth = .65; c.stroke(); }
    ring(center, r, tilt, color, phase = 0) { const c = this.ctx; c.beginPath(); for (let i = 0; i <= 72; i++) {
        const a = i / 72 * TAU + phase;
        const q = this.project([center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r * Math.cos(tilt), center[2] + Math.sin(a) * r * Math.sin(tilt)]);
        if (i)
            c.lineTo(q.x, q.y);
        else
            c.moveTo(q.x, q.y);
    } c.strokeStyle = color; c.lineWidth = 1.1; c.stroke(); }
    sphere(center, r, hue, t) {
        const c = this.ctx, q = this.project(center), rr = q.k * r, low = document.documentElement.dataset.q === 'low';
        this.planetTexture ?? (this.planetTexture = new planet_1.PlanetTexture());
        const size = low ? 144 : 240;
        const rate = this.budget < .77 ? (low ? 14 : 18) : (low ? 18 : 24);
        const surface = this.planetTexture.draw(hue, t, size, rate);
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = low ? 'low' : 'high';
        const halo = c.createRadialGradient(q.x, q.y, rr * .78, q.x, q.y, rr * 1.42);
        halo.addColorStop(0, `hsla(${hue} 64% 65% / .24)`);
        halo.addColorStop(.68, `hsla(${hue} 72% 64% / .09)`);
        halo.addColorStop(1, `hsla(${hue} 72% 64% / 0)`);
        c.fillStyle = halo;
        c.fillRect(q.x - rr * 1.42, q.y - rr * 1.42, rr * 2.84, rr * 2.84);
        const angle = -.30 + .21 * Math.sin(t * .62) + this.yaw * .10, flatten = .34 + .085 * Math.sin(t * .46 + .7);
        const rings = (front) => {
            c.save();
            c.translate(q.x, q.y);
            c.rotate(angle);
            for (let i = 0; i < 22; i++) {
                if (i === 8 || i === 9 || i === 17)
                    continue;
                const radius = rr * (1.20 + i * .029), a = .12 + .18 * (.5 + .5 * Math.sin(i * 2.11));
                c.beginPath();
                c.ellipse(0, 0, radius, radius * flatten, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
                c.strokeStyle = `hsla(${hue + 28 + i * .8} ${25 + i % 4 * 9}% ${58 + i % 5 * 5}% / ${a})`;
                c.lineWidth = Math.max(.45, rr * .022);
                c.stroke();
            }
            for (let i = 0; i < (low ? 14 : 27); i++) {
                const radius = rr * (1.22 + (i * .618 % 1) * .58), a = (i * 2.399 + t * (.25 + (i % 4) * .035)) % TAU;
                if ((a < Math.PI) !== front)
                    continue;
                const x = Math.cos(a) * radius, y = Math.sin(a) * radius * flatten;
                c.fillStyle = i % 5 ? '#ead5c28c' : '#fff5dc';
                c.fillRect(x, y, i % 5 ? .9 : 1.7, i % 5 ? .9 : 1.7);
            }
            c.restore();
        };
        rings(false);
        c.drawImage(surface, q.x - rr, q.y - rr, rr * 2, rr * 2);
        c.save();
        c.beginPath();
        c.arc(q.x, q.y, rr * .998, 0, TAU);
        c.clip();
        c.translate(q.x, q.y);
        c.rotate(angle);
        const shade = c.createLinearGradient(0, rr * .04, 0, rr * .32);
        shade.addColorStop(0, '#100c2000');
        shade.addColorStop(.44, '#100c2034');
        shade.addColorStop(1, '#100c2000');
        c.fillStyle = shade;
        c.fillRect(-rr, rr * .04, rr * 2, rr * .28);
        c.restore();
        rings(true);
    }
    crystal(center, r, t, hue = 330) {
        if (r <= .001)
            return;
        const [x, y, z] = center, c = this.ctx, low = document.documentElement.dataset.q === 'low';
        const p = [];
        for (let i = 0; i < 8; i++) {
            const a = t + i * TAU / 8;
            p.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]);
        }
        const faces = [];
        for (let i = 0; i < 8; i++) {
            const j = (i + 1) % 8;
            for (const sign of [-1, 1]) {
                const a = p[i], b = p[j], d = [x, y + sign * r * 1.6, z], u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
                const nx = (u[1] * v[2] - u[2] * v[1]) * sign, ny = (u[2] * v[0] - u[0] * v[2]) * sign, nz = (u[0] * v[1] - u[1] * v[0]) * sign, mag = Math.hypot(nx, ny, nz) || 1;
                const lambert = Math.max(0, (-.49 * nx - .65 * ny - .58 * nz) / mag), fresnel = Math.pow(1 - Math.abs(nz / mag), 3), spec = Math.pow(Math.max(0, (-.25 * nx - .34 * ny - .90 * nz) / mag), 18);
                const q = [a, b, d].map(v => this.project(v));
                faces.push({ q, z: (q[0].z + q[1].z + q[2].z) / 3, light: 29 + lambert * 43 + spec * 21, rim: fresnel, hue: hue + fresnel * 17 + (sign < 0 ? 4 : -7) });
            }
        }
        faces.sort((a, b) => b.z - a.z);
        for (const f of faces) {
            const q = f.q;
            c.beginPath();
            c.moveTo(q[0].x, q[0].y);
            c.lineTo(q[1].x, q[1].y);
            c.lineTo(q[2].x, q[2].y);
            c.closePath();
            const L = f.light;
            if (!low && r > .16) {
                const g = c.createLinearGradient(q[0].x, q[0].y, q[2].x, q[2].y);
                g.addColorStop(0, `hsl(${f.hue + 12} 76% ${Math.min(92, L + 14 + f.rim * 13)}%)`);
                g.addColorStop(.46, `hsl(${f.hue} 64% ${L}%)`);
                g.addColorStop(1, `hsl(${f.hue - 13} 50% ${Math.max(13, L - 19)}%)`);
                c.fillStyle = g;
            }
            else
                c.fillStyle = `hsl(${f.hue} 64% ${L}%)`;
            c.fill();
            c.strokeStyle = `hsla(${f.hue + 17} 80% 87% / ${.11 + f.rim * .29})`;
            c.lineWidth = .65;
            c.stroke();
        }
    }
    plant() { const n = this.flowers.length; this.flowers.push({ x: Math.sin(n * 2.4) * 1.22, z: 1 + (n % 4) * .55, born: this.time }); if (this.flowers.length > 14)
        this.flowers.shift(); this.pulse = 1; }
    launch() { const n = this.lanterns.length; this.lanterns.push({ x: Math.sin(n * 2.4) * 1.25, z: .5 + (n % 4) * .7, born: this.time }); if (this.lanterns.length > 16)
        this.lanterns.shift(); this.pulse = 1; }
    draw() {
        const c = this.ctx;
        if (!c)
            return;
        const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
        if (!w || !h)
            return;
        const cap = document.documentElement.dataset.q === 'low' ? 1 : 1.6;
        const dpr = Math.min(devicePixelRatio || 1, cap * this.budget, Math.sqrt(800000 / (w * h)));
        if (w !== this.w || h !== this.h || dpr !== this.dpr) {
            this.w = w;
            this.h = h;
            this.dpr = dpr;
            this.canvas.width = Math.max(1, Math.round(w * dpr));
            this.canvas.height = Math.max(1, Math.round(h * dpr));
            c.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        const t = this.time;
        const gpu = this.gpu?.draw(w, h, t, this.yaw, this.pitch, this.value, this.pulse, document.documentElement.dataset.q === 'low', this.budget) ?? false;
        this.stage.dataset.renderer = gpu ? 'webgl' : 'canvas';
        if (this.gpu && !gpu)
            this.gpu.canvas.hidden = true;
        c.clearRect(0, 0, w, h);
        const green = this.world === 'garden', gold = this.world === 'lantern' || this.world === 'music';
        if (!gpu) {
            const bg = c.createLinearGradient(0, 0, w, h);
            bg.addColorStop(0, green ? '#142b35' : '#100e25');
            bg.addColorStop(.52, gold ? '#392236' : '#292042');
            bg.addColorStop(1, '#090b1b');
            c.fillStyle = bg;
            c.fillRect(0, 0, w, h);
        }
        const glow = c.createRadialGradient(w * .5, h * .46, 0, w * .5, h * .46, w * .63);
        glow.addColorStop(0, green ? '#6ba18b45' : gold ? '#e0a2643b' : '#d67cc347');
        glow.addColorStop(1, '#100e2500');
        c.fillStyle = glow;
        c.fillRect(0, 0, w, h);
        for (let i = 0; i < (gpu ? 0 : 3); i++) {
            const x = w * (.22 + i * .28 + Math.sin(t * .12 + i) * .04), y = h * (.28 + i * .18 + Math.cos(t * .16 + i) * .06), r = Math.min(w, h) * (.32 + i * .06);
            const fog = c.createRadialGradient(x, y, 0, x, y, r);
            fog.addColorStop(0, i === 1 ? '#b778d32b' : green ? '#79bf9a20' : '#f2a3ce20');
            fog.addColorStop(1, '#00000000');
            c.fillStyle = fog;
            c.fillRect(x - r, y - r, r * 2, r * 2);
        }
        const count = Math.min(this.stars.length, Math.round((document.documentElement.dataset.q === 'low' ? 48 : 112) * this.budget * (gpu ? .4 : 1)));
        for (let i = 0; i < count; i++) {
            const s = this.stars[i], z = (s.z + 8 - t * .18 % 8) % 8;
            this.dot([s.x * (1 + z * .16), s.y * (1 + z * .15), z], .008 + s.s * .014, `rgba(255,${205 + Math.round(s.s * 45)},${213 + Math.round(s.s * 40)},${.25 + .5 * (.5 + .5 * Math.sin(t * 1.4 + i))})`, i % 17 === 0);
        }
        switch (this.world) {
            case 'portal':
            case 'finale': {
                for (let i = 8; i >= 0; i--) {
                    const z = (i * .72 + 6.5 - t * (.48 + this.value * .22) % 6.5) % 6.5;
                    const r = 1.12 + .10 * Math.sin(t + i);
                    this.ring([0, 0, z], r, .10 * Math.sin(t * .5 + i), 'rgba(247,181,221,.32)', t);
                    for (let j = 0; j < 14; j++) {
                        const a = j * TAU / 14 + t * .45 + i * .31;
                        this.dot([Math.cos(a) * r, Math.sin(a) * r, z], .025, j % 3 ? '#ed9acb' : '#ffebba', j % 4 === 0);
                    }
                }
                this.crystal([0, 0, .65], .34 + this.pulse * .13, t * .55);
                break;
            }
            case 'garden': {
                for (let i = 0; i < 9; i++) {
                    const z = i * .62;
                    this.line([-2, 1.08, z], [2, 1.08, z], '#b9d4bf28');
                }
                const flowers = [...Array.from({ length: 7 }, (_, i) => ({ x: Math.sin(i * 2.4) * 1.4, z: .7 + i * .55, born: -10 })), ...this.flowers].sort((a, b) => b.z - a.z);
                flowers.forEach((f, i) => { const growth = reduced() ? 1 : clampU((t - f.born) / .9, 0, 1), stem = .48 + (.25 * (i % 3)); const x = f.x + Math.sin(t * .8 + i) * .045; const y = 1.04 - stem * growth; this.line([f.x, 1.04, f.z], [x, y, f.z], '#9bc7ac', 2); for (let j = 0; j < 5; j++) {
                    const a = j * TAU / 5 + t * .12;
                    this.crystal([x + Math.cos(a) * .115 * growth, y + Math.sin(a) * .10 * growth, f.z], .075 * growth, t * .2 + j, 315 + i % 3 * 12);
                } this.dot([x, y, f.z - .03], .055 * growth, '#fff0c0', true); });
                for (let i = 0; i < 5; i++) {
                    const x = Math.sin(t * .45 + i * 2.2) * 1.4, y = Math.cos(t * .7 + i) * .45 - .35, z = 1 + i * .5;
                    const wing = .05 + .04 * Math.abs(Math.sin(t * 8 + i));
                    this.poly([[x, y, z], [x - wing, y - .09, z], [x - .035, y + .035, z]], '#c9d8ffb0');
                    this.poly([[x, y, z], [x + wing, y - .09, z], [x + .035, y + .035, z]], '#f5b6d6b0');
                }
                break;
            }
            case 'space': {
                const hues = [330, 203, 270, 42], center = [Math.sin(t * .58) * .22, -.06 + Math.cos(t * .73) * .10, .62 + .10 * Math.sin(t * .37)];
                const moons = Array.from({ length: 3 }, (_, i) => { const a = t * (.66 + i * .12) + i * TAU / 3; return { p: [center[0] + Math.cos(a) * (1.69 + i * .11), center[1] + Math.sin(a) * .59, center[2] + Math.sin(a) * 1.42], r: .065 + i * .024, color: ['#eac8ff', '#e5a4c9', '#ffe2a2'][i] }; });
                const moon = (m) => { const q = this.project(m.p), r = q.k * m.r, g = c.createRadialGradient(q.x - r * .28, q.y - r * .34, r * .04, q.x, q.y, r); g.addColorStop(0, '#fff3dd'); g.addColorStop(.35, m.color); g.addColorStop(1, '#392339'); c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, r, 0, TAU); c.fill(); };
                if (!gpu) {
                    moons.filter(m => m.p[2] > center[2]).forEach(moon);
                    this.sphere(center, 1.14, hues[this.value % 4], t);
                    moons.filter(m => m.p[2] <= center[2]).forEach(moon);
                }
                break;
            }
            case 'lantern': {
                const all = [...Array.from({ length: 6 }, (_, i) => ({ x: Math.sin(i * 3) * 1.4, z: i * .7 + .8, born: -i * 3 })), ...this.lanterns];
                all.sort((a, b) => b.z - a.z).forEach((l, i) => { const y = 1.15 - ((t - l.born) * .17 % 2.5), x = l.x + Math.sin(t * .6 + i) * .08, z = l.z, r = .12; this.poly([[x - r, y - r, z], [x + r, y - r, z], [x + r * .72, y + r, z], [x - r * .72, y + r, z]], '#e7a963cf', '#ffe9ba'); this.poly([[x + r, y - r, z], [x + r, y - r, z + .16], [x + r * .72, y + r, z + .16], [x + r * .72, y + r, z]], '#95603edb'); this.dot([x, y + .08, z - .01], .045, '#ffefbe', true); });
                break;
            }
            case 'museum': {
                for (let i = 1; i < 9; i++) {
                    const z = i * .68;
                    this.line([-1.8, 1, z], [1.8, 1, z], '#e7c4a34d');
                    this.line([-1.8, -1, z], [-1.8, 1, z], '#b58cad4d');
                    this.line([1.8, -1, z], [1.8, 1, z], '#b58cad4d');
                }
                for (const x of [-1.8, -.9, 0, .9, 1.8])
                    this.line([x, 1, 0], [x, 1, 6], '#d4afc94d');
                break;
            }
            case 'music': {
                this.ring([0, .30, 1], 1.05, 1.2, '#f8d9ad88', t);
                for (let i = 0; i < 16; i++) {
                    const a = i * TAU / 16 + t * .45;
                    this.crystal([Math.cos(a) * .83, .36, 1 + Math.sin(a) * .83], .055, t, 44);
                }
                this.crystal([0, -.24, 1], .28, t * .85, 42);
                break;
            }
            case 'aurora': {
                if (!gpu) {
                    for (let i = 0; i < 5; i++) {
                        c.beginPath();
                        for (let x = 0; x <= w; x += 4) {
                            const y = h * (.18 + i * .105) + Math.sin(x / w * 6 + t * .6 + i) * h * .1 + Math.sin(x / w * 16 - t * .4) * h * .035;
                            if (x === 0)
                                c.moveTo(x, y);
                            else
                                c.lineTo(x, y);
                        }
                        c.strokeStyle = ['#65f3cb', '#a7efdb', '#c4a1ef', '#dd8fe8', '#f2b0cc'][i];
                        c.globalAlpha = .37;
                        c.lineWidth = 8 + i * 2;
                        c.shadowColor = c.strokeStyle;
                        c.shadowBlur = 15;
                        c.stroke();
                        c.shadowBlur = 0;
                        c.globalAlpha = 1;
                    }
                }
                break;
            }
            case 'puzzle':
            case 'book':
            case 'calendar':
            case 'guide': {
                this.ring([0, .3, 1], 1.05, 1.2, '#e4bcdf70', t);
                this.crystal([0, -.25, 2], .28, t * .5, 285);
                break;
            }
            case 'palace':
            case 'islands':
            case 'rose':
            case 'clock':
            case 'butterflies':
            case 'ocean': {
                this.atelier?.render(c, w, h, t, this.value, this.pulse, p => this.project(p), document.documentElement.dataset.q === 'low');
                break;
            }
            case 'stars':
            case 'path': {
                for (let i = 0; i < 5; i++)
                    this.ring([0, 0, i * 1.2], .94 + i * .08, Math.sin(t * .2 + i) * .6, '#ad8cc83c', t);
                break;
            }
        }
    }
}
class MusicBox {
    constructor() {
        this.ctx = null;
        this.timer = 0;
        this.index = 0;
        this.voices = new Set();
        this.gain = null;
        this.closed = false;
        this.generation = 0;
    }
    async start() { if (this.closed)
        return; const gen = ++this.generation; const C = window.AudioContext || window.webkitAudioContext; if (!C)
        throw Error('Áudio indisponível'); this.ctx ?? (this.ctx = new C()); await this.ctx.resume(); if (this.closed || gen !== this.generation)
        return; if (!this.gain) {
        this.gain = this.ctx.createGain();
        this.gain.gain.value = .10;
        this.gain.connect(this.ctx.destination);
    } this.stopTimer(); const notes = [60, 67, 72, 74, 69, 67, 64, 72, 65, 69, 76, 74, 67, 71, 74, 72]; const step = () => { if (!this.ctx || !this.gain || document.hidden)
        return; const n = this.index++ % notes.length, now = this.ctx.currentTime; const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'sine'; o.frequency.value = 440 * 2 ** ((notes[n] - 69) / 12); g.gain.setValueAtTime(.001, now); g.gain.exponentialRampToValueAtTime(.7, now + .012); g.gain.exponentialRampToValueAtTime(.001, now + .85); o.connect(g); let panner = null; if (typeof this.ctx.createStereoPanner === 'function') {
        const p = panner = this.ctx.createStereoPanner();
        p.pan.value = Math.sin(n * .65) * .42;
        g.connect(p);
        p.connect(this.gain);
    }
    else
        g.connect(this.gain); this.voices.add(o); o.onended = () => { this.voices.delete(o); o.disconnect(); g.disconnect(); panner?.disconnect(); }; o.start(now); o.stop(now + .87); }; step(); this.timer = window.setInterval(step, 440); }
    stopTimer() { clearInterval(this.timer); this.timer = 0; for (const o of this.voices) {
        try {
            o.stop();
        }
        catch { }
    } this.voices.clear(); }
    pause() { this.generation++; this.stopTimer(); void this.ctx?.suspend().catch(() => { }); }
    dispose() { this.generation++; this.closed = true; this.stopTimer(); void this.ctx?.close().catch(() => { }); }
}
function photo(item) { const img = node('img', 'u-photo'); img.src = item.src; img.alt = item.alt || item.cap || 'Arte da galeria'; img.decoding = 'async'; return img; }
function localDay() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function textRecords(key) { const raw = readLocal(key, []); return Array.isArray(raw) ? raw.filter(v => v && typeof v.text === 'string' && v.text.length <= 300 && (!v.date || /^\d{4}-\d{2}-\d{2}$/.test(v.date))).slice(-30) : []; }
function mountUniverse(id, panel, navigate) {
    const scene = new UniverseScene(id);
    const status = node('p', 'u-status');
    status.setAttribute('role', 'status');
    const controls = node('div', 'u-controls');
    const extra = node('div', 'u-extra');
    const cleanups = [() => scene.stop()];
    const set = (s) => { status.textContent = s; };
    const complete = (s) => { discover(id); scene.pulse = 1; vibrate(); set(s); };
    const add = (label, fn) => controls.append(action(label, fn));
    const badge = node('span', 'u-chapter', `NOA / ${String(exports.WORLDS.findIndex(w => w.id === id) + 1).padStart(2, '0')}`);
    scene.overlay.append(badge);
    panel.body.append(scene.stage, status, controls, extra);
    const tilt = action('Ativar inclinação', () => { void scene.tilt().then(s => { tilt.textContent = s; }); }, 'u-subtle');
    extra.append(tilt);
    switch (id) {
        case 'portal': {
            const mark = node('div', 'u-portal-title', 'THE UNIVERSE OF YOU');
            scene.overlay.append(mark);
            add('Atravessar o portal', () => { scene.value = 1; complete('Você chegou. Este universo é seu. ♡'); mark.textContent = 'BEM-VINDA, NOA'; });
            add('Visitar o jardim', () => navigate('garden'));
            set('Um lugar para voltar sempre que quiser.');
            break;
        }
        case 'garden': {
            let n = 0;
            const plant = () => { scene.plant(); complete(wishes[n++ % wishes.length]); };
            add('Cultivar uma flor', plant);
            scene.canvas.addEventListener('click', plant);
            set('Toque no jardim ou cultive uma flor para revelar uma mensagem.');
            break;
        }
        case 'book': {
            const pages = config_1.CONFIG.chapters.flatMap(ch => ch.p.map(p => ({ title: ch.title, text: p.t })));
            let i = 0;
            const cover = node('div', 'u-book');
            const sheet = node('article', 'u-sheet');
            const title = node('h4'), p = node('p'), num = node('small');
            sheet.append(title, p, num);
            cover.append(sheet);
            scene.overlay.append(cover);
            const show = (dir) => { i = clampU(i + dir, 0, pages.length - 1); title.textContent = pages[i].title; p.textContent = pages[i].text; num.textContent = `${i + 1} / ${pages.length}`; sheet.scrollTop = 0; sheet.classList.remove('u-turn'); void sheet.offsetWidth; sheet.classList.add('u-turn'); set(`Página ${i + 1} de ${pages.length}`); if (dir)
                discover(id); prev.disabled = i === 0; next.disabled = i === pages.length - 1; };
            const prev = action('‹ Anterior', () => show(-1)), next = action('Próxima ›', () => show(1));
            controls.append(prev, next);
            show(0);
            break;
        }
        case 'museum':
        case 'finale': {
            let i = 0;
            let playing = false;
            let timer = 0;
            const frame = node('div', 'u-gallery-frame');
            scene.overlay.append(frame);
            const images = id === 'museum' ? arts : config_1.CONFIG.gallery.filter(g => g.kind === 'desenhos').slice(0, 10);
            const captions = id === 'finale' ? [config_1.CONFIG.greeting, ...wishes, config_1.CONFIG.finalLine1, config_1.CONFIG.finalLine2] : [];
            const show = (dir) => { i = (i + dir + images.length) % images.length; frame.replaceChildren(photo(images[i])); frame.classList.remove('u-enter'); void frame.offsetWidth; frame.classList.add('u-enter'); set(id === 'finale' ? (captions[i % captions.length] || '♡') : `Obra ${i + 1} de ${images.length} · ${images[i].alt || 'Arte da Noa'}`); if (dir)
                discover(id); };
            add('‹ Anterior', () => show(-1));
            add('Próxima ›', () => show(1));
            if (id === 'finale') {
                const play = action('▶ Iniciar sequência', () => { playing = !playing; play.textContent = playing ? 'Ⅱ Pausar' : '▶ Continuar'; clearInterval(timer); if (playing) {
                    discover(id);
                    timer = window.setInterval(() => { if (!document.hidden) {
                        if (i === images.length - 1) {
                            clearInterval(timer);
                            playing = false;
                            play.textContent = '▶ Recomeçar';
                            complete(config_1.CONFIG.finalLine2);
                            return;
                        }
                        show(1);
                    } }, 4200);
                    if (i === images.length - 1)
                        show(1);
                } });
                controls.append(play);
                cleanups.push(() => clearInterval(timer));
            }
            show(0);
            break;
        }
        case 'space': {
            const names = ['Rosa dos sonhos', 'Azul da calma', 'Violeta da criatividade', 'Dourado das pequenas alegrias'];
            const show = (i) => { scene.value = i; complete(`${names[i]} · ${wishes[i]}`); };
            names.forEach((name, i) => add(name, () => show(i)));
            set('Escolha um planeta para descobrir o que ele guarda.');
            break;
        }
        case 'music': {
            const box = node('div', 'u-music-box');
            box.append(node('i', 'u-box-lid'), node('i', 'u-box-base'), node('span', 'u-box-jewel', '✧'));
            scene.overlay.append(box);
            const music = new MusicBox();
            let open = false;
            const b = action('Abrir e tocar', () => { open = !open; box.classList.toggle('is-open', open); b.textContent = open ? 'Fechar e pausar' : 'Abrir e tocar'; if (open) {
                complete('Uma pequena melodia original para acompanhar este momento.');
                void music.start().catch(() => set('A caixa está aberta. O áudio não está disponível neste navegador.'));
            }
            else
                music.pause(); });
            const hide = () => { if (document.hidden && open) {
                open = false;
                music.pause();
                box.classList.remove('is-open');
                b.textContent = 'Abrir e tocar';
            } };
            document.addEventListener('visibilitychange', hide);
            cleanups.push(() => { document.removeEventListener('visibilitychange', hide); music.dispose(); });
            controls.append(b);
            set('O som começa somente quando você toca no botão.');
            break;
        }
        case 'lantern': {
            const input = node('textarea', 'exp-input u-input');
            input.placeholder = 'Escreva um desejo…';
            input.maxLength = 300;
            input.setAttribute('aria-label', 'Seu desejo');
            const list = node('div', 'u-records');
            let records = textRecords('lanterns');
            const render = () => { list.replaceChildren(...records.slice(-5).reverse().map(r => node('p', 'u-record', r.text))); };
            const send = () => { const text = input.value.trim(); if (!text) {
                set('Escreva um desejo antes de soltar a lanterna.');
                return;
            } records = [...records, { text }].slice(-30); writeLocal('lanterns', records); input.value = ''; scene.launch(); render(); complete('Sua lanterna encontrou o céu. O desejo ficou guardado neste aparelho.'); };
            extra.append(input, action('Soltar lanterna', send), list);
            render();
            set('As lanternas sobem pelo céu. Seus desejos não são enviados a nenhum servidor.');
            break;
        }
        case 'stars': {
            let score = 0;
            const target = action('✦', () => { if (score >= 8)
                return; score++; scene.pulse = 1; vibrate(); if (score >= 8) {
                target.hidden = true;
                complete('8/8 estrelas — constelação completa!');
            }
            else {
                position();
                set(`${score}/8 estrelas coletadas`);
            } }, 'u-star-target');
            target.setAttribute('aria-label', 'Coletar estrela');
            target.replaceChildren((0, motion_1.uiGlyph)('✦'), node('span', 'noa-star-halo'));
            const position = () => { target.style.left = `${25 + (Math.sin(score * 2.4) + 1) * 25}%`; target.style.top = `${28 + (Math.cos(score * 2.4) + 1) * 20}%`; };
            scene.overlay.append(target);
            const restart = () => { score = 0; target.hidden = false; position(); set('0/8 estrelas coletadas'); };
            add('Jogar novamente', restart);
            restart();
            break;
        }
        case 'path': {
            let sequence = [], cursor = 0, ready = false;
            let timers = [];
            const clear = () => { timers.forEach(clearTimeout); timers = []; };
            cleanups.push(clear);
            const board = node('div', 'u-path-board');
            const keys = Array.from({ length: 4 }, (_, i) => action(['✦', '◇', '☾', '✿'][i], () => { if (!ready)
                return; if (i !== sequence[cursor]) {
                (0, motion_1.pulseMotion)(keys[i]);
                ready = false;
                set('Quase! Observe a sequência e tente novamente.');
                return;
            } (0, motion_1.pulseMotion)(keys[i]); cursor++; vibrate(); if (cursor === sequence.length) {
                ready = false;
                complete('Constelação decifrada! ♡');
            }
            else
                set(`${cursor}/${sequence.length} estrelas na ordem certa`); }, 'u-path-key'));
            keys.forEach((b, i) => { b.replaceChildren((0, motion_1.uiGlyph)(['✦', '◇', '☾', '✿'][i])); b.setAttribute('aria-label', `Estrela ${i + 1}`); board.append(b); });
            scene.overlay.append(board);
            const start = () => { clear(); ready = false; cursor = 0; sequence = Array.from({ length: 4 }, () => Math.floor(Math.random() * 4)); keys.forEach(b => { b.classList.remove('lit'); b.disabled = true; }); set('Observe as estrelas na ordem em que brilham.'); if (reduced()) {
                set(`Ordem: ${sequence.map(i => i + 1).join(' · ')}`);
                ready = true;
                keys.forEach(b => b.disabled = false);
                return;
            } sequence.forEach((n, i) => { timers.push(window.setTimeout(() => keys[n].classList.add('lit'), i * 700 + 100), window.setTimeout(() => keys[n].classList.remove('lit'), i * 700 + 570)); }); timers.push(window.setTimeout(() => { ready = true; keys.forEach(b => b.disabled = false); set('Agora repita a ordem.'); }, sequence.length * 700 + 100)); };
            add('Mostrar sequência', start);
            set('Toque em mostrar sequência para começar.');
            break;
        }
        case 'calendar': {
            const date = node('input', 'exp-input u-input');
            date.type = 'date';
            date.min = localDay();
            date.value = localDay();
            date.setAttribute('aria-label', 'Data de abertura');
            const text = node('textarea', 'exp-input u-input');
            text.placeholder = 'Uma mensagem para o futuro';
            text.maxLength = 300;
            text.setAttribute('aria-label', 'Mensagem futura');
            const list = node('div', 'u-records');
            let records = textRecords('calendar');
            const render = () => { list.replaceChildren(...records.map(r => node('p', 'u-record', `${r.date} · ${r.date && r.date <= localDay() ? r.text : 'Mensagem guardada 🔒'}`))); };
            extra.append(date, text, action('Guardar mensagem', () => { if (!date.value || date.value < localDay() || !text.value.trim()) {
                set('Escolha uma data válida e escreva uma mensagem.');
                return;
            } records = [...records, { date: date.value, text: text.value.trim() }].slice(-30); writeLocal('calendar', records); text.value = ''; render(); complete('Mensagem guardada neste aparelho.'); }), list);
            render();
            set('A data usa o relógio do aparelho; não é uma trava de segurança.');
            break;
        }
        case 'aurora': {
            const title = node('div', 'u-portal-title', 'AURORA DOS DESEJOS');
            scene.overlay.append(title);
            let i = 0;
            const colors = ['Rosa', 'Azul', 'Violeta', 'Dourado'];
            const paint = () => { scene.value = (++i) % 4; scene.pulse = 1; scene.stage.style.setProperty('--aurora-hue', `${i * 33}deg`); complete(`${colors[scene.value]} · ${wishes[scene.value]}`); };
            add('Pintar o céu', paint);
            scene.canvas.addEventListener('click', paint);
            set('Toque para mudar a luz do céu.');
            break;
        }
        case 'puzzle': {
            mountMosaic(scene.overlay, controls, set, complete);
            break;
        }
        case 'palace':
        case 'islands':
        case 'rose':
        case 'clock':
        case 'butterflies':
        case 'ocean': {
            const meta = { palace: ['Salão da luz', 'Avançar ao próximo salão'], islands: ['Arquipélago celeste', 'Viajar para outra ilha'], rose: ['Rosa adormecida', 'Abrir pétalas'], clock: ['Tempo das estrelas', 'Mover o mecanismo'], butterflies: ['Dança das asas', 'Mudar a corrente de luz'], ocean: ['Mar de luz', 'Mergulhar mais fundo'] }[id];
            const mark = node('div', 'u-atelier-title', meta[0]);
            scene.overlay.append(mark);
            let n = 0;
            const advance = () => { n = (n + 1) % 4; scene.value = n; complete(`${wishes[n]} · ${n + 1}/4`); mark.textContent = id === 'rose' ? ['Rosa adormecida', 'Despertar', 'Florescer', 'Rosa eterna'][n] : `${meta[0]} · ${n + 1}`; };
            add(meta[1], advance);
            add('Recomeçar', () => { n = 0; scene.value = 0; mark.textContent = meta[0]; set('Explore no seu ritmo.'); });
            scene.canvas.addEventListener('click', advance);
            if (id === 'clock')
                mountGearChallenge(extra, () => { scene.value = 3; complete('Engrenagens alinhadas! O tempo das estrelas está em harmonia. ♡'); mark.textContent = 'MECANISMO EM HARMONIA'; });
            set('Toque no cenário ou use o controle para descobrir novas luzes.');
            break;
        }
        case 'guide': {
            const avatar = node('div', 'u-guide', '☾');
            scene.overlay.append(avatar);
            set('Olá, viajante. O que você gostaria de descobrir hoje?');
            [['Quero relaxar', 'garden'], ['Quero ver arte', 'museum'], ['Quero jogar', 'stars'], ['Quero uma surpresa', 'portal']].forEach(([label, w]) => add(label, () => { discover(id); navigate(w); }));
            break;
        }
    }
    return () => { for (const cleanup of cleanups)
        cleanup(); };
}
function mountMosaic(overlay, controls, set, complete) {
    const board = node('div', 'u-mosaic');
    board.setAttribute('aria-label', 'Mosaico deslizante de 3 por 3');
    overlay.append(board);
    const source = arts[0];
    let tiles = Array.from({ length: 9 }, (_, i) => i), moves = 0, won = false, preview = false;
    const adjacent = (a, b) => Math.abs(a % 3 - b % 3) + Math.abs(Math.floor(a / 3) - Math.floor(b / 3)) === 1;
    const solved = () => tiles.every((v, i) => v === i);
    const swap = (a, b) => { [tiles[a], tiles[b]] = [tiles[b], tiles[a]]; };
    const cells = Array.from({ length: 9 }, (_, i) => { const b = action('', () => { if (won || preview)
        return; const empty = tiles.indexOf(8); if (!adjacent(i, empty)) {
        set('Escolha uma peça ao lado do espaço vazio.');
        return;
    } const from = cells[i].getBoundingClientRect(), to = cells[empty].getBoundingClientRect(); swap(i, empty); moves++; won = solved(); render(); const tile = cells[empty]; tile.style.zIndex = '2'; const slide = (0, motion_1.animateMotion)(tile, [{ transform: `translate(${from.left - to.left}px,${from.top - to.top}px)` }, { transform: 'translate(0,0)' }], { duration: 320, easing: 'cubic-bezier(.18,.8,.2,1)' }); const clear = () => { tile.style.zIndex = ''; }; if (slide)
        slide.finished.then(clear, clear);
    else
        clear(); if (won) {
        board.classList.add('is-complete');
        complete(`Mosaico completo em ${moves} movimentos! ♡`);
    }
    else
        set(`${moves} movimentos · deslize as peças até completar a imagem.`); }, 'u-mosaic-tile'); board.append(b); return b; });
    const render = () => { cells.forEach((b, i) => { const v = preview ? i : tiles[i]; const empty = v === 8 && !won && !preview; b.classList.toggle('u-empty', empty); b.disabled = empty || won || preview; b.dataset.tile = String(v); b.style.backgroundImage = empty ? 'none' : `url("${source.src}")`; b.style.backgroundPosition = `${v % 3 * 50}% ${Math.floor(v / 3) * 50}%`; b.textContent = empty ? '' : String(v + 1); b.setAttribute('aria-label', empty ? 'Espaço vazio' : `Peça ${v + 1}, posição ${i + 1}`); }); };
    const restart = () => { (0, motion_1.cancelMotionWithin)(board); tiles = Array.from({ length: 9 }, (_, i) => i); let last = -1; for (let k = 0; k < 28; k++) {
        const empty = tiles.indexOf(8), options = tiles.map((_, i) => i).filter(i => adjacent(i, empty) && i !== last);
        const next = options[Math.floor(Math.random() * options.length)];
        swap(empty, next);
        last = empty;
    } if (solved())
        swap(8, 7); moves = 0; won = false; preview = false; board.classList.remove('is-complete'); hint.textContent = 'Ver referência'; render(); set('0 movimentos · toque em uma peça vizinha ao espaço vazio.'); };
    const hint = action('Ver referência', () => { (0, motion_1.cancelMotionWithin)(board); preview = !preview; hint.textContent = preview ? 'Voltar ao jogo' : 'Ver referência'; render(); });
    controls.append(action('Embaralhar', restart), hint);
    restart();
}
function mountGearChallenge(extra, complete) {
    const section = node('section', 'u-gear-challenge');
    section.hidden = true;
    const intro = node('p', 'u-gear-intro', 'Gire os três cristais até que cada ponteiro encontre a estrela no alto.');
    const board = node('div', 'u-gear-board');
    const progress = node('p', 'u-gear-progress');
    progress.setAttribute('role', 'status');
    let values = [1, 3, 5], turns = [1, 3, 5], moves = 0, won = false;
    const buttons = values.map((_, i) => { const dial = action('', () => { if (won)
        return; values[i] = (values[i] + 1) % 6; turns[i]++; moves++; render(); if (values.every(v => v === 0)) {
        won = true;
        render();
        complete();
    } }, 'u-gear-dial'); dial.append(node('span', 'u-gear-target', '✦'), node('span', 'u-gear-wheel'), node('span', 'u-gear-indicator', '◆'), node('span', 'u-gear-number', String(i + 1))); board.append(dial); return dial; });
    function render() { buttons.forEach((b, i) => { b.style.setProperty('--gear-angle', `${turns[i] * 60}deg`); b.dataset.angle = String(values[i]); b.dataset.aligned = String(values[i] === 0); b.setAttribute('aria-label', `Cristal ${i + 1}: ${values[i] === 0 ? 'alinhado' : values[i] * 60 + ' graus'}; girar 60 graus`); b.disabled = won; }); progress.textContent = won ? `Todos alinhados em ${moves} movimentos!` : `${values.filter(v => v === 0).length}/3 cristais alinhados · ${moves} movimentos`; }
    const restart = () => { values = Array.from({ length: 3 }, () => 1 + Math.floor(Math.random() * 5)); turns = [...values]; moves = 0; won = false; render(); };
    section.append(intro, board, progress, action('Novo desafio', restart));
    const toggle = action('Desafio das engrenagens', () => { section.hidden = !section.hidden; toggle.setAttribute('aria-expanded', String(!section.hidden)); if (!section.hidden)
        section.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'instant' : 'smooth' }); }, 'u-subtle');
    toggle.setAttribute('aria-expanded', 'false');
    extra.append(toggle, section);
    render();
}

},
"./salon":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSalon = initSalon;
const music_visuals_1 = require("./music-visuals");
const config_1 = require("./config");
const $ = (s, r = document) => r.querySelector(s);
const root = document.documentElement;
const key = 'noa-salon-v1';
const prefs = { intimate: false, palette: 'music', haptic: false, bookmark: 0, volume: 70 };
try {
    const x = JSON.parse(localStorage.getItem(key) || '{}');
    prefs.intimate = x.intimate === true;
    prefs.haptic = x.haptic === true;
    if (['music', 'rose', 'silver', 'violet', 'amber'].includes(x.palette))
        prefs.palette = x.palette;
    if (Number.isInteger(x.bookmark))
        prefs.bookmark = x.bookmark;
    if (Number.isFinite(x.volume))
        prefs.volume = Math.max(0, Math.min(100, x.volume));
}
catch { }
function save() { try {
    localStorage.setItem(key, JSON.stringify(prefs));
}
catch { } }
function apply() { root.dataset.intimate = String(prefs.intimate); root.dataset.salonPalette = prefs.palette; }
apply();
const button = (s, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = s; b.addEventListener('click', fn); return b; };
const safeText = (s) => document.createTextNode(s);
const dialog = $('#salon-dialog');
const stage = $('#salon-stage'), heading = $('#salon-title'), eyebrow = $('#salon-kicker');
let mode = '', returnFocus = null, sampleTimer = 0, frames = 0, frameStart = 0, frameId = 0, lastFrame = 0, frameTimes = [];
const pickAudio = () => $('#local-audio');
function close() { if (dialog.open) {
    clear();
    root.classList.remove('salon-open');
    dialog.close();
} }
function clear() { clearInterval(sampleTimer); sampleTimer = 0; cancelAnimationFrame(frameId); frameId = 0; stage.replaceChildren(); }
function world(id) { returnFocus = null; close(); const card = $(`[data-world-card="${id}"]`); if (card)
    card.click(); }
function open(m) { if (dialog.open)
    clear();
else
    returnFocus = document.activeElement; mode = m; dialog.dataset.mode = m; stage.replaceChildren(); if (!dialog.open)
    dialog.showModal(); root.classList.add('salon-open'); if (m === 'cinema')
    cinema();
else if (m === 'observatory')
    observatory();
else if (m === 'book')
    book();
else if (m === 'gallery')
    gallery();
else if (m === 'settings')
    settings();
else if (m === 'palace')
    destinations('Palácio das memórias', 'CRISTAL / VITRAIS', [['Salões de cristal', 'palace'], ['Museu das memórias', 'museum'], ['Relógio das memórias', 'clock']]);
else if (m === 'garden')
    destinations('Jardim eterno', 'FLORES / LUZ', [['Jardim encantado', 'garden'], ['Rosa eterna', 'rose'], ['Borboletas de cristal', 'butterflies']]); $('#salon-close').focus({ preventScroll: true }); }
function title(t, k) { heading.textContent = t; eyebrow.textContent = k; }
function destinations(t, k, items) { title(t, k); const grid = document.createElement('div'); grid.className = 'salon-destinations'; for (const [label, id] of items)
    grid.append(button(label, () => world(id))); stage.append(grid); }
function cinema() { title('Cinema musical', 'NOA / SON ET LUMIÈRE'); const art = document.createElement('div'); art.className = 'salon-sculpture'; art.setAttribute('aria-hidden', 'true'); for (let i = 0; i < 24; i++) {
    const ring = document.createElement('i');
    ring.style.setProperty('--i', String(i));
    art.append(ring);
} const info = document.createElement('div'); info.className = 'salon-song'; const name = document.createElement('h3'), artist = document.createElement('p'), line = document.createElement('p'), next = document.createElement('p'); line.className = 'salon-current'; next.className = 'salon-next'; info.append(name, artist, line, next); const seek = document.createElement('input'); seek.type = 'range'; seek.min = '0'; seek.max = '100'; seek.step = '.1'; seek.setAttribute('aria-label', 'Progresso da faixa'); let dragging = false; seek.addEventListener('input', () => { dragging = true; }); seek.addEventListener('change', () => { const a = pickAudio(); if (Number.isFinite(a.duration))
    a.currentTime = a.duration * Number(seek.value) / 100;
else {
    const s = $('#seek');
    s.value = seek.value;
    s.dispatchEvent(new Event('change'));
} dragging = false; }); seek.addEventListener('pointercancel', () => dragging = false); const controls = document.createElement('div'); controls.className = 'salon-controls'; const play = button('Tocar', () => $('#play').click()); controls.append(button('Anterior', () => $('#prev').click()), play, button('Próxima', () => $('#next').click())); const time = document.createElement('output'); const choices = document.createElement('select'); choices.setAttribute('aria-label', 'Escolher música'); config_1.CONFIG.tracks.forEach((t, i) => { const op = document.createElement('option'); op.value = String(i); op.textContent = t.title; choices.append(op); }); choices.addEventListener('change', () => document.querySelectorAll('#tracks .pick')[Number(choices.value)]?.click()); stage.append(art, info, seek, time, controls, choices); let lastSignature = ''; const tick = () => { if (!dialog.open || mode !== 'cinema')
    return; const a = pickAudio(), n = $('#track-title').textContent || '', p = $('#play').getAttribute('aria-pressed') === 'true'; if (name.textContent !== n)
    name.textContent = n; const artistText = $('#track-artist').textContent || ''; if (artist.textContent !== artistText)
    artist.textContent = artistText; const hidden = $('#music-lyrics').hidden; const current = hidden ? '♪' : $('#lyrics-current').textContent || '♪', following = hidden ? '' : $('#lyrics-next').textContent || ''; const src = $('#lyrics-current'); const signature = hidden ? 'hidden' : current + '|' + Array.from(src.children, x => x.className).join(','); if (lastSignature !== signature) {
    lastSignature = signature;
    if (!hidden && src.children.length)
        line.replaceChildren(...Array.from(src.childNodes, x => x.cloneNode(true)));
    else
        line.textContent = current;
} if (next.textContent !== following)
    next.textContent = following; if (play.textContent !== (p ? 'Pausar' : 'Tocar'))
    play.textContent = p ? 'Pausar' : 'Tocar'; play.setAttribute('aria-pressed', String(p)); if (!dragging)
    seek.value = $('#seek').value; seek.disabled = $('#seek').disabled; time.textContent = $('#t1').textContent + ' / ' + $('#t2').textContent; const idx = Array.from(document.querySelectorAll('#tracks li')).findIndex(x => x.getAttribute('aria-current') === 'true'); if (idx >= 0)
    choices.value = String(idx); art.style.setProperty('--energy', String(music_visuals_1.audioVisual.energy)); art.style.setProperty('--bass', String(music_visuals_1.audioVisual.bass)); art.style.setProperty('--treble', String(music_visuals_1.audioVisual.treble)); art.style.setProperty('--tone', `rgb(${(0, music_visuals_1.environmentRGB)().map(x => Math.round(x * 255)).join(',')})`); art.dataset.playing = String(p && !a.paused); }; tick(); sampleTimer = window.setInterval(tick, 80); }
function observatory() { title('Observatório da Noa', 'ATLAS CELESTE / CONTEMPLAÇÃO'); const sky = document.createElement('div'); sky.className = 'salon-sky'; const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 400 240'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Constelação decorativa'); const make = (tag, attrs) => { const n = document.createElementNS(svg.namespaceURI, tag); for (const [k, v] of Object.entries(attrs))
    n.setAttribute(k, v); svg.append(n); }; for (let i = 0; i < 85; i++)
    make('circle', { cx: String((i * 73.19 + 13) % 400), cy: String((i * 43.87 + 5) % 240), r: String(i % 9 === 0 ? 1.8 : .65), fill: i % 3 === 0 ? '#ffd6ed' : '#ddd4ff', opacity: String(.25 + i % 5 * .15) }); make('path', { d: 'M96 130 L142 73 L206 106 L255 55 L301 140 L244 171 L206 106', stroke: '#edc7e7', 'stroke-width': '.8', fill: 'none' }); for (const [x, y] of [[96, 130], [142, 73], [206, 106], [255, 55], [301, 140], [244, 171]])
    make('circle', { cx: String(x), cy: String(y), r: '3', fill: '#fff1f7' }); sky.append(svg); const camera = document.createElement('div'); camera.className = 'salon-camera'; let zoom = 1, pan = 0; const view = () => { const w = 400 / zoom, h = 240 / zoom; svg.setAttribute('viewBox', `${(400 - w) / 2 + pan * (400 - w) / 2} ${(240 - h) / 2} ${w} ${h}`); }; for (const [label, min, max, step, value, fn] of [['Zoom', 1, 1.8, .05, 1, (v) => { zoom = v; view(); }], ['Horizonte', -1, 1, .05, 0, (v) => { pan = v; view(); }]]) {
    const l = document.createElement('label'), r = document.createElement('input');
    r.type = 'range';
    r.min = String(min);
    r.max = String(max);
    r.step = String(step);
    r.value = String(value);
    r.setAttribute('aria-label', label);
    r.oninput = () => fn(Number(r.value));
    l.append(safeText(label), r);
    camera.append(l);
} const note = document.createElement('p'); note.textContent = 'Uma constelação imaginária, feita para contemplar. Explore os mundos no seu ritmo.'; const controls = document.createElement('div'); controls.className = 'salon-controls'; controls.append(button('Viajar pelos planetas', () => world('space')), button('Aurora dos desejos', () => world('aurora')), button('Portal do universo', () => world('portal'))); stage.append(sky, camera, note, controls); const tick = () => { sky.style.setProperty('--energy', String(music_visuals_1.audioVisual.energy)); sky.style.setProperty('--tone', `rgb(${(0, music_visuals_1.environmentRGB)().map(x => Math.round(x * 255)).join(',')})`); }; tick(); sampleTimer = window.setInterval(tick, 160); }
function book() { title('Livro das memórias', 'CARTA ORIGINAL / EDIÇÃO PRIVADA'); const pages = config_1.CONFIG.chapters; let idx = Math.max(0, Math.min(pages.length - 1, prefs.bookmark)); const sheet = document.createElement('article'); sheet.className = 'salon-page'; const controls = document.createElement('div'); controls.className = 'salon-controls'; const prev = button('Anterior', () => show(idx - 1)), next = button('Próximo', () => show(idx + 1)), mark = button('Guardar capítulo', () => { prefs.bookmark = idx; save(); mark.textContent = 'Marcador guardado ♡'; }); controls.append(prev, mark, next); function show(n) { idx = Math.max(0, Math.min(pages.length - 1, n)); const c = pages[idx]; const h = document.createElement('h3'); h.textContent = c.title; const count = document.createElement('small'); count.textContent = `Capítulo ${idx + 1} de ${pages.length}`; sheet.replaceChildren(count, h); if (idx === 0) {
    const g = document.createElement('p');
    g.textContent = config_1.CONFIG.greeting;
    sheet.append(g);
} for (const p of c.p) {
    const q = document.createElement('p');
    q.textContent = p.t;
    sheet.append(q);
} sheet.scrollTop = 0; prev.disabled = idx === 0; next.disabled = idx === pages.length - 1; mark.textContent = 'Guardar capítulo'; if (root.dataset.motion !== 'reduced')
    sheet.animate?.([{ opacity: .4, transform: 'translateX(6px)' }, { opacity: 1, transform: 'none' }], { duration: 250 }); } stage.append(sheet, controls); show(idx); }
function gallery() { title('Galeria editorial', 'ARQUIVO / COLEÇÃO PARTICULAR'); const grid = document.createElement('div'); grid.className = 'salon-gallery'; const list = config_1.CONFIG.gallery; const detail = document.createElement('figure'); detail.className = 'salon-editorial-detail'; const pic = document.createElement('img'); pic.alt = ''; const caption = document.createElement('figcaption'); detail.append(pic, caption); let idx = 0; function show(n) { idx = (n + list.length) % list.length; const g = list[idx]; pic.src = g.src; pic.alt = g.alt || ''; caption.textContent = `${idx + 1} / ${list.length} · ${g.cap || g.alt || ''}`; detail.hidden = false; for (const [i, b] of Array.from(grid.querySelectorAll('button')).entries())
    b.setAttribute('aria-pressed', String(i === idx)); } for (const [i, g] of list.entries()) {
    const b = button('', () => show(i));
    b.setAttribute('aria-label', g.cap || g.alt || `Imagem ${i + 1}`);
    const im = document.createElement('img');
    im.src = g.src;
    im.alt = '';
    im.loading = 'lazy';
    b.append(im);
    grid.append(b);
} const controls = document.createElement('div'); controls.className = 'salon-controls'; controls.append(button('Anterior', () => show(idx - 1)), button('Próxima', () => show(idx + 1))); stage.append(detail, controls, grid); if (list.length)
    show(0); }
const allowed = ['prefs', 'noa-motion-schema', 'noa-crossfade', 'noa-crossfade-seconds', 'noa-normalize', 'noa-auto-scene', 'noa-music-autostart', 'noa-lyrics-visible', 'noa-lyrics-position', 'noa-vincy-timing-revision', 'noa-priority-queue', 'noa-shuffle', 'noa-repeat', key, ...config_1.CONFIG.tracks.flatMap(t => ['noa-lyrics-' + t.id, 'noa-lyric-offset-' + t.id])];
function download(data, name) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000); }
function backup() { const values = {}; for (const k of allowed) {
    const v = localStorage.getItem(k);
    if (v !== null)
        values[k] = v;
} download({ format: 'noa-salon-backup', version: 1, values }, 'Noa-preferencias-e-letras.json'); }
function validate(k, v) { if (typeof v !== 'string' || v.length > 70000)
    throw Error('Valor inválido: ' + k); if (k.startsWith('noa-lyrics-') && !['noa-lyrics-visible', 'noa-lyrics-position'].includes(k)) {
    const x = JSON.parse(v);
    if (x?.removed !== true) {
        if (typeof x?.raw !== 'string')
            throw Error('Letra inválida');
        (0, music_visuals_1.parseLyrics)(x.raw, x.seconds);
    }
}
else if (k.startsWith('noa-lyric-offset-')) {
    if (!Number.isFinite(Number(v)) || Math.abs(Number(v)) > 10)
        throw Error('Deslocamento inválido');
}
else if (k === key || k === 'prefs') {
    const x = JSON.parse(v);
    if (!x || typeof x !== 'object' || Array.isArray(x))
        throw Error('Preferência inválida');
} return v; }
async function restore(file) { if (file.size > 450000)
    throw Error('Arquivo grande demais'); const x = JSON.parse(await file.text()); if (x?.format !== 'noa-salon-backup' || x.version !== 1 || !x.values || typeof x.values !== 'object')
    throw Error('Formato de backup inválido'); const entries = Object.entries(x.values).filter(([k]) => allowed.includes(k)).map(([k, v]) => [k, validate(k, v)]); if (!entries.length)
    throw Error('Backup vazio'); const old = entries.map(([k]) => [k, localStorage.getItem(k)]); try {
    for (const [k, v] of entries)
        localStorage.setItem(k, v);
}
catch (e) {
    for (const [k, v] of old)
        try {
            if (v === null)
                localStorage.removeItem(k);
            else
                localStorage.setItem(k, v);
        }
        catch { }
    throw e;
} return entries.length; }
function settings() { title('Ateliê de preferências', 'LOCAL / SEM TELEMETRIA'); const form = document.createElement('div'); form.className = 'salon-settings'; const field = (label, control) => { const l = document.createElement('label'); l.append(safeText(label), control); form.append(l); }; const intimate = document.createElement('input'); intimate.type = 'checkbox'; intimate.checked = prefs.intimate; intimate.onchange = () => { prefs.intimate = intimate.checked; apply(); save(); }; field('Modo íntimo', intimate); const haptic = document.createElement('input'); haptic.type = 'checkbox'; haptic.checked = prefs.haptic; haptic.onchange = () => { prefs.haptic = haptic.checked; save(); if (prefs.haptic)
    navigator.vibrate?.(12); }; field('Resposta tátil opcional', haptic); const select = document.createElement('select'); for (const [v, t] of [['music', 'Da música'], ['rose', 'Rosa'], ['silver', 'Prata'], ['violet', 'Ametista'], ['amber', 'Âmbar']]) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = t;
    select.append(o);
} select.value = prefs.palette; select.onchange = () => { prefs.palette = select.value; apply(); save(); }; field('Paleta visual', select); const msg = document.createElement('p'); msg.setAttribute('role', 'status'); const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.onchange = async () => { if (!file.files?.[0])
    return; try {
    const n = await restore(file.files[0]);
    msg.textContent = `${n} configurações restauradas. Reabra a página para aplicar todas.`;
    reload.hidden = false;
}
catch (e) {
    msg.textContent = e instanceof Error ? e.message : 'Falha na importação';
} file.value = ''; }; field('Importar backup (aplicação após recarregar)', file); const reload = button('Recarregar agora', () => location.reload()); reload.hidden = true; const health = button('Medir fluidez por 5 s', () => { if (frameId)
    return; frameTimes = []; frames = 0; frameStart = performance.now(); lastFrame = frameStart; health.disabled = true; const run = (t) => { if (!dialog.open || mode !== 'settings') {
    frameId = 0;
    return;
} if (t - lastFrame > 0)
    frameTimes.push(t - lastFrame); lastFrame = t; frames++; if (t - frameStart < 5000) {
    frameId = requestAnimationFrame(run);
    return;
} frameId = 0; health.disabled = false; const a = frameTimes.sort((a, b) => a - b); msg.textContent = `${frames} quadros / ${(t - frameStart) / 1000 | 0} s · mediana ${a[Math.floor(a.length / 2)].toFixed(1)} ms · p95 ${a[Math.floor((a.length - 1) * .95)].toFixed(1)} ms · qualidade ${root.dataset.q || 'auto'} · não mede bateria.`; }; frameId = requestAnimationFrame(run); }); form.append(button('Exportar letras e preferências', () => { try {
    backup();
    msg.textContent = 'Backup preparado.';
}
catch {
    msg.textContent = 'Armazenamento indisponível.';
} }), reload, health, msg); stage.append(form); }
function initSalon() { document.querySelectorAll('[data-salon]').forEach(b => b.addEventListener('click', () => { if (prefs.haptic)
    navigator.vibrate?.(12); open(b.dataset.salon); })); $('#salon-close').addEventListener('click', close); dialog.addEventListener('close', () => { if (dialog.open)
    return; clear(); root.classList.remove('salon-open'); if (returnFocus?.isConnected)
    returnFocus.focus({ preventScroll: true }); }); dialog.addEventListener('cancel', e => { e.preventDefault(); close(); }); document.addEventListener('keydown', e => { if (dialog.open && e.key === 'Escape')
    e.stopImmediatePropagation(); }, true); const vol = $('#volume'); if (prefs.volume !== 70) {
    vol.value = String(prefs.volume);
    vol.dispatchEvent(new Event('input'));
} vol.addEventListener('input', () => { prefs.volume = Number(vol.value); save(); }); }

},
"./main":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const salon_1 = require("./salon");
const music_visuals_1 = require("./music-visuals");
const config_1 = require("./config");
require("./features");
const cinematic_1 = require("./cinematic");
const memory_film_1 = require("./memory-film");
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.prototype.slice.call(r.querySelectorAll(s));
const html = document.documentElement;
const NS = 'http://www.w3.org/2000/svg';
function el(tag, cls = '', text) { const e = document.createElement(tag); if (cls)
    e.className = cls; if (text != null)
    e.textContent = text; return e; }
function svg(kind, name, cls = '') {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', (kind === 'ico' ? 'ico ' : 'o ') + (cls || ''));
    s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS(NS, 'use');
    u.setAttribute('href', '#' + (kind === 'ico' ? 'i-' : '') + name);
    s.appendChild(u);
    return s;
}
function safe(label, fn) { try {
    fn();
}
catch (e) {
    console.warn('[surpresa] "' + label + '" falhou e foi ignorado:', e);
} }
const mql = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
const store = {
    get(k) { try {
        return localStorage.getItem(k);
    }
    catch (e) {
        return null;
    } },
    set(k, v) { try {
        localStorage.setItem(k, v);
    }
    catch (e) { } }
};
const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v, d = '') => (typeof v === 'string' ? v : (d || ''));
const RAW = config_1.CONFIG;
const C = {
    title: str(RAW.title), kicker: str(RAW.kicker), from: str(RAW.from), sheet: Object.assign({ to: '', by: '' }, RAW.sheet), tag: arr(RAW.tag).concat(['', '']),
    bands: arr(RAW.bands), met: str(RAW.met), metLabel: str(RAW.metLabel), sinceLines: arr(RAW.sinceLines).concat(['', '']),
    gateText: str(RAW.gateText), gateButton: str(RAW.gateButton, 'ABRIR ♡'), intro: arr(RAW.intro), loading: arr(RAW.loading).length ? arr(RAW.loading) : [''],
    greeting: str(RAW.greeting), finalLine1: str(RAW.finalLine1), finalLine2: str(RAW.finalLine2), sign: str(RAW.sign),
    timeline: arr(RAW.timeline).filter(i => i && i.t), details: arr(RAW.details).filter(i => i && i.t),
    tracks: arr(RAW.tracks).filter(t => t && /^[\w-]{6,20}$/.test(t.id || '')), gallery: arr(RAW.gallery).filter(g => g && g.src),
    heroPolaroids: arr(RAW.heroPolaroids), chapters: arr(RAW.chapters).filter(c => c && arr(c.p).length)
};
const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const fmt = (s) => (Number.isFinite(s) && s >= 0 ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00');
let locks = 0;
function lock() { locks++; document.body.classList.add('lock'); }
function unlock() { locks = Math.max(0, locks - 1); if (!locks)
    document.body.classList.remove('lock'); }
let toastTimer = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); if (toastTimer)
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3200); }
const PREFS = Object.assign({ fx: 'auto', motion: 'full', contrast: false, read: false, size: 0 }, (() => { try {
    return JSON.parse(store.get('prefs') || '{}');
}
catch (e) {
    return {};
} })());
PREFS.fx = ['auto', 'low', 'high'].includes(PREFS.fx) ? PREFS.fx : 'auto';
if (store.get('noa-motion-schema') !== '9') {
    PREFS.motion = 'full';
    store.set('prefs', JSON.stringify(PREFS));
    store.set('noa-motion-schema', '9');
}
else
    PREFS.motion = PREFS.motion === 'reduced' || PREFS.motion === 'system' ? PREFS.motion : 'full';
PREFS.contrast = PREFS.contrast === true;
PREFS.read = PREFS.read === true;
PREFS.size = Number.isFinite(Number(PREFS.size)) ? Math.max(0, Math.min(2, Math.trunc(Number(PREFS.size)))) : 0;
const reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
let REDUCED = false;
const COLS = ['#D85C93', '#F2A9C9', '#F8DDE9', '#8D315B'];
let Q = 1;
function detectQuality() {
    const n = navigator, mem = n.deviceMemory || 4, cores = n.hardwareConcurrency || 4, save = n.connection && n.connection.saveData;
    if (save || mem <= 2 || cores <= 4)
        return 0;
    return (mem <= 4 || cores <= 6) ? 1 : 2;
}
function setQuality(q) { Q = q; html.dataset.q = ['low', 'mid', 'high'][q]; }
function autoQuality(dts) {
    if (PREFS.fx !== 'auto')
        return;
    const d = dts.slice(3).sort((a, b) => a - b), med = d[d.length >> 1] || 16;
    if (med > 40 && Q > 0)
        setQuality(0);
    else if (med > 28 && Q > 1)
        setQuality(1);
}
let renderSlow = 0, renderFast = 0, lastQualityChange = 0;
document.addEventListener('noa-render-budget', (event) => { if (PREFS.fx !== 'auto' || REDUCED || document.hidden || state !== 'done')
    return; const cost = event.detail; if (!Number.isFinite(cost))
    return; renderSlow = cost > 23 ? renderSlow + 1 : 0; renderFast = cost < 8 ? renderFast + 1 : 0; const now = performance.now(); if (now - lastQualityChange < 7000)
    return; if (renderSlow >= 2 && Q > 0) {
    setQuality((Q - 1));
    lastQualityChange = now;
    renderSlow = renderFast = 0;
}
else if (renderFast >= 4 && Q < detectQuality()) {
    setQuality((Q + 1));
    lastQualityChange = now;
    renderSlow = renderFast = 0;
} });
function applyPrefs() {
    REDUCED = PREFS.motion === 'reduced' || (PREFS.motion === 'system' && !!reduceMQ?.matches);
    html.dataset.motion = REDUCED ? 'reduced' : 'full';
    document.dispatchEvent(new Event('noa-motion-change'));
    html.dataset.contrast = PREFS.contrast ? 'on' : 'off';
    html.dataset.read = PREFS.read ? 'on' : 'off';
    html.dataset.size = String(PREFS.size);
    setQuality(PREFS.fx === 'low' ? 0 : PREFS.fx === 'high' ? 2 : detectQuality());
    const rb = $('#readbtn');
    if (rb)
        rb.setAttribute('aria-pressed', String(PREFS.read));
}
function savePrefs() { store.set('prefs', JSON.stringify(PREFS)); store.set('noa-motion-schema', '9'); }
document.addEventListener('noa-enable-motion', () => { PREFS.motion = 'full'; savePrefs(); applyPrefs(); syncPrefs(); });
if (reduceMQ && reduceMQ.addEventListener)
    reduceMQ.addEventListener('change', () => applyPrefs());
function drawShape(ctx, k, s) {
    ctx.beginPath();
    if (k === 0) {
        ctx.moveTo(0, s * .4);
        ctx.bezierCurveTo(-s * 1.1, -s * .2, -s * .5, -s * .9, 0, -s * .35);
        ctx.bezierCurveTo(s * .5, -s * .9, s * 1.1, -s * .2, 0, s * .4);
    }
    else if (k === 1) {
        for (let i = 0; i < 8; i++) {
            const r = i % 2 ? s * .25 : s;
            ctx.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r);
        }
        ctx.closePath();
    }
    else
        ctx.rect(-s / 2, -s / 5, s, s * .4);
    ctx.fill();
}
function syncPageVisibility() { html.classList.toggle('paused', document.hidden); }
document.addEventListener('visibilitychange', syncPageVisibility);
window.addEventListener('pageshow', syncPageVisibility);
window.addEventListener('focus', syncPageVisibility);
syncPageVisibility();
document.addEventListener('dragstart', event => {
    const target = event.target;
    if (target instanceof Element && target.closest('img, svg') && !target.closest('[draggable="true"], [contenteditable]:not([contenteditable="false"])'))
        event.preventDefault();
});
const CF = { cv: null, x: null, list: [], run: false };
function burst(small = false) {
    CF.cv = CF.cv || $('#cf');
    if (REDUCED || !CF.cv)
        return;
    CF.x = CF.x || CF.cv.getContext('2d');
    if (!CF.x)
        return;
    if (CF.cv.width !== innerWidth || CF.cv.height !== innerHeight) {
        CF.cv.width = innerWidth;
        CF.cv.height = innerHeight;
    }
    if (CF.list.length > 150)
        CF.list.splice(0, CF.list.length - 150);
    const n = [50, 100, 150][Q] >> (small ? 1 : 0), cols = COLS.concat('#ffffff');
    for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, v = 4 + Math.random() * 11;
        CF.list.push({ x: innerWidth / 2, y: innerHeight * .55, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 7, r: Math.random() * 6, vr: (Math.random() - .5) * .3, s: 6 + Math.random() * 10, c: cols[i % 5], k: i % 3, l: 1 });
    }
    if (!CF.run) {
        CF.run = true;
        requestAnimationFrame(stepCF);
    }
}
let cfLast = 0;
function stepCF(now) {
    const dt = cfLast ? Math.min((now - cfLast) / 16.667, 3) : 1;
    cfLast = now;
    if (document.hidden || REDUCED) {
        CF.list = [];
        CF.run = false;
        cfLast = 0;
        CF.x.clearRect(0, 0, CF.cv.width, CF.cv.height);
        return;
    }
    const x = CF.x;
    x.clearRect(0, 0, CF.cv.width, CF.cv.height);
    CF.list = CF.list.filter(p => p.l > 0);
    CF.list.forEach(p => {
        p.vy += .22 * dt;
        p.vx *= Math.pow(.99, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += p.vr * dt;
        p.l -= .008 * dt;
        x.save();
        x.translate(p.x, p.y);
        x.rotate(p.r);
        x.globalAlpha = Math.max(p.l, 0);
        x.fillStyle = p.c;
        drawShape(x, p.k, p.s);
        x.restore();
    });
    if (CF.list.length)
        requestAnimationFrame(stepCF);
    else {
        CF.run = false;
        cfLast = 0;
        x.clearRect(0, 0, CF.cv.width, CF.cv.height);
    }
}
function shards(parent, left, top) {
    for (let i = 0; i < 14; i++) {
        const a = i / 14 * 6.283 + Math.random() * .4, d = 50 + Math.random() * 70, s = el('i', 'sd');
        s.style.cssText = '--l:' + left + ';--t:' + top + ';--dx:' + Math.cos(a) * d + 'px;--dy:' + (Math.sin(a) * d - 10) + 'px;--r:' + Math.random() * 360 + 'deg';
        parent.appendChild(s);
        setTimeout(() => s.remove(), 1000);
    }
}
applyPrefs();
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
    }
}), { threshold: .06 }) : null;
function observeReveals(root) { $$('.rv', root).forEach(n => { if (io)
    io.observe(n);
else
    n.classList.add('in'); }); }
function pic(g) {
    const p = el('picture');
    if (g.thumb && g.thumbFallback && g.thumb !== g.thumbFallback) {
        const s = el('source');
        s.type = 'image/webp';
        s.srcset = g.thumb;
        p.appendChild(s);
    }
    const i = el('img');
    i.alt = '';
    i.decoding = 'async';
    i.loading = 'lazy';
    if (g.w && g.h) {
        i.width = g.w;
        i.height = g.h;
    }
    i.src = g.thumbFallback || g.thumb || g.src;
    p.appendChild(i);
    return { p: p, i: i };
}
function daysSince(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m)
        return null;
    const n = new Date();
    return Math.max(0, Math.round((Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 864e5));
}
function countUp() {
    const d = daysSince(C.met), e = $('#days');
    if (d === null) {
        e.parentNode.hidden = true;
        return;
    }
    if (REDUCED) {
        e.textContent = d;
        return;
    }
    let n = 0;
    const t = setInterval(() => { n += Math.ceil(d / 40) || 1; if (n >= d) {
        n = d;
        clearInterval(t);
    } e.textContent = n; }, 40);
}
document.title = C.title || document.title;
safe('hero', () => {
    $('#kicker').textContent = C.kicker;
    $('#from').textContent = C.from;
    $('#s1').textContent = C.sinceLines[0];
    $('#s2').textContent = C.sinceLines[1];
    $('#meta').textContent = C.metLabel;
    const h = $('#title'), m = /^(.*?)\s+(para\s.+)$/i.exec(C.title);
    if (C.title)
        h.textContent = '';
    if (m)
        h.append(el('span', 't1', m[1]), document.createTextNode(' '), el('span', 't2', m[2]));
    else
        h.append(el('span', 't1', C.title));
    C.heroPolaroids.forEach((id, n) => { const g = C.gallery.filter(x => x.id === id)[0]; if (!g)
        return; const f = el('figure', 'hp hp--' + (n + 1)); f.appendChild(pic(g).p); $('#hps').appendChild(f); });
    $$('.hero>*').forEach((e, i) => e.style.setProperty('--n', i));
    $('#f1').textContent = C.finalLine1;
    $('#f2').textContent = C.finalLine2;
    $('#f3').textContent = C.sign;
});
safe('timeline', () => C.timeline.forEach((it, n) => {
    const li = el('li', 'tl rv');
    li.style.setProperty('--d', n * .08 + 's');
    const ic = el('span', 'ic');
    ic.appendChild(svg('ico', it.icon || 'heart'));
    li.append(ic, el('b', '', it.d || ''), it.t);
    $('#timeline').appendChild(li);
}));
safe('details', () => C.details.forEach((d, n) => {
    const categories = { estilo: 'Estética & estilo', colecao: 'Colecionismo', midia: 'Arte & histórias', musica: 'Música & som' };
    const li = el('li', 'tag tag--' + (d.fam || 'estilo') + ' rv');
    li.style.setProperty('--d', n * .045 + 's');
    const moods = { estilo: ['estética', 'presença'], colecao: ['memórias', 'coleção'], midia: ['imaginação', 'histórias'], musica: ['som', 'emoção'] };
    const tg = el('div', 'tg'), head = el('div', 'interest-head'), glyph = el('span', 'interest-icon');
    glyph.append(svg('ico', d.icon || 'heart'));
    head.append(glyph, el('span', 'interest-num', String(n + 1).padStart(2, '0')));
    const body = el('div', 'interest-copy');
    body.append(el('span', 'interest-category', categories[d.fam] || 'Detalhes'), el('span', 'interest-name', d.t));
    const chips = el('div', 'interest-tags');
    for (const chip of (moods[d.fam] || ['detalhe', 'universo']))
        chips.append(el('span', 'interest-tag', chip));
    tg.append(head, body, chips);
    li.append(tg);
    $('#details').appendChild(li);
}));
safe('titles', () => $$('.sh').forEach(n => { const k = $('[lang=ja]', n); if (k) {
    n.dataset.k = k.textContent;
    n.style.setProperty('--kn', String(k.textContent.length));
} }));
safe('bands', () => $$('.band').forEach((b, i) => {
    const t = C.bands.length ? C.bands[i % C.bands.length] : '';
    if (!t) {
        b.hidden = true;
        return;
    }
    const d = el('div'), a = el('span', '', t.repeat(8)), c = el('span', '', t.repeat(8));
    d.append(a, c);
    b.appendChild(d);
    b.classList.add('rv');
}));
const G = $('#gate'), MAIN = $('#main'), ENV = $('#envx');
let state = 'pre', skipText = false;
const timers = [];
const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
safe('gate', () => {
    $('#gateText').textContent = C.gateText;
    $('#open').textContent = C.gateButton;
    $('.s1', ENV).textContent = C.sheet.to;
    $('.s3', ENV).textContent = C.sheet.by;
    const tb = $('.e-tag b', ENV);
    tb.append(C.tag[0], document.createElement('br'), C.tag[1]);
    for (let i = 0; i < 46; i++) {
        const s = el('i', 'st');
        s.style.cssText = 'left:' + Math.random() * 100 + '%;top:' + Math.random() * 100 + '%;--s:' + (1 + Math.random() * 3) + 'px;animation-delay:' + Math.random() * 4 + 's';
        $('#stars').appendChild(s);
    }
});
lock();
function enter() {
    if (state === 'done')
        return;
    state = 'done';
    timers.forEach(clearTimeout);
    const pre = $('#pre');
    if (pre)
        pre.remove();
    G.classList.add('gone');
    MAIN.hidden = false;
    $('#fabs').hidden = false;
    $('#skip').hidden = true;
    unlock();
    scrollTo(0, 0);
    $('#top').classList.add('go');
    countUp();
    observeReveals(MAIN);
    setTimeout(() => { G.hidden = true; }, 1400);
    const h = $('#title');
    h.tabIndex = -1;
    try {
        h.focus({ preventScroll: true });
    }
    catch (e) { }
}
function runPreloader(done) {
    const pre = document.querySelector('#pre');
    if (!pre || state !== 'pre')
        return;
    if (REDUCED) {
        pre.remove();
        done();
        return;
    }
    const bar = pre.querySelector('.pre-progress');
    const fill = bar.querySelector('i');
    const status = pre.querySelector('#pmsg');
    const count = pre.querySelector('#pct');
    let steps = 1, finished = false, frame = 0, last = 0;
    const dts = [];
    function report(text) {
        if (state !== 'pre' || !pre.isConnected)
            return;
        bar.setAttribute('aria-valuenow', String(steps));
        fill.style.width = `${steps / 3 * 100}%`;
        count.textContent = `${String(steps).padStart(2, '0')} / 03`;
        status.textContent = text;
    }
    report('Acendendo o prólogo…');
    function sample(now) {
        if (state !== 'pre' || finished || !pre.isConnected)
            return;
        if (last && now - last < 100 && dts.length < 25)
            dts.push(now - last);
        last = now;
        if (dts.length < 25)
            frame = requestAnimationFrame(sample);
    }
    frame = requestAnimationFrame(sample);
    const complete = (fallback) => {
        if (finished)
            return;
        finished = true;
        cancelAnimationFrame(frame);
        clearTimeout(deadline);
        if (state !== 'pre' || !pre.isConnected)
            return;
        if (dts.length >= 8)
            autoQuality(dts);
        steps = 3;
        report(fallback ? 'Palco pronto para você ♡' : 'Universo pronto para você ♡');
        pre.dataset.ready = 'true';
        if (REDUCED || document.hidden) {
            pre.remove();
            done();
            return;
        }
        later(() => { if (state === 'pre') {
            pre.classList.add('open');
            done();
        } }, 550);
        later(() => pre.remove(), 1750);
    };
    const deadline = setTimeout(() => complete(true), 1800);
    if (!document.fonts || typeof document.fonts.load !== 'function') {
        complete(true);
        return;
    }
    let failed = false;
    const prepareFont = async (font) => {
        try {
            const faces = await document.fonts.load(font);
            if (!faces.length)
                failed = true;
        }
        catch {
            failed = true;
        }
        if (!finished && state === 'pre') {
            steps = Math.min(2, steps + 1);
            report(steps === 2 ? 'Lapidando os detalhes…' : 'Preparando os últimos detalhes…');
        }
    };
    Promise.all([prepareFont('600 72px "Playfair Display"'), prepareFont('italic 400 18px "Lora"')]).then(() => complete(failed));
}
function showEnvelope() {
    if (state !== 'intro')
        return;
    skipText = true;
    state = 'ready';
    const t = $('#gateText');
    t.textContent = C.gateText;
    t.classList.remove('out');
    G.classList.add('ready');
    $('#gate-fast').hidden = true;
}
function runIntro() {
    if (state !== 'pre')
        return;
    state = 'intro';
    skipText = skipText || REDUCED;
    const t = $('#gateText'), sleep = (ms) => new Promise(r => setTimeout(r, ms));
    if (skipText) {
        showEnvelope();
        return;
    }
    $('#gate-fast').hidden = false;
    (async function () {
        for (const line of C.intro) {
            if (skipText || state !== 'intro')
                break;
            t.classList.remove('out');
            t.textContent = line;
            t.animate?.([{ opacity: 0, transform: 'translateY(12px) scale(.985)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 650, easing: 'cubic-bezier(.2,.75,.3,1)' });
            await sleep(Math.max(1500, Math.min(2600, line.length * 38)));
            if (state !== 'intro')
                return;
            if (!skipText)
                await sleep(250);
            if (state !== 'intro')
                return;
            t.classList.add('out');
            if (!skipText)
                await sleep(500);
        }
        showEnvelope();
    })();
}
function openEnvelope() {
    if (state !== 'ready')
        return;
    state = 'opening';
    G.classList.add('opening');
    ENV.classList.add('is-open');
    const k = REDUCED ? 0.08 : 1;
    shards($('#tilt'), '50%', '56%');
    later(burst, 2300 * k);
    later(() => $('#flash').classList.add('on'), 2800 * k);
    later(enter, 3500 * k);
}
G.addEventListener('pointerdown', () => { if (state === 'intro')
    showEnvelope(); });
$('#gate-fast').addEventListener('click', showEnvelope);
$('#stage').addEventListener('click', openEnvelope);
$('#open').addEventListener('click', openEnvelope);
$('#skip').addEventListener('click', enter);
const chs = $('#chapters'), sc = el('div', 'sealed'), chn = el('nav');
safe('letter', () => {
    C.chapters.forEach((c, n) => {
        const id = 'cap' + (n + 1), s = el('article', 'page rv');
        s.id = id;
        s.setAttribute('aria-labelledby', id + 't');
        s.style.setProperty('--n', '"' + (ROM[n] || n + 1) + '"');
        const h = el('h3', '', c.title);
        h.id = id + 't';
        const d = el('div', 'div');
        d.setAttribute('aria-hidden', 'true');
        d.appendChild(svg('o', 'heart'));
        const fr = el('i');
        fr.setAttribute('aria-hidden', 'true');
        s.append(fr, el('span', 'no', 'Capítulo ' + (ROM[n] || n + 1)), h, d);
        if (n === 0 && C.greeting)
            s.appendChild(el('p', 'greet rv', C.greeting));
        let first = true;
        arr(c.p).forEach(p => { const k = str(p.k); const q = el('p', (k + ' rv' + (first && !k ? ' dc' : '')).trim(), str(p.t)); if (!k)
            first = false; s.appendChild(q); });
        const bk = el('span', 'bk'), pn = el('span', 'pn', '— ' + (n + 1) + ' —');
        bk.setAttribute('aria-hidden', 'true');
        pn.setAttribute('aria-hidden', 'true');
        s.append(bk, pn);
        if (n === C.chapters.length - 1) {
            const st = el('div', 'stamp');
            st.setAttribute('aria-hidden', 'true');
            st.appendChild(svg('o', 'heart'));
            s.appendChild(st);
        }
        chs.appendChild(s);
    });
    chs.classList.add('hid');
    sc.innerHTML = '<div class="env env--seal"><i class="e-back"></i><i class="e-paper"></i><i class="e-flap"></i><button type="button" class="e-front" aria-label="Abrir a carta"></button><span class="e-wax"><svg class="o" aria-hidden="true"><use href="#heart"/></svg></span></div><p>Toque no lacre para abrir a carta ♡</p>';
    chn.id = 'chnav';
    chn.hidden = true;
    chn.setAttribute('aria-label', 'Capítulos da carta');
    C.chapters.forEach((c, n) => {
        const b = el('button', '', ROM[n] || String(n + 1));
        b.type = 'button';
        b.setAttribute('aria-label', 'Ir para o capítulo ' + (ROM[n] || n + 1) + ': ' + c.title);
        b.addEventListener('click', () => $('#cap' + (n + 1)).scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }));
        chn.appendChild(b);
    });
    const rb = el('button', '', 'Leitura');
    rb.id = 'readbtn';
    rb.type = 'button';
    rb.setAttribute('aria-pressed', String(PREFS.read));
    rb.setAttribute('aria-label', 'Modo leitura: página simples e texto maior');
    rb.addEventListener('click', () => { PREFS.read = !PREFS.read; savePrefs(); applyPrefs(); syncPrefs(); });
    chn.appendChild(rb);
    chs.before(sc);
    sc.after(chn);
    $('.env--seal', sc).addEventListener('click', openLetter);
});
function openLetter() {
    if (sc.classList.contains('open'))
        return;
    sc.classList.add('open');
    const env = $('.env--seal', sc);
    env.classList.add('is-open');
    const k = REDUCED ? 0.05 : 1;
    shards(env, '50%', '56%');
    setTimeout(() => burst(true), 600 * k);
    setTimeout(() => {
        chs.classList.remove('hid');
        chs.classList.add('show');
        chn.hidden = false;
        sc.classList.add('done');
        observeReveals(chs);
        if ('IntersectionObserver' in window) {
            const co = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting)
                $$('button', chn).forEach((b, i) => b.setAttribute('aria-current', String('cap' + (i + 1) === e.target.id))); }), { rootMargin: '-40% 0px -50% 0px' });
            $$('.page', chs).forEach(p => co.observe(p));
        }
    }, 1500 * k);
}
if (REDUCED)
    openLetter();
const GAL = [];
const LB = { root: $('#lb'), img: $('#lb img'), cap: $('#lbc'), num: $('#lbn'), list: [], i: 0, open: false, last: null, x: 0, y: 0 };
safe('gallery', () => {
    [['desenhos', '#gArte', 'arte'], ['', '#gGosta', 'gosta']].forEach(grp => {
        C.gallery.filter(g => (grp[0] ? g.kind === grp[0] : g.kind !== 'desenhos')).forEach((g, n) => {
            const f = el('figure', 'fig fig--' + grp[2] + ' rv');
            f.style.setProperty('--d', (n % 6) * .08 + 's');
            f.dataset.kind = g.kind || '';
            f.tabIndex = 0;
            f.setAttribute('role', 'button');
            f.setAttribute('aria-label', 'Ampliar imagem: ' + (g.alt || g.cap || 'imagem'));
            const p = pic(g);
            p.i.addEventListener('load', () => p.i.classList.add('ld'));
            p.i.addEventListener('error', () => f.classList.add('bad'));
            if (p.i.complete && p.i.naturalWidth > 0)
                p.i.classList.add('ld');
            const caption = el('figcaption', 'cap', g.cap || g.alt || '');
            const mark = el('span', 'gallery-index', String(n + 1).padStart(2, '0'));
            mark.setAttribute('aria-hidden', 'true');
            const zoom = el('span', 'gallery-zoom');
            zoom.append(svg('ico', 'search'));
            zoom.setAttribute('aria-hidden', 'true');
            f.append(p.p, mark, zoom, caption);
            $(grp[1]).appendChild(f);
            GAL.push({ g: g, fig: f });
        });
    });
    $$('.chips button').forEach(b => b.addEventListener('click', () => {
        $$('.chips button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        GAL.forEach(it => { if (it.fig.parentElement?.id === 'gGosta')
            it.fig.hidden = !(b.dataset.k === 'all' || it.g.kind === b.dataset.k); });
    }));
});
safe('gallery perspective', () => {
    const gallery = $('#gArte'), toggle = $('#gallery-mode'), nav = $('#gallery-nav');
    const cards = Array.from(gallery.querySelectorAll('.fig'));
    if (!cards.length) {
        toggle.hidden = true;
        return;
    }
    let enabled = false, index = 0, pending = 0;
    function indicate(next) { index = Math.max(0, Math.min(cards.length - 1, next)); cards.forEach((card, i) => { card.dataset.depth = String(Math.max(-2, Math.min(2, i - index))); }); $('#gallery-count').textContent = `${String(index + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`; $('#gallery-prev').disabled = index === 0; $('#gallery-next').disabled = index === cards.length - 1; }
    function go(next) { if (!enabled)
        return; indicate(next); const card = cards[index]; gallery.scrollTo({ left: card.offsetLeft + (card.offsetWidth - gallery.clientWidth) / 2, behavior: html.dataset.motion === 'reduced' ? 'instant' : 'smooth' }); }
    function measure() { pending = 0; if (!enabled)
        return; const center = gallery.getBoundingClientRect().left + gallery.clientWidth / 2; let best = index, min = Infinity; cards.forEach((card, i) => { const r = card.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - center); if (d < min) {
        min = d;
        best = i;
    } }); indicate(best); }
    gallery.addEventListener('scroll', () => { if (enabled && !pending)
        pending = window.setTimeout(measure, 80); }, { passive: true });
    toggle.addEventListener('click', () => { enabled = !enabled; gallery.classList.toggle('gallery-perspective', enabled); nav.hidden = !enabled; toggle.setAttribute('aria-pressed', String(enabled)); toggle.textContent = enabled ? 'Ver em grade' : 'Galeria 3D'; if (enabled) {
        cards.forEach(c => c.classList.add('in'));
        indicate(0);
        gallery.scrollLeft = 0;
        measure();
    }
    else {
        clearTimeout(pending);
        pending = 0;
        gallery.scrollLeft = 0;
        cards.forEach(c => delete c.dataset.depth);
    } });
    $('#gallery-prev').addEventListener('click', () => go(index - 1));
    $('#gallery-next').addEventListener('click', () => go(index + 1));
});
const visibleGal = () => GAL.filter(it => !it.fig.hidden && !it.fig.classList.contains('bad'));
function lbShow(n) {
    const L = LB.list;
    if (!L.length)
        return;
    LB.i = (n + L.length) % L.length;
    const g = L[LB.i].g;
    LB.img.classList.remove('in');
    LB.img.onload = () => LB.img.classList.add('in');
    LB.img.onerror = () => { LB.img.classList.add('in'); LB.cap.textContent = 'Não foi possível carregar esta imagem.'; };
    LB.img.src = g.src;
    if (LB.img.complete && LB.img.naturalWidth > 0)
        LB.img.classList.add('in');
    LB.img.alt = g.alt || '';
    LB.cap.textContent = g.cap || '';
    LB.num.textContent = (LB.i + 1) + ' / ' + L.length;
    [LB.i + 1, LB.i - 1].forEach(j => { const o = L[(j + L.length) % L.length]; if (o && !/\.gif$/.test(o.g.src))
        new Image().src = o.g.src; });
}
function lbOpen(fig) {
    if (LB.open)
        return;
    LB.list = visibleGal();
    const at = LB.list.map(x => x.fig).indexOf(fig);
    if (at < 0)
        return;
    LB.open = true;
    LB.last = fig;
    LB.root.hidden = false;
    lock();
    lbShow(at);
    MAIN.setAttribute('aria-hidden', 'true');
    requestAnimationFrame(() => LB.root.classList.add('on'));
    $('.x', LB.root).focus();
}
function lbClose() {
    if (!LB.open)
        return;
    LB.open = false;
    LB.root.classList.remove('on');
    setTimeout(() => { if (!LB.open)
        LB.root.hidden = true; }, 260);
    unlock();
    MAIN.removeAttribute('aria-hidden');
    if (LB.last && LB.last.focus)
        LB.last.focus();
}
document.addEventListener('click', e => { const target = e.target instanceof Element ? e.target : null; const f = target?.closest('.fig'); if (f instanceof HTMLElement)
    lbOpen(f); });
$('.x', LB.root).addEventListener('click', lbClose);
$('.pv', LB.root).addEventListener('click', () => lbShow(LB.i - 1));
$('.nx', LB.root).addEventListener('click', () => lbShow(LB.i + 1));
LB.root.addEventListener('click', (e) => { if (e.target === LB.root)
    lbClose(); });
LB.root.addEventListener('pointerdown', (e) => { LB.x = e.clientX; LB.y = e.clientY; });
LB.root.addEventListener('pointerup', (e) => {
    const dx = e.clientX - LB.x, dy = e.clientY - LB.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
        lbShow(LB.i + (dx < 0 ? 1 : -1));
});
const T = C.tracks, plEl = $('.player'), seek = $('#seek'), vol = $('#volume');
let localAudio = $('#local-audio');
let spareAudio = document.createElement('audio');
spareAudio.preload = 'none';
spareAudio.hidden = true;
localAudio.after(spareAudio);
const deckGains = new Map();
let fadeToken = 0, fadeTimer = 0, fadeBusy = false;
let fadeEnabled = store.get('noa-crossfade') !== 'off', normalizeEnabled = store.get('noa-normalize') !== 'off', autoSceneEnabled = store.get('noa-auto-scene') !== 'off';
const storedFade = Number(store.get('noa-crossfade-seconds') ?? '4');
let crossfadeSeconds = Number.isFinite(storedFade) ? Math.max(0, Math.min(8, storedFade)) : 4;
const measuredGains = { "tbYHzoBL8ec": 0.41543, "3Xzb2uNlf0s": 0.46079, "Bm2Eg2X4kZA": 0.45394, "Oq-xMg1xbic": 0.35934, "JBfAtRvW1Ao": 0.45499 };
const gainFor = (i) => normalizeEnabled ? (measuredGains[T[i]?.id] || 1) : 1;
let priorityQueue = [];
try {
    const a = JSON.parse(store.get('noa-priority-queue') || '[]');
    if (Array.isArray(a))
        priorityQueue = [...new Set(a.filter(i => Number.isInteger(i) && i >= 0 && i < T.length))];
}
catch { }
let playedHistory = [];
let fadeFailedFor = -1;
const PL = { api: false, ready: false, p: null, cur: 0, pending: null, timer: 0, apiTimer: 0, readyTimer: 0, drag: false, bad: {} };
let localURL = null;
let bundled = false;
let previousVolume = 70;
let shuffle = store.get('noa-shuffle') !== 'off', repeat = store.get('noa-repeat') === 'on';
let autoPending = false, autoEnabled = store.get('noa-music-autostart') !== 'off', playSerial = 0;
let shuffleBag = [], trackHistory = [];
const mini = $('#mini-music');
const miniCover = $('#mini-cover');
const miniQueue = $('#mini-queue');
const miniQueueList = $('#mini-queue-list');
const miniQueueEmpty = $('#mini-queue-empty');
const lyricsCard = $('#music-lyrics');
const lyricsTrack = $('#lyrics-track');
const lyricsCurrent = $('#lyrics-current');
const lyricsNext = $('#lyrics-next');
const lyricsProgress = $('#lyrics-progress');
let spectrumVisible = true;
const trackScenes = { JBfAtRvW1Ao: 'rain', Bm2Eg2X4kZA: 'stars', '3Xzb2uNlf0s': 'aurora', 'Oq-xMg1xbic': 'rain', tbYHzoBL8ec: 'stars', local: 'stars' };
const lyricLibrary = new Map();
const lyricOffsets = new Map();
for (const t of T) {
    const n = Number(store.get('noa-lyric-offset-' + t.id) || 0);
    if (Number.isFinite(n))
        lyricOffsets.set(t.id, Math.max(-10, Math.min(10, n)));
}
let lyricWord = -2;
let lyricTrackId = '', lyricIndex = -2, lyricAnimation = null, lyricsEnabled = store.get('noa-lyrics-visible') !== 'off';
function lyricFingerprint(raw) { let h = 2166136261; for (let i = 0; i < raw.length; i++)
    h = Math.imul(h ^ raw.charCodeAt(i), 16777619); return h >>> 0; }
for (const t of T) {
    try {
        if (t.lyrics)
            lyricLibrary.set(t.id, (0, music_visuals_1.parseLyrics)(t.lyrics));
        const key = 'noa-lyrics-' + t.id, raw = store.get(key);
        const data = raw ? JSON.parse(raw) : null;
        const stockV32 = { "Oq-xMg1xbic": 2121551697, "tbYHzoBL8ec": 1272570818 };
        if (t.lyrics && data?.raw && stockV32[t.id] === lyricFingerprint(data.raw)) {
            store.set(key, JSON.stringify({ raw: t.lyrics }));
            continue;
        }
        const oldVincy = t.id === '3Xzb2uNlf0s' && store.get('noa-vincy-timing-revision') !== '31';
        const obsolete = oldVincy && (!data || (typeof data.raw === 'string' && lyricFingerprint(data.raw) === 2842724441));
        if (obsolete) {
            lyricOffsets.set(t.id, 0);
            store.set('noa-lyric-offset-' + t.id, '0');
            if (data)
                store.set(key, JSON.stringify({ raw: t.lyrics }));
        }
        else if (data?.removed === true)
            lyricLibrary.delete(t.id);
        else if (typeof data?.raw === 'string')
            lyricLibrary.set(t.id, (0, music_visuals_1.parseLyrics)(data.raw, data.seconds));
        if (oldVincy)
            store.set('noa-vincy-timing-revision', '31');
    }
    catch { }
}
const pulseDetector = new music_visuals_1.PulseDetector();
function resetReactiveVisuals() { pulseDetector.reset(); music_visuals_1.audioVisual.energy = music_visuals_1.audioVisual.bass = music_visuals_1.audioVisual.treble = music_visuals_1.audioVisual.dynamics = music_visuals_1.audioVisual.accent = 0; (0, music_visuals_1.clearDynamics)(); }
function applySceneVisual(scene) { html.dataset.musicScene = 'on'; html.dataset.noaScene = scene; document.querySelectorAll('button[data-noa-scene]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.noaScene === scene))); }
function applyTrackScene(id) { if (autoSceneEnabled) {
    html.dataset.musicMood = trackMoods[id] || 'neutral';
    applySceneVisual(trackScenes[id] || 'stars');
} }
function updateCrossfadeLabel() { $('#music-crossfade-label').textContent = crossfadeSeconds.toFixed(1).replace('.', ',') + ' s'; }
function toggleMiniQueue(force) { const open = force ?? miniQueue.hidden; miniQueue.hidden = !open; $('#mini-queue-toggle').setAttribute('aria-expanded', String(open)); if (open)
    $('#mini-queue-close').focus({ preventScroll: true });
else if (miniQueue.contains(document.activeElement))
    $('#mini-queue-toggle').focus({ preventScroll: true }); }
function syncLyricsMeta(id, title) { lyricTrackId = id; lyricIndex = -2; lyricWord = -2; lyricsCard.dataset.mood = trackMoods[id] || 'neutral'; lyricsTrack.textContent = title || 'Seleção NOA'; const select = $('#lyrics-select'); if (select && Array.from(select.options).some(o => o.value === id)) {
    select.value = id;
    select.dispatchEvent(new Event('change'));
} lyricsProgress.style.transform = 'scaleX(0)'; lyricsCard.hidden = !lyricsEnabled || !lyricLibrary.has(id); $('#mini-lyrics-toggle').setAttribute('aria-pressed', String(lyricsEnabled)); $('#lyrics-state').textContent = lyricLibrary.has(id) ? 'Letra disponível. Horários incluídos são referências; revise com o áudio.' : 'Importe um arquivo LRC ou TXT para esta faixa.'; updateLyrics(0, 0); }
function updateLyrics(current, duration) { const score = (0, music_visuals_1.scoreAt)(lyricTrackId, current); music_visuals_1.audioVisual.score = autoSceneEnabled ? score.light : 0; music_visuals_1.audioVisual.depth = autoSceneEnabled ? score.depth : 0; if (lyricsCard.hidden)
    return; const data = lyricLibrary.get(lyricTrackId); if (!data)
    return; current = Math.max(-.001, current + (lyricOffsets.get(lyricTrackId) || 0)); const cues = data.cues, idx = (0, music_visuals_1.cueAt)(cues, current); if (idx !== lyricIndex) {
    lyricIndex = idx;
    lyricsCurrent.textContent = idx < 0 ? '♪' : cues[idx].text || '♪';
    lyricWord = -2;
    const words = idx < 0 ? undefined : cues[idx].words;
    if (words) {
        lyricsCurrent.replaceChildren(...words.map(w => el('span', 'lyric-word', w.text)));
    }
    lyricsNext.textContent = cues[idx + 1]?.text || '';
    lyricsCard.dataset.instrumental = String(idx < 0 || !cues[idx].text);
    lyricAnimation?.cancel();
    if (html.dataset.motion !== 'reduced')
        lyricAnimation = lyricsCurrent.animate?.([{ opacity: .25, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' }) || null;
} const words = idx < 0 ? undefined : cues[idx].words; if (words) {
    const wi = (0, music_visuals_1.cueAt)(words, current);
    if (wi !== lyricWord) {
        lyricWord = wi;
        Array.from(lyricsCurrent.children).forEach((node, i) => { node.classList.toggle('sung', i < wi); node.classList.toggle('singing', i === wi); });
    }
} const start = idx < 0 ? 0 : cues[idx].at, end = cues[idx + 1]?.at || (Number.isFinite(duration) && duration > start ? duration : start + 4); lyricsProgress.style.transform = `scaleX(${Math.max(0, Math.min(1, (current - start) / Math.max(.4, end - start)))})`; }
function refreshLyrics() { const selection = $('#lyrics-select').value; syncLyricsMeta(lyricTrackId, $('#track-title').textContent); if (selection) {
    $('#lyrics-select').value = selection;
    $('#lyrics-select').dispatchEvent(new Event('change'));
} if (localURL)
    updateLyrics(localAudio.currentTime, localAudio.duration); }
function syncMini() {
    const title = $('#track-title').textContent, artist = $('#track-artist').textContent;
    $('#mini-title').textContent = title;
    $('#mini-artist').textContent = artist;
    mini.dataset.mood = plEl.dataset.mood || 'neutral';
    const t = T[PL.cur], src = plEl.dataset.source === 'local' || !t ? null : trackCover(t);
    if (src !== miniCover.getAttribute('src')) {
        miniCover.hidden = true;
        if (src) {
            miniCover.onload = () => { miniCover.hidden = false; };
            miniCover.onerror = () => { miniCover.hidden = true; };
            miniCover.src = src;
            if (miniCover.complete && miniCover.naturalWidth)
                miniCover.hidden = false;
        }
        else {
            miniCover.removeAttribute('src');
        }
    }
    lyricsCard.dataset.mood = mini.dataset.mood;
}
function clearAuto() { autoPending = false; }
function bagFor(current) { const a = T.map((_, i) => i).filter(i => i !== current && !PL.bad[i]); for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
} return a; }
const spectrumBars = Array.from(document.querySelectorAll('#eq i'));
let audioContext = null, analyser = null, spectrumTimer = 0;
let bins = null;
let spectrumBands = [];
const lastLevels = new Int16Array(spectrumBars.length).fill(-1);
function configureSpectrum(a, sampleRate) {
    const hz = sampleRate / a.fftSize;
    spectrumBands = spectrumBars.map((_, i) => {
        const lo = Math.min(a.frequencyBinCount - 1, Math.max(1, Math.floor(55 * Math.pow(120, i / spectrumBars.length) / hz)));
        return [lo, Math.min(a.frequencyBinCount, Math.max(lo + 1, Math.ceil(55 * Math.pow(120, (i + 1) / spectrumBars.length) / hz)))];
    });
}
function prepareSpectrum() {
    if (!localURL)
        return;
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC)
            return;
        audioContext ?? (audioContext = new AC());
        const ac = audioContext;
        void ac.resume().then(() => {
            if (!analyser && ac.state === 'running') {
                const a = ac.createAnalyser();
                a.fftSize = 1024;
                a.smoothingTimeConstant = .55;
                a.connect(ac.destination);
                for (const deck of [localAudio, spareAudio]) {
                    const gain = ac.createGain();
                    gain.gain.value = deck === localAudio ? (bundled ? gainFor(PL.cur) : 1) : 0;
                    ac.createMediaElementSource(deck).connect(gain);
                    gain.connect(a);
                    deckGains.set(deck, gain);
                }
                analyser = a;
                bins = new Uint8Array(a.frequencyBinCount);
                configureSpectrum(a, ac.sampleRate);
            }
            if (localURL && !localAudio.paused)
                startSpectrum();
        }).catch(() => { });
    }
    catch { }
}
function stopSpectrum() { clearInterval(spectrumTimer); spectrumTimer = 0; plEl.removeAttribute('data-spectrum'); lastLevels.fill(-1); for (const b of spectrumBars)
    b.style.removeProperty('--level'); resetReactiveVisuals(); }
function startSpectrum() {
    stopSpectrum();
    if (document.hidden || localAudio.paused || !localURL)
        return;
    if (spectrumVisible && analyser && audioContext?.state === 'running')
        plEl.dataset.spectrum = 'real';
    spectrumTimer = window.setInterval(() => {
        if (document.hidden || localAudio.paused || !localURL)
            return;
        updateLyrics(localAudio.currentTime, localAudio.duration);
        if (html.dataset.motion === 'reduced' || !analyser || !bins || audioContext?.state !== 'running') {
            resetReactiveVisuals();
            return;
        }
        if (!spectrumVisible && !autoSceneEnabled) {
            resetReactiveVisuals();
            return;
        }
        analyser.getByteFrequencyData(bins);
        if (spectrumVisible)
            for (let i = 0; i < spectrumBands.length; i++) {
                const [lo, hi] = spectrumBands[i];
                let peak = 0;
                for (let j = lo; j < hi; j++)
                    peak = Math.max(peak, bins[j]);
                const level = Math.round(peak * 40 / 255);
                if (lastLevels[i] !== level) {
                    lastLevels[i] = level;
                    spectrumBars[i].style.setProperty('--level', String(.08 + .92 * level / 40));
                }
            }
        if (!autoSceneEnabled) {
            resetReactiveVisuals();
            return;
        }
        const hz = audioContext.sampleRate / analyser.fftSize;
        music_visuals_1.audioVisual.beat = Math.max(music_visuals_1.audioVisual.beat * .72, pulseDetector.sample(bins, hz, performance.now() / 1000));
        let bass = 0, treble = 0, energy = 0, bc = 0, tc = 0, ec = 0;
        for (let i = 1; i < bins.length && i * hz <= 10000; i++) {
            const v = bins[i] / 255;
            energy += v;
            ec++;
            if (i * hz <= 250) {
                bass += v;
                bc++;
            }
            if (i * hz >= 2000 && i * hz <= 8000) {
                treble += v;
                tc++;
            }
        }
        (0, music_visuals_1.updateDynamics)(Math.min(1, energy / Math.max(1, ec) * 1.3), Math.min(1, bass / Math.max(1, bc) * 1.4));
        music_visuals_1.audioVisual.bass += (Math.min(1, bass / Math.max(1, bc) * 1.4) - music_visuals_1.audioVisual.bass) * .32;
        music_visuals_1.audioVisual.treble += (Math.min(1, treble / Math.max(1, tc) * 1.6) - music_visuals_1.audioVisual.treble) * .32;
        music_visuals_1.audioVisual.energy += (Math.min(1, energy / Math.max(1, ec) * 1.3) - music_visuals_1.audioVisual.energy) * .28;
    }, 80);
}
function playNative(automatic = false) { const serial = ++playSerial; if (!automatic) {
    clearAuto();
    prepareSpectrum();
} void localAudio.play().then(() => { if (serial !== playSerial)
    return; clearAuto(); prepareSpectrum(); }).catch((error) => { if (serial !== playSerial)
    return; setPlaying(false); const blocked = error instanceof DOMException && error.name === 'NotAllowedError'; if (automatic && blocked) {
    autoPending = true;
    status('Toque para começar a música.', '');
    $('#mini-state').textContent = 'Toque para ouvir';
}
else {
    clearAuto();
    status(blocked ? 'Toque em reproduzir para ouvir.' : 'Não foi possível reproduzir esta faixa.', 'err');
    $('#mini-state').textContent = 'Toque para tentar novamente';
} }); }
function updateMediaSession() {
    if (!('mediaSession' in navigator))
        return;
    try {
        const session = navigator.mediaSession;
        const t = T[PL.cur];
        const name = localURL && !bundled ? { title: $('#track-title').textContent, artist: 'Arquivo local' } : titleParts(t.title);
        session.metadata = new MediaMetadata({ title: name.title, artist: name.artist, album: 'NOA · Seleção musical', artwork: bundled ? [{ src: trackCover(t) }] : [] });
        session.playbackState = localAudio.paused ? 'paused' : 'playing';
    }
    catch { }
}
function updateMediaPosition() { if (!localURL || !('mediaSession' in navigator))
    return; try {
    const d = localAudio.duration;
    if (Number.isFinite(d) && d > 0)
        navigator.mediaSession.setPositionState({ duration: d, playbackRate: localAudio.playbackRate, position: Math.min(d, Math.max(0, localAudio.currentTime)) });
}
catch { } }
function initMediaSession() { if (!('mediaSession' in navigator))
    return; const actions = { play: () => { if (localURL)
        playNative();
    else if (T[PL.cur]?.audio)
        pick(PL.cur, true); }, pause: () => localAudio.pause(), previoustrack: () => previousTrack(), nexttrack: () => nextTrack(), seekto: d => { if (localURL && Number.isFinite(localAudio.duration) && typeof d.seekTime === 'number')
        localAudio.currentTime = Math.min(localAudio.duration, Math.max(0, d.seekTime)); }, seekbackward: d => { if (localURL)
        localAudio.currentTime = Math.max(0, localAudio.currentTime - (d.seekOffset || 10)); }, seekforward: d => { if (localURL && Number.isFinite(localAudio.duration))
        localAudio.currentTime = Math.min(localAudio.duration, localAudio.currentTime + (d.seekOffset || 10)); } }; for (const [action, handler] of Object.entries(actions))
    try {
        navigator.mediaSession.setActionHandler(action, handler);
    }
    catch { } }
function status(msg, kind = '') { const n = $('#now'); n.textContent = msg; n.dataset.kind = kind; plEl.dataset.status = kind; $('#mini-state').textContent = kind === 'play' ? 'Reproduzindo' : kind === 'load' ? 'Carregando…' : msg; }
function titleParts(t) { const split = t.indexOf(' — '); return split < 0 ? { title: t, artist: '' } : { title: t.slice(split + 3), artist: t.slice(0, split) }; }
function trackCover(t) { return str(t.cover) || ('https://i.ytimg.com/vi/' + t.id + '/mqdefault.jpg'); }
function setCoverArt(src, title = '') {
    const img = $('#record-cover'), print = $('.record-print');
    if (!img || !print)
        return;
    const fallback = () => { img.hidden = true; print.hidden = false; plEl.style.removeProperty('--cover-image'); };
    img.onload = null;
    img.onerror = null;
    fallback();
    if (!src) {
        img.removeAttribute('src');
        return;
    }
    const reveal = () => { img.hidden = false; print.hidden = true; plEl.style.setProperty('--cover-image', 'url("' + src.replace(/"/g, '%22') + '")'); };
    img.onload = reveal;
    img.onerror = fallback;
    img.alt = title ? 'Miniatura de ' + title : '';
    img.src = src;
    if (img.complete && img.naturalWidth > 0)
        reveal();
}
const trackMoods = { JBfAtRvW1Ao: 'wine', Bm2Eg2X4kZA: 'amber', '3Xzb2uNlf0s': 'violet', 'Oq-xMg1xbic': 'silver', tbYHzoBL8ec: 'rose' };
let lastMusicMood = '';
let titleTransition = null;
function musicMood(id) {
    const mood = trackMoods[id] || 'neutral';
    plEl.dataset.mood = mood;
    mini.dataset.mood = mood;
    lyricsCard.dataset.mood = mood;
    applyTrackScene(id);
    if (lastMusicMood === id)
        return;
    lastMusicMood = id;
    titleTransition?.cancel();
    if (html.dataset.motion !== 'reduced')
        titleTransition = $('.music-heading').animate?.([{ opacity: .35, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 340, easing: 'cubic-bezier(.2,.75,.25,1)' }) || null;
}
function setLabel() { if (!T.length)
    return; const t = T[PL.cur], v = titleParts(t.title), cover = trackCover(t); $('#track-title').textContent = v.title; $('#track-artist').textContent = v.artist; $('#track-position').textContent = `FAIXA ${String(PL.cur + 1).padStart(2, '0')} / ${String(T.length).padStart(2, '0')}`; $('#yt-direct').href = 'https://www.youtube.com/watch?v=' + t.id; $('#music-source').textContent = t.audio ? 'MP3' : 'YOUTUBE'; plEl.dataset.source = t.audio ? 'bundled' : 'youtube'; $('#yt-direct').hidden = !!t.audio; setCoverArt(cover, v.title); musicMood(t.id); syncLyricsMeta(t.id, v.title); syncMini(); }
function setPlaying(on) { if (!on)
    stopSpectrum(); for (const q of ['#eq', '#disc', '.player'])
    $(q).classList.toggle('on', on); const b = $('#play'); b.replaceChildren(svg('ico', on ? 'pause' : 'play')); b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Pausar' : 'Tocar'); const m = $('#mini-play'); m.replaceChildren(svg('ico', on ? 'pause' : 'play')); m.setAttribute('aria-pressed', String(on)); m.setAttribute('aria-label', on ? 'Pausar' : 'Tocar'); mini.classList.toggle('playing', on); for (const control of $$('[data-music-toggle]')) {
    control.replaceChildren(svg('ico', on ? 'pause' : 'play'));
    control.setAttribute('aria-label', on ? 'Pausar música' : 'Tocar música');
    control.setAttribute('aria-pressed', String(on));
} }
function updateRange(input) { input.style.setProperty('--fill', `${Number(input.value)}%`); }
function progress(c, d) { $('#mini-progress').style.transform = `scaleX(${d > 0 && Number.isFinite(d) ? Math.max(0, Math.min(1, c / d)) : 0})`; updateMediaPosition(); plEl.style.setProperty('--needle-progress', String(d > 0 && Number.isFinite(d) ? Math.max(0, Math.min(1, c / d)) : 0)); if (!PL.drag) {
    seek.value = String(d > 0 && Number.isFinite(d) ? Math.max(0, Math.min(100, 100 * c / d)) : 0);
    updateRange(seek);
} seek.disabled = !(d > 0 && Number.isFinite(d)); $('#t1').textContent = fmt(c); $('#t2').textContent = fmt(d); updateLyrics(c, d); }
function setVolume(value) { const n = Math.max(0, Math.min(100, value)); vol.value = String(n); updateRange(vol); for (const deck of [localAudio, spareAudio]) {
    deck.volume = n / 100;
    deck.muted = n === 0;
} try {
    PL.p?.setVolume(n);
    if (n)
        PL.p?.unMute();
    else
        PL.p?.mute();
}
catch { } $('#volume-value').textContent = n + '%'; const mute = $('#mute'); mute.replaceChildren(svg('ico', n ? 'volume' : 'muted')); mute.setAttribute('aria-label', n ? 'Silenciar' : 'Ativar som'); mute.setAttribute('aria-pressed', String(!n)); }
vol.addEventListener('input', () => { const n = Number(vol.value); if (n)
    previousVolume = n; setVolume(n); });
$('#mute').addEventListener('click', () => { if (Number(vol.value)) {
    previousVolume = Number(vol.value);
    setVolume(0);
}
else
    setVolume(previousVolume || 70); });
setVolume(70);
function stopLocal() { localAudio.playbackRate = 1; const review = $('#lyrics-review-rate'); if (review)
    review.value = '1'; cancelFade(); ++playSerial; if (!localURL)
    return; const old = localURL; localURL = null; bundled = false; stopSpectrum(); localAudio.pause(); localAudio.removeAttribute('src'); localAudio.load(); if (old.startsWith('blob:'))
    URL.revokeObjectURL(old); $('#local-panel').hidden = true; $('#local-file').value = ''; setPlaying(false); progress(0, 0); lyricsCard.hidden = true; }
function stopTick() { clearInterval(PL.timer); PL.timer = 0; }
function startTick() { stopTick(); PL.timer = setInterval(() => { if (PL.drag || document.hidden || localURL)
    return; try {
    progress(PL.p.getCurrentTime(), PL.p.getDuration());
}
catch { } }, 350); }
function markCurrent() { $$('#tracks li').forEach((l, i) => { l.classList.toggle('on', i === PL.cur && (!localURL || bundled)); if (i === PL.cur && (!localURL || bundled))
    l.setAttribute('aria-current', 'true');
else
    l.removeAttribute('aria-current'); }); setLabel(); }
function setBad(i, on) { PL.bad[i] = on; $('#tracks li[data-i="' + i + '"]').classList.toggle('bad', on); }
$('#local-file').addEventListener('change', () => { const input = $('#local-file'), file = input.files?.[0]; if (!file)
    return; if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name)) {
    status('Escolha um arquivo de áudio compatível.', 'err');
    return;
} PL.pending = null; try {
    PL.p?.pauseVideo();
}
catch { } stopTick(); stopLocal(); localURL = URL.createObjectURL(file); localAudio.src = localURL; gainNow(localAudio, 1); const name = file.name.replace(/\.[^.]+$/, ''); $('#local-panel').hidden = false; $('#local-title').textContent = name; $('#track-title').textContent = name; $('#track-artist').textContent = 'Arquivo do seu aparelho'; $('#track-position').textContent = 'SUA BIBLIOTECA'; $('#music-source').textContent = 'LOCAL'; plEl.dataset.source = 'local'; setCoverArt(null); musicMood('local'); lyricLibrary.delete('local'); syncLyricsMeta('local', name); syncMini(); $$('#tracks li').forEach((l) => { l.classList.remove('on'); l.removeAttribute('aria-current'); }); $('#yt-host').hidden = true; progress(0, 0); status('Preparando o áudio local…', 'load'); playNative(); });
function bindDeck(deck) {
    deck.addEventListener('play', () => { if (deck !== localAudio || !localURL)
        return; if (bundled)
        rememberPlayed(PL.cur); clearAuto(); try {
        PL.p?.pauseVideo();
    }
    catch { } setPlaying(true); startSpectrum(); updateMediaSession(); status(bundled ? 'Reproduzindo MP3' : 'Reproduzindo áudio local', 'play'); });
    deck.addEventListener('pause', () => { if (deck === localAudio && localURL && deck.paused && !deck.ended) {
        cancelFade();
        ++playSerial;
        clearAuto();
        setPlaying(false);
        updateMediaSession();
        status('Áudio pausado');
    } });
    for (const ev of ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked'])
        deck.addEventListener(ev, () => { if (deck !== localAudio || !localURL)
            return; progress(deck.currentTime, deck.duration); if (ev === 'timeupdate')
            maybeFade(); });
    deck.addEventListener('seeking', () => { if (deck === localAudio) {
        cancelFade();
        pulseDetector.reset();
        music_visuals_1.audioVisual.beat = 0;
    } });
    deck.addEventListener('ended', () => { if (deck !== localAudio || !localURL)
        return; cancelFade(); setPlaying(false); if (repeat) {
        deck.currentTime = 0;
        playNative();
    }
    else if (bundled)
        nextTrack();
    else
        status('Faixa concluída · toque para ouvir novamente'); });
    deck.addEventListener('error', () => { if (deck === localAudio && localURL) {
        cancelFade();
        setPlaying(false);
        status('Não foi possível ler o áudio. Tente MP3 ou WAV.', 'err');
    } });
    deck.addEventListener('playing', () => { if (deck === localAudio && localURL) {
        startSpectrum();
        updateMediaSession();
    } });
}
function gainNow(deck, value) { const g = deckGains.get(deck)?.gain, ac = audioContext; if (g && ac) {
    g.cancelScheduledValues(ac.currentTime);
    g.setValueAtTime(value, ac.currentTime);
} }
function unloadDeck(deck) { deck.pause(); deck.removeAttribute('src'); deck.load(); gainNow(deck, 0); }
function cancelFade() { ++fadeToken; clearTimeout(fadeTimer); fadeTimer = 0; fadeBusy = false; unloadDeck(spareAudio); gainNow(localAudio, bundled ? gainFor(PL.cur) : 1); delete plEl.dataset.crossfade; }
function rememberPlayed(i) { if (playedHistory[playedHistory.length - 1] !== i) {
    playedHistory.push(i);
    if (playedHistory.length > 80)
        playedHistory.shift();
    renderQueue();
} }
function plannedNext() { if (priorityQueue.length)
    return priorityQueue.filter(i => i !== PL.cur && !PL.bad[i]); if (shuffle) {
    shuffleBag = shuffleBag.filter(i => i !== PL.cur && !PL.bad[i]);
    if (!shuffleBag.length)
        shuffleBag = bagFor(PL.cur);
    return shuffleBag;
} return Array.from({ length: Math.max(0, T.length - 1) }, (_, i) => (PL.cur + i + 1) % T.length).filter(i => !PL.bad[i]); }
function consumeNext(i) { priorityQueue = priorityQueue.filter(x => x !== i); shuffleBag = shuffleBag.filter(x => x !== i); }
function maybeFade() {
    if (localAudio.playbackRate !== 1)
        return;
    const from = localAudio, ac = audioContext, remain = from.duration - from.currentTime;
    if (!fadeEnabled || crossfadeSeconds <= 0 || repeat || !bundled || fadeBusy || fadeFailedFor === PL.cur || from.paused || from.seeking || document.hidden || !ac || ac.state !== 'running' || !analyser || !deckGains.has(spareAudio) || !Number.isFinite(remain) || remain > crossfadeSeconds || remain < .4)
        return;
    const index = plannedNext()[0], t = T[index];
    if (!t?.audio || index === PL.cur)
        return;
    const to = spareAudio, token = ++fadeToken;
    fadeBusy = true;
    gainNow(to, 0);
    to.src = t.audio;
    to.volume = from.volume;
    to.muted = from.muted;
    if (t.id === '3Xzb2uNlf0s')
        try {
            to.currentTime = 11.58;
        }
        catch { }
    void to.play().then(() => {
        if (token !== fadeToken || from !== localAudio)
            return;
        if (from.paused || from.ended || repeat || !fadeEnabled || crossfadeSeconds <= 0) {
            cancelFade();
            return;
        }
        const duration = Math.max(.15, Math.min(crossfadeSeconds, from.duration - from.currentTime));
        const start = ac.currentTime;
        const oldGain = gainFor(PL.cur), newGain = gainFor(index), g0 = deckGains.get(from).gain, g1 = deckGains.get(to).gain;
        g0.cancelScheduledValues(start);
        g1.cancelScheduledValues(start);
        g0.setValueAtTime(oldGain, start);
        g1.setValueAtTime(0, start);
        g0.linearRampToValueAtTime(0, start + duration);
        g1.linearRampToValueAtTime(newGain, start + duration);
        from.removeAttribute('id');
        from.hidden = true;
        from.controls = false;
        to.id = 'local-audio';
        to.hidden = false;
        to.controls = true;
        localAudio = to;
        spareAudio = from;
        trackHistory.push(PL.cur);
        if (trackHistory.length > 80)
            trackHistory.shift();
        PL.cur = index;
        consumeNext(index);
        localURL = t.audio;
        markCurrent();
        rememberPlayed(index);
        renderQueue();
        $('#local-title').textContent = titleParts(t.title).title;
        setPlaying(true);
        startSpectrum();
        updateMediaSession();
        progress(to.currentTime, to.duration);
        status('Transição suave entre faixas', 'play');
        plEl.dataset.crossfade = 'active';
        fadeTimer = window.setTimeout(() => { if (token === fadeToken) {
            unloadDeck(from);
            fadeBusy = false;
            fadeTimer = 0;
            delete plEl.dataset.crossfade;
            status('Reproduzindo MP3', 'play');
        } }, duration * 1000 + 100);
    }).catch(() => { if (token === fadeToken) {
        fadeFailedFor = PL.cur;
        cancelFade();
    } });
}
bindDeck(localAudio);
bindDeck(spareAudio);
window.addEventListener('pagehide', () => { cancelFade(); if (localURL)
    localAudio.pause(); stopSpectrum(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) {
    stopSpectrum();
    if (fadeBusy)
        cancelFade();
}
else if (localURL && !localAudio.paused) {
    prepareSpectrum();
    startSpectrum();
} });
safe('tracks', () => { const disc = $('#disc'); if (disc && !$('#record-cover', disc)) {
    const img = el('img', 'plabel');
    img.id = 'record-cover';
    img.alt = '';
    img.hidden = true;
    img.decoding = 'async';
    img.loading = 'eager';
    disc.prepend(img);
} T.forEach((t, i) => { const li = el('li'); li.dataset.i = String(i); li.dataset.mood = trackMoods[t.id] || 'neutral'; const b = el('button', 'pick'); b.type = 'button'; const n = el('span', 'track-no', String(i + 1).padStart(2, '0')), art = el('span', 'track-art'); const cover = trackCover(t); const img = el('img', 'track-art-img'); img.src = cover; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'strict-origin-when-cross-origin'; img.onerror = () => { img.hidden = true; art.classList.add('track-art--fallback'); }; art.append(img, svg('ico', 'note')); const parts = titleParts(t.title), w = el('span', 'track-copy'); w.append(el('span', 'tt', parts.title), el('small', '', parts.artist)); if (t.audio) {
    const duration = el('span', 'track-duration', str(t.durationLabel));
    duration.setAttribute('aria-label', 'Duração ' + str(t.durationLabel));
    w.append(duration);
} b.append(n, art, w); b.addEventListener('click', () => pick(i, true)); const a = el('a', 'track-external'); a.href = 'https://youtu.be/' + t.id; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.setAttribute('aria-label', 'Abrir ' + t.title + ' no YouTube'); a.append(svg('ico', 'external')); li.append(b); if (!t.audio)
    li.append(a);
else {
    const badge = el('span', 'track-format', 'MP3');
    badge.setAttribute('aria-hidden', 'true');
    li.append(badge);
} $('#tracks').appendChild(li); }); });
function fail(msg) { clearTimeout(PL.apiTimer); clearTimeout(PL.readyTimer); PL.apiTimer = PL.readyTimer = 0; PL.api = false; PL.ready = false; PL.pending = null; try {
    PL.p?.destroy?.();
}
catch { } PL.p = null; const host = $('#yt-host'); host.replaceChildren(el('div')); host.firstElementChild.id = 'yt'; host.hidden = true; plEl.dataset.s = ''; if (!localURL) {
    setPlaying(false);
    stopTick();
    status(msg, 'err');
} }
function loadAPI() { if (PL.api || PL.p || !T.length)
    return; if (!/^https?:$/.test(location.protocol)) {
    status('Para ouvir aqui, abra a versão HTTPS. Você também pode ouvir no YouTube ou escolher um áudio local.', 'err');
    return;
} if (!navigator.onLine) {
    status('Sem conexão. O áudio local continua disponível.', 'err');
    return;
} PL.api = true; status('Conectando ao YouTube…', 'load'); plEl.dataset.s = 'load'; if (window.YT?.Player) {
    buildPlayer();
    return;
} PL.apiTimer = setTimeout(() => { PL.apiTimer = 0; $('script[src="https://www.youtube.com/iframe_api"]')?.remove(); fail('Conexão com o YouTube demorou. Tente novamente.'); }, 9000); window.onYouTubeIframeAPIReady = () => { clearTimeout(PL.apiTimer); PL.apiTimer = 0; if (PL.api && !localURL)
    buildPlayer();
else
    PL.api = false; }; let script = $('script[src="https://www.youtube.com/iframe_api"]'); if (!script) {
    script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => { script.remove(); fail('YouTube indisponível. Use o link ou um áudio local.'); };
    document.head.append(script);
} }
function buildPlayer() { if (PL.p || localURL)
    return; const vars = new URLSearchParams({ enablejsapi: '1', playsinline: '1', rel: '0', origin: location.origin, autoplay: '0' }), frame = document.createElement('iframe'); frame.id = 'yt'; frame.title = 'Reprodutor oficial do YouTube'; frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; frame.allowFullscreen = true; frame.src = 'https://www.youtube-nocookie.com/embed/' + T[PL.cur].id + '?' + vars; const host = $('#yt-host'); host.hidden = false; host.replaceChildren(frame); try {
    PL.p = new YT.Player('yt', { events: { onReady, onStateChange: onState, onError: onErr, onAutoplayBlocked: () => { if (localURL)
                return; setPlaying(false); stopTick(); plEl.dataset.s = ''; status('Toque novamente para iniciar o vídeo.'); } } });
    PL.readyTimer = setTimeout(() => { if (!PL.ready)
        fail('O vídeo não respondeu. Tente novamente.'); }, 12000);
}
catch {
    fail('Não foi possível iniciar o player.');
} }
function onReady() { PL.ready = true; clearTimeout(PL.readyTimer); PL.readyTimer = 0; plEl.dataset.s = ''; setVolume(Number(vol.value)); if (localURL)
    return; status('Pronto para ouvir'); if (PL.pending) {
    const p = PL.pending;
    PL.pending = null;
    pick(p.i, p.go);
} }
function onState(e) { if (localURL) {
    if (e.data === 1)
        try {
            PL.p?.pauseVideo();
        }
        catch { }
    return;
} const s = e.data; if (s === 1) {
    setPlaying(true);
    setBad(PL.cur, false);
    plEl.dataset.s = '';
    status('Reproduzindo', 'play');
    startTick();
}
else if (s === 3) {
    plEl.dataset.s = 'load';
    status('Carregando vídeo…', 'load');
}
else if (s === 2) {
    setPlaying(false);
    stopTick();
    status('Pausado');
}
else if (s === 0) {
    setPlaying(false);
    stopTick();
    if (repeat) {
        try {
            PL.p?.seekTo(0, true);
            PL.p?.playVideo();
        }
        catch { }
    }
    else
        nextTrack();
}
else {
    setPlaying(false);
    plEl.dataset.s = '';
} }
function onErr(e) { if (localURL)
    return; setBad(PL.cur, true); setPlaying(false); stopTick(); plEl.dataset.s = ''; status(e.data === 153 ? 'YouTube não identificou esta página. Use o link externo.' : [101, 150].includes(e.data) ? 'Esta faixa não permite incorporação. Abra no YouTube.' : 'Vídeo indisponível. Tente outra faixa.', 'err'); }
function pick(i, go, remember = true) {
    if (!T.length)
        return;
    clearAuto();
    stopLocal();
    const next = (i % T.length + T.length) % T.length;
    if (remember && next !== PL.cur) {
        trackHistory.push(PL.cur);
        if (trackHistory.length > 80)
            trackHistory.shift();
    }
    PL.cur = next;
    fadeFailedFor = -1;
    consumeNext(next);
    markCurrent();
    renderQueue();
    setPlaying(false);
    stopTick();
    progress(0, 0);
    const track = T[PL.cur];
    if (track.audio) {
        PL.pending = null;
        try {
            PL.p?.pauseVideo();
        }
        catch { }
        bundled = true;
        localURL = track.audio;
        localAudio.src = track.audio;
        gainNow(localAudio, gainFor(PL.cur));
        $('#yt-host').hidden = true;
        $('#local-panel').hidden = false;
        $('#local-title').textContent = titleParts(track.title).title;
        plEl.dataset.s = '';
        status('Faixa MP3 disponível', '');
        if (go)
            playNative();
        return;
    }
    if (!PL.ready) {
        PL.pending = { i: PL.cur, go };
        loadAPI();
        return;
    }
    if (!navigator.onLine) {
        status('Sem internet.', 'err');
        return;
    }
    $('#yt-host').hidden = false;
    plEl.dataset.s = 'load';
    status('Carregando vídeo…', 'load');
    try {
        go ? PL.p.loadVideoById(T[PL.cur].id) : PL.p.cueVideoById(T[PL.cur].id);
    }
    catch {
        fail('O player não respondeu. Tente novamente.');
    }
}
function step(d) { if (!T.length)
    return; let n = PL.cur; for (let k = 0; k < T.length; k++) {
    n = (n + d + T.length) % T.length;
    if (!PL.bad[n]) {
        pick(n, true);
        return;
    }
} status('Nenhuma faixa disponível aqui. Use os links externos.', 'err'); }
function togglePlayback() { clearAuto(); if (localURL) {
    if (localAudio.paused)
        playNative();
    else {
        ++playSerial;
        localAudio.pause();
    }
    return;
} if (T[PL.cur]?.audio) {
    pick(PL.cur, true);
    return;
} if (!PL.ready) {
    PL.pending = { i: PL.cur, go: true };
    loadAPI();
    return;
} try {
    PL.p.getPlayerState() === 1 ? PL.p.pauseVideo() : PL.p.playVideo();
}
catch {
    fail('O player não respondeu. Tente novamente.');
} }
$('#play').addEventListener('click', togglePlayback);
$('#mini-play').addEventListener('click', togglePlayback);
document.addEventListener('click', e => { if (e.target instanceof Element && e.target.closest('[data-music-toggle]'))
    togglePlayback(); });
function renderQueue() {
    const list = $('#music-queue'), hist = $('#music-history');
    if (!list || !hist)
        return;
    const order = plannedNext();
    store.set('noa-priority-queue', JSON.stringify(priorityQueue));
    list.replaceChildren();
    hist.replaceChildren();
    miniQueueList.replaceChildren();
    order.forEach((i, pos) => { const row = el('li', 'queue-row'); const title = titleParts(T[i].title); const label = el('button', 'queue-title', title.title); label.type = 'button'; label.addEventListener('click', () => { toggleMiniQueue(false); pick(i, true); }); row.append(label); for (const [offset, icon, labelText] of [[-1, '↑', 'Subir'], [1, '↓', 'Descer']]) {
        const button = el('button', 'queue-move', icon);
        button.type = 'button';
        button.disabled = pos + offset < 0 || pos + offset >= order.length;
        button.setAttribute('aria-label', labelText + ' ' + title.title);
        button.addEventListener('click', () => { cancelFade(); const updated = [...order]; [updated[pos], updated[pos + offset]] = [updated[pos + offset], updated[pos]]; priorityQueue = updated; renderQueue(); });
        row.append(button);
    } list.append(row); {
        const miniRow = el('li');
        const b = el('button', '', title.title);
        b.type = 'button';
        const artist = title.artist ? el('small', '', title.artist) : null;
        b.addEventListener('click', () => { toggleMiniQueue(false); pick(i, true); });
        miniRow.append(b);
        for (const [offset, mark] of [[-1, '↑'], [1, '↓']]) {
            const move = el('button', 'mini-move', mark);
            move.type = 'button';
            move.disabled = pos + offset < 0 || pos + offset >= order.length;
            move.setAttribute('aria-label', (offset < 0 ? 'Subir ' : 'Descer ') + title.title);
            move.addEventListener('click', event => { event.stopPropagation(); cancelFade(); const updated = [...order]; [updated[pos], updated[pos + offset]] = [updated[pos + offset], updated[pos]]; priorityQueue = updated; renderQueue(); });
            miniRow.append(move);
        }
        if (artist)
            b.append(artist);
        miniQueueList.append(miniRow);
    } });
    miniQueueEmpty.hidden = miniQueueList.children.length > 0;
    for (const i of playedHistory.slice(-10).reverse()) {
        const row = el('li');
        const b = el('button', 'queue-title', T[i].title);
        b.type = 'button';
        b.addEventListener('click', () => pick(i, true));
        row.append(b);
        hist.append(row);
    }
    if (!playedHistory.length)
        hist.append(el('li', 'queue-empty', 'Nenhuma faixa anterior ainda.'));
}
function nextTrack() { const next = plannedNext()[0]; if (next !== undefined)
    pick(next, true);
else
    step(1); }
function previousTrack() { const prev = shuffle ? trackHistory.pop() : undefined; if (prev !== undefined)
    pick(prev, true, false);
else
    step(-1); }
$('#prev').addEventListener('click', previousTrack);
$('#next').addEventListener('click', nextTrack);
$('#mini-prev').addEventListener('click', previousTrack);
$('#mini-next').addEventListener('click', nextTrack);
$('#shuffle').addEventListener('click', () => { cancelFade(); shuffle = !shuffle; store.set('noa-shuffle', shuffle ? 'on' : 'off'); shuffleBag = []; priorityQueue = []; $('#shuffle').setAttribute('aria-pressed', String(shuffle)); renderQueue(); });
$('#repeat').addEventListener('click', () => { cancelFade(); repeat = !repeat; store.set('noa-repeat', repeat ? 'on' : 'off'); $('#repeat').setAttribute('aria-pressed', String(repeat)); });
seek.addEventListener('input', () => { PL.drag = true; updateRange(seek); try {
    const d = localURL ? localAudio.duration : PL.p?.getDuration() || 0;
    $('#t1').textContent = fmt(d * Number(seek.value) / 100);
}
catch { } });
seek.addEventListener('change', () => { try {
    const d = localURL ? localAudio.duration : PL.p?.getDuration() || 0;
    if (d > 0 && Number.isFinite(d)) {
        const c = d * Number(seek.value) / 100;
        if (localURL)
            localAudio.currentTime = c;
        else
            PL.p?.seekTo(c, true);
    }
}
catch { } PL.drag = false; });
seek.addEventListener('pointercancel', () => { PL.drag = false; });
const fadeCheck = $('#music-crossfade'), normCheck = $('#music-normalize'), fadeRange = $('#music-crossfade-seconds'), autoSceneCheck = $('#music-auto-scene');
fadeCheck.checked = fadeEnabled;
normCheck.checked = normalizeEnabled;
autoSceneCheck.checked = autoSceneEnabled;
fadeRange.value = String(crossfadeSeconds);
updateCrossfadeLabel();
fadeCheck.addEventListener('change', () => { fadeEnabled = fadeCheck.checked; store.set('noa-crossfade', fadeEnabled ? 'on' : 'off'); cancelFade(); });
normCheck.addEventListener('change', () => { normalizeEnabled = normCheck.checked; store.set('noa-normalize', normalizeEnabled ? 'on' : 'off'); cancelFade(); });
fadeRange.addEventListener('input', () => { crossfadeSeconds = Math.max(0, Math.min(8, Number(fadeRange.value) || 0)); store.set('noa-crossfade-seconds', String(crossfadeSeconds)); updateCrossfadeLabel(); if (crossfadeSeconds === 0 && fadeBusy)
    cancelFade(); });
autoSceneCheck.addEventListener('change', () => { autoSceneEnabled = autoSceneCheck.checked; store.set('noa-auto-scene', autoSceneEnabled ? 'on' : 'off'); if (autoSceneEnabled) {
    if (localURL && !bundled)
        applyTrackScene('local');
    else if (T[PL.cur])
        applyTrackScene(T[PL.cur].id);
}
else {
    delete html.dataset.musicScene;
    delete html.dataset.musicMood;
    resetReactiveVisuals();
    document.dispatchEvent(new Event('noa-restore-scene'));
} if (localURL && !localAudio.paused)
    startSpectrum(); });
$('#queue-reset').addEventListener('click', () => { cancelFade(); priorityQueue = []; shuffleBag = []; renderQueue(); });
$('#mini-queue-toggle').addEventListener('click', () => toggleMiniQueue(miniQueue.hidden));
$('#mini-queue-close').addEventListener('click', () => toggleMiniQueue(false));
document.addEventListener('click', e => { const target = e.target; if (!target)
    return; if (target.closest('#mini-queue-toggle'))
    return; if (!miniQueue.hidden && !target.closest('#mini-queue'))
    toggleMiniQueue(false); });
const lyricSelect = $('#lyrics-select'), lyricFile = $('#lyrics-file');
const lyricOffset = $('#lyrics-offset'), lyricPosition = $('#lyrics-position');
function syncLyricOffset() { lyricOffset.value = String(lyricOffsets.get(lyricSelect.value) || 0); $('#lyrics-offset-value').textContent = Number(lyricOffset.value).toFixed(1) + ' s'; }
lyricSelect.addEventListener('change', syncLyricOffset);
lyricOffset.addEventListener('input', () => { const n = Math.max(-10, Math.min(10, Number(lyricOffset.value) || 0)); lyricOffsets.set(lyricSelect.value, n); if (lyricSelect.value !== 'local')
    store.set('noa-lyric-offset-' + lyricSelect.value, String(n)); syncLyricOffset(); if (lyricSelect.value === lyricTrackId)
    updateLyrics(localAudio.currentTime, localAudio.duration); });
const storedPosition = store.get('noa-lyrics-position');
lyricPosition.value = ['left', 'right'].includes(storedPosition || '') ? storedPosition : 'right';
lyricsCard.dataset.position = lyricPosition.value;
lyricPosition.addEventListener('change', () => { lyricsCard.dataset.position = lyricPosition.value; store.set('noa-lyrics-position', lyricPosition.value); });
for (const t of T) {
    const option = el('option', '', t.title);
    option.value = t.id;
    lyricSelect.append(option);
}
const localOption = el('option', '', 'Áudio local (sessão)');
localOption.value = 'local';
lyricSelect.append(localOption);
$('#mini-lyrics-toggle').addEventListener('click', () => { if (!lyricLibrary.has(lyricTrackId)) {
    toggleMiniQueue(false);
    if (state !== 'done')
        enter();
    $('.music-queue-panel').open = true;
    lyricSelect.value = lyricTrackId;
    $('#lyrics-settings').scrollIntoView({ block: 'center', behavior: REDUCED ? 'instant' : 'smooth' });
    lyricFile.focus({ preventScroll: true });
    return;
} lyricsEnabled = !lyricsEnabled; store.set('noa-lyrics-visible', lyricsEnabled ? 'on' : 'off'); refreshLyrics(); });
$('#lyrics-hide').addEventListener('click', () => { lyricsEnabled = false; store.set('noa-lyrics-visible', 'off'); refreshLyrics(); });
lyricFile.addEventListener('change', async () => { const file = lyricFile.files?.[0], id = lyricSelect.value; if (!file)
    return; try {
    if (file.size > 65536)
        throw Error('Limite de 64 KiB.');
    const raw = await file.text(), seconds = Number($('#lyrics-interval').value);
    const parsed = (0, music_visuals_1.parseLyrics)(raw, seconds);
    lyricLibrary.set(id, parsed);
    if (id !== 'local')
        store.set('noa-lyrics-' + id, JSON.stringify({ raw, seconds }));
    lyricsEnabled = true;
    store.set('noa-lyrics-visible', 'on');
    refreshLyrics();
    $('#lyrics-state').textContent = `${parsed.cues.length} linhas importadas · ${parsed.timed ? 'horários do arquivo' : 'intervalos aproximados'}.`;
}
catch (error) {
    $('#lyrics-state').textContent = error instanceof Error ? error.message : 'Não foi possível importar.';
}
finally {
    lyricFile.value = '';
} });
const references = { JBfAtRvW1Ao: 'https://www.cifraclub.com.br/portishead/glory-box/letra/', Bm2Eg2X4kZA: 'https://www.vagalume.com.br/belchior/na-hora-do-almoco.html', '3Xzb2uNlf0s': 'https://www.cifraclub.com.br/vincy/auto-sabotagem/letra/', 'Oq-xMg1xbic': 'https://www.vagalume.com.br/the-neighbourhood/w-d-y-w-f-m.html', tbYHzoBL8ec: 'https://www.cifraclub.com.br/melanie-martinez/gingerbread-man/letra/' };
let studioId = '', studioLines = [], studioTimes = [];
function studioRender() { const ready = studioLines.length > 0 && studioId === lyricSelect.value; const n = studioTimes.length; $('#lyrics-studio-progress').textContent = ready ? `${n} de ${studioLines.length} linhas marcadas` : ''; $('#lyrics-studio-line').textContent = ready ? (studioLines[n] || 'Todas as linhas marcadas.') : ''; $('#lyrics-studio-mark').disabled = !ready || n >= studioLines.length; $('#lyrics-studio-undo').disabled = !ready || !n; $('#lyrics-studio-save').disabled = !ready || n !== studioLines.length; const link = $('#lyrics-reference'); link.hidden = !references[lyricSelect.value]; if (!link.hidden)
    link.href = references[lyricSelect.value]; }
lyricSelect.addEventListener('change', studioRender);
studioRender();
$('#lyrics-studio-start').addEventListener('click', () => { const raw = $('#lyrics-editor-text').value; try {
    const parsed = (0, music_visuals_1.parseLyrics)(raw);
    if (parsed.timed) {
        $('#lyrics-state').textContent = 'Este texto já possui horários; importe como LRC.';
        return;
    }
    studioId = lyricSelect.value;
    studioLines = parsed.cues.map(c => c.text);
    studioTimes = [];
    studioRender();
}
catch (e) {
    $('#lyrics-state').textContent = e instanceof Error ? e.message : 'Texto inválido.';
} });
$('#lyrics-studio-play').addEventListener('click', () => { const i = T.findIndex(t => t.id === lyricSelect.value); if (i < 0) {
    $('#lyrics-state').textContent = 'Selecione uma das cinco faixas.';
    return;
} if (i !== PL.cur || !bundled) {
    pick(i, true);
}
else if (localAudio.paused)
    playNative();
else
    localAudio.pause(); });
$('#lyrics-studio-mark').addEventListener('click', () => { if (studioId !== lyricSelect.value || studioId !== lyricTrackId || !localURL || studioTimes.length >= studioLines.length) {
    $('#lyrics-state').textContent = 'Reproduza a faixa selecionada primeiro.';
    return;
} const t = localAudio.currentTime; if (t < (studioTimes[studioTimes.length - 1] ?? -1)) {
    $('#lyrics-state').textContent = 'O tempo deve avançar. Desfaça a marca anterior.';
    return;
} studioTimes.push(t); studioRender(); });
$('#lyrics-studio-undo').addEventListener('click', () => { studioTimes.pop(); studioRender(); });
$('#lyrics-studio-save').addEventListener('click', () => { if (studioId !== lyricSelect.value || studioTimes.length !== studioLines.length || !studioLines.length)
    return; const raw = studioLines.map((line, i) => (0, music_visuals_1.stampLRC)(studioTimes[i]) + line).join('\n'); lyricLibrary.set(studioId, (0, music_visuals_1.parseLyrics)(raw)); if (studioId !== 'local')
    store.set('noa-lyrics-' + studioId, JSON.stringify({ raw, seconds: 4 })); lyricsEnabled = true; store.set('noa-lyrics-visible', 'on'); refreshLyrics(); const url = URL.createObjectURL(new Blob([raw], { type: 'text/plain;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = studioId + '.lrc'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000); $('#lyrics-state').textContent = 'LRC salvo e exportado.'; });
$('#lyrics-restore').addEventListener('click', () => { const t = T.find(t => t.id === lyricSelect.value); if (!t?.lyrics) {
    $('#lyrics-state').textContent = 'Não há letra incluída para esta faixa.';
    return;
} lyricLibrary.set(t.id, (0, music_visuals_1.parseLyrics)(t.lyrics)); store.set('noa-lyrics-' + t.id, JSON.stringify({ raw: t.lyrics })); lyricOffsets.set(t.id, 0); store.set('noa-lyric-offset-' + t.id, '0'); lyricsEnabled = true; store.set('noa-lyrics-visible', 'on'); refreshLyrics(); $('#lyrics-state').textContent = 'Letra incluída restaurada.'; });
$('#lyrics-load-studio').addEventListener('click', () => { const data = lyricLibrary.get(lyricSelect.value); if (!data)
    return; $('#lyrics-editor-text').value = data.cues.map(c => c.text).filter(Boolean).join('\n'); $('#lyrics-editor').open = true; $('#lyrics-state').textContent = 'Texto pronto para remarcar os horários no estúdio.'; });
const cuePick = $('#lyrics-cue-select'), cueTime = $('#lyrics-cue-time');
function renderCueEditor() { const cues = lyricLibrary.get(lyricSelect.value)?.cues || []; const prior = Number(cuePick.value) || 0; cuePick.replaceChildren(...cues.map((c, i) => { const option = el('option', '', `${(0, music_visuals_1.stampLRC)(c.at)} ${c.text || '♪ Instrumental'}`); option.value = String(i); return option; })); cuePick.value = String(Math.min(prior, Math.max(0, cues.length - 1))); const end = $('#lyrics-range-end'); const oldEnd = Number(end.value) || 0; end.replaceChildren(...Array.from(cuePick.options, o => o.cloneNode(true))); end.value = String(Math.min(cues.length - 1, Math.max(prior, oldEnd))); syncCueEditor(); }
function syncCueEditor() { const c = lyricLibrary.get(lyricSelect.value)?.cues[Number(cuePick.value)]; cueTime.value = c ? c.at.toFixed(2) : ''; for (const id of ['lyrics-cue-preview', 'lyrics-cue-apply', 'lyrics-cue-now', 'lyrics-cue-earlier', 'lyrics-cue-later', 'lyrics-cue-export', 'lyrics-range-apply'])
    $('#' + id).disabled = !c; }
function cueExport(cues) { return cues.map(c => (0, music_visuals_1.stampLRC)(c.at) + (c.words?.length ? c.words.map(w => (0, music_visuals_1.stampLRC)(w.at).replace('[', '<').replace(']', '>') + w.text).join('') : c.text)).join('\n'); }
function changeCueTime(value) { const id = lyricSelect.value, data = lyricLibrary.get(id), i = Number(cuePick.value), c = data?.cues[i]; if (!c || !data || !Number.isFinite(value))
    return; try {
    const duration = id === lyricTrackId && Number.isFinite(localAudio.duration) ? localAudio.duration : 7200;
    data.cues = (0, music_visuals_1.shiftCueRange)(data.cues, i, i, value - c.at, duration);
    if (id !== 'local')
        store.set('noa-lyrics-' + id, JSON.stringify({ raw: cueExport(data.cues), seconds: 4 }));
    renderCueEditor();
    if (id === lyricTrackId)
        refreshLyrics();
    $('#lyrics-state').textContent = 'Horário da linha atualizado e salvo neste aparelho.';
}
catch (e) {
    $('#lyrics-state').textContent = e instanceof Error ? e.message : 'Horário inválido.';
} }
lyricSelect.addEventListener('change', renderCueEditor);
cuePick.addEventListener('change', syncCueEditor);
$('#lyrics-cue-apply').addEventListener('click', () => changeCueTime(Number(cueTime.value)));
$('#lyrics-cue-earlier').addEventListener('click', () => changeCueTime(Number(cueTime.value) - .1));
$('#lyrics-cue-later').addEventListener('click', () => changeCueTime(Number(cueTime.value) + .1));
$('#lyrics-cue-now').addEventListener('click', () => { if (lyricSelect.value !== lyricTrackId || !localURL) {
    $('#lyrics-state').textContent = 'Abra a faixa selecionada antes de marcar o horário.';
    return;
} changeCueTime(localAudio.currentTime); });
$('#lyrics-review-rate').addEventListener('change', () => { const value = Number($('#lyrics-review-rate').value); if (!localURL || lyricSelect.value !== lyricTrackId) {
    $('#lyrics-review-rate').value = '1';
    $('#lyrics-state').textContent = 'Abra a faixa escolhida para ajustar a velocidade.';
    return;
} cancelFade(); localAudio.playbackRate = [.75, 1].includes(value) ? value : 1; localAudio.preservesPitch = true; $('#lyrics-state').textContent = value === .75 ? 'Revisão em 0,75×: o relógio e a letra continuam no tempo original.' : 'Velocidade normal.'; });
$('#lyrics-cue-preview').addEventListener('click', () => { const id = lyricSelect.value, c = lyricLibrary.get(id)?.cues[Number(cuePick.value)]; if (!c)
    return; if (id !== lyricTrackId || !localURL) {
    $('#lyrics-state').textContent = 'Abra a faixa selecionada no player antes de ouvir o trecho.';
    return;
} localAudio.currentTime = Math.max(0, c.at - 2); playNative(); });
$('#lyrics-range-apply').addEventListener('click', () => { const id = lyricSelect.value, data = lyricLibrary.get(id); if (!data)
    return; try {
    const first = Number(cuePick.value), last = Number($('#lyrics-range-end').value), delta = Number($('#lyrics-range-delta').value);
    if (!Number.isFinite(delta) || Math.abs(delta) > 20)
        throw Error('Use um deslocamento de até 20 segundos.');
    const duration = id === lyricTrackId && Number.isFinite(localAudio.duration) ? localAudio.duration : 7200;
    const result = (0, music_visuals_1.shiftCueRange)(data.cues, first, last, delta, duration);
    data.cues = result;
    if (id !== 'local')
        store.set('noa-lyrics-' + id, JSON.stringify({ raw: cueExport(result), seconds: 4 }));
    renderCueEditor();
    if (id === lyricTrackId)
        refreshLyrics();
    $('#lyrics-state').textContent = `${last - first + 1} linhas ajustadas; texto e ordem preservados.`;
}
catch (e) {
    $('#lyrics-state').textContent = e instanceof Error ? e.message : 'Não foi possível ajustar.';
} });
$('#lyrics-cue-export').addEventListener('click', () => { const id = lyricSelect.value, data = lyricLibrary.get(id); if (!data)
    return; const url = URL.createObjectURL(new Blob([cueExport(data.cues)], { type: 'text/plain;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = id + '.lrc'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000); });
renderCueEditor();
$('#lyrics-remove').addEventListener('click', () => { lyricLibrary.delete(lyricSelect.value); store.set('noa-lyrics-' + lyricSelect.value, JSON.stringify({ removed: true })); refreshLyrics(); $('#lyrics-state').textContent = 'Letra removida.'; });
$('#mini-queue-history').addEventListener('click', () => { toggleMiniQueue(false); if (state !== 'done')
    enter(); $('.music-queue-panel').open = true; $('.music-queue-panel').scrollIntoView({ block: 'start', behavior: REDUCED ? 'instant' : 'smooth' }); });
status(T.length ? 'Escolha uma faixa para começar.' : 'Nenhuma faixa configurada.');
markCurrent();
progress(0, 0);
initMediaSession();
const offlineButton = $('#music-offline');
const embedded = T.length > 0 && T.every(t => str(t.audio).startsWith('data:'));
const allNative = T.length > 0 && T.every(t => !!t.audio);
$('#shuffle').setAttribute('aria-pressed', String(shuffle));
$('#repeat').setAttribute('aria-pressed', String(repeat));
const autoCheckbox = $('#music-autostart');
autoCheckbox.checked = autoEnabled;
autoCheckbox.addEventListener('change', () => { autoEnabled = autoCheckbox.checked; store.set('noa-music-autostart', autoEnabled ? 'on' : 'off'); if (!autoEnabled)
    clearAuto(); });
$('#mini-open').addEventListener('click', () => { toggleMiniQueue(false); if (state !== 'done')
    enter(); $('#musica').scrollIntoView({ behavior: REDUCED ? 'instant' : 'smooth', block: 'start' }); });
if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => { spectrumVisible = entry.isIntersecting; if (localURL && !localAudio.paused)
        startSpectrum();
    else
        stopSpectrum(); }, { rootMargin: '120px' });
    observer.observe(plEl);
}
if (allNative) {
    mini.hidden = false;
    const initial = Math.floor(Math.random() * T.length);
    pick(initial, false, false);
    shuffleBag = bagFor(initial);
    renderQueue();
    if (autoEnabled) {
        autoPending = true;
        playNative(true);
    }
    else
        status('Toque para ouvir');
}
document.addEventListener('click', (e) => { if (!e.isTrusted || !autoPending || !autoEnabled || !localURL)
    return; const target = e.target; if (target?.closest('#mini-music,#mini-queue,#mini-queue-toggle,#music-lyrics,#play,#tracks,#prev,#next,#local-file,#music-autostart,#prefs,.music-queue-panel,[data-music-toggle]'))
    return; clearAuto(); if (localAudio.paused)
    playNative(); }, true);
if (allNative) {
    $('#music-help-text').textContent = 'As cinco músicas estão incluídas na coleção. Não é necessário abrir o YouTube. A versão HTML independente contém os áudios; no site, guarde a coleção offline para ouvir sem conexão. As capas externas precisam de internet.';
    $('#yt-direct').hidden = true;
}
if (embedded) {
    offlineButton.hidden = true;
}
else if (allNative && 'serviceWorker' in navigator) {
    offlineButton.hidden = false;
    void navigator.serviceWorker.ready.then(reg => { if (!reg.active)
        return; const channel = new MessageChannel(); const timeout = setTimeout(() => channel.port1.close(), 4000); channel.port1.onmessage = e => { clearTimeout(timeout); channel.port1.close(); if (!offlineButton.disabled && e.data.type === 'status' && e.data.total > 0 && e.data.available === e.data.total)
        offlineButton.textContent = 'Coleção guardada'; }; reg.active.postMessage({ type: 'NOA_AUDIO_STATUS' }, [channel.port2]); }).catch(() => { });
    offlineButton.addEventListener('click', async () => {
        offlineButton.disabled = true;
        offlineButton.textContent = 'Preparando…';
        let timer = 0;
        let channel = null;
        try {
            const registration = await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(Error('worker unavailable')), 10000))]);
            const worker = registration.active;
            if (!worker)
                throw Error('worker unavailable');
            channel = new MessageChannel();
            const ch = channel;
            await new Promise((resolve, reject) => { timer = window.setTimeout(() => reject(Error('timeout')), 180000); ch.port1.onmessage = e => { const d = e.data; if (d.type === 'progress')
                offlineButton.textContent = `Guardando ${d.done}/${d.total}…`; if (d.type === 'complete') {
                d.failed ? reject(Error('incomplete')) : resolve();
            } }; worker.postMessage({ type: 'NOA_CACHE_AUDIO' }, [ch.port2]); });
            offlineButton.textContent = 'Coleção guardada';
        }
        catch {
            offlineButton.textContent = 'Tentar guardar offline';
        }
        finally {
            clearTimeout(timer);
            channel?.port1.close();
            offlineButton.disabled = false;
        }
    });
}
if ('IntersectionObserver' in window) {
    const visibleOrnaments = new IntersectionObserver(entries => { for (const entry of entries)
        entry.target.dataset.ornaments = entry.isIntersecting ? 'on' : 'off'; }, { rootMargin: '80px' });
    visibleOrnaments.observe($('#detalhes'));
}
const PF = $('#prefs'), PB = $('#fpref');
function syncPrefs() {
    $$('input[name=fx]').forEach(r => { r.checked = r.value === PREFS.fx; });
    $('#pm').value = PREFS.motion;
    $('#pc').checked = PREFS.contrast;
    $('#pr').checked = PREFS.read;
}
function prefsOpen(on) {
    PF.hidden = !on;
    PB.setAttribute('aria-expanded', String(on));
    if (on) {
        syncPrefs();
        const f = $('input:checked', PF) || $('input', PF);
        if (f)
            f.focus();
    }
    else
        PB.focus();
}
PB.addEventListener('click', () => prefsOpen(PF.hidden));
$('#pclose').addEventListener('click', () => prefsOpen(false));
$$('input[name=fx]').forEach(r => r.addEventListener('change', () => { PREFS.fx = r.value; savePrefs(); applyPrefs(); }));
$('#pm').addEventListener('change', (e) => { PREFS.motion = e.currentTarget.value; savePrefs(); applyPrefs(); });
$('#pc').addEventListener('change', (e) => { PREFS.contrast = e.currentTarget.checked; savePrefs(); applyPrefs(); });
$('#pr').addEventListener('change', (e) => { PREFS.read = e.currentTarget.checked; savePrefs(); applyPrefs(); });
$('#szm').addEventListener('click', () => { PREFS.size = Math.max(0, PREFS.size - 1); savePrefs(); applyPrefs(); });
$('#szp').addEventListener('click', () => { PREFS.size = Math.min(2, PREFS.size + 1); savePrefs(); applyPrefs(); });
document.addEventListener('keydown', e => {
    const target = e.target instanceof Element ? e.target : null;
    const f = target?.closest('.fig');
    if (f instanceof HTMLElement && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        lbOpen(f);
        return;
    }
    if (LB.open) {
        if (e.key === 'Escape')
            lbClose();
        else if (e.key === 'ArrowLeft')
            lbShow(LB.i - 1);
        else if (e.key === 'ArrowRight')
            lbShow(LB.i + 1);
        else if (e.key === 'Tab') {
            const b = $$('button', LB.root), first = b[0], last = b[b.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
            else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
        return;
    }
    if (e.key === 'Escape') {
        if (!miniQueue.hidden)
            toggleMiniQueue(false);
        else if (!PF.hidden)
            prefsOpen(false);
        else if (state !== 'done')
            enter();
    }
});
let sraf = 0, lastY = 0, fabT = 0;
addEventListener('scroll', () => {
    if (sraf)
        return;
    sraf = requestAnimationFrame(() => {
        sraf = 0;
        const y = window.pageYOffset || html.scrollTop, h = html.scrollHeight - html.clientHeight;
        if (y > 240 && y > lastY + 6)
            html.classList.add('nav-hidden');
        else if (y < lastY - 6 || y < 240)
            html.classList.remove('nav-hidden');
        lastY = y;
        $('#fabs').classList.add('moving');
        clearTimeout(fabT);
        fabT = setTimeout(() => $('#fabs').classList.remove('moving'), 900);
        $('#bar').style.width = (h > 0 ? 100 * y / h : 0) + '%';
        $('#fabs').classList.toggle('show', y > 500);
        html.style.setProperty('--sy', String(y));
        if (!chn.hidden) {
            const r = chs.getBoundingClientRect();
            chn.style.setProperty('--lp', Math.max(0, Math.min(1, (innerHeight * .4 - r.top) / Math.max(1, r.height))).toFixed(3));
        }
    });
}, { passive: true });
document.addEventListener('focusin', e => { const target = e.target instanceof Element ? e.target : null; if (target?.closest('#nav'))
    html.classList.remove('nav-hidden'); });
$('#fup').addEventListener('click', () => scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }));
$('#totop').addEventListener('click', (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); });
$('#sealbtn').addEventListener('click', (e) => {
    const b = e.currentTarget, on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    if (on) {
        burst(true);
        toast('Carta selada ♡');
    }
});
if ('IntersectionObserver' in window) {
    const so = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting)
        $$('#nav a').forEach(a => { if (a.getAttribute('href') === '#' + e.target.id)
            a.setAttribute('aria-current', 'true');
        else
            a.removeAttribute('aria-current'); }); }), { rootMargin: '-40% 0px -50% 0px' });
    $$('main section').forEach(s => so.observe(s));
    const fo = new IntersectionObserver(es => { html.classList.toggle('ending', es[0].isIntersecting && es[0].intersectionRatio > .5); if (es[0].isIntersecting)
        $('.finalcard').classList.add('in'); }, { threshold: [0, .5] });
    fo.observe($('#final'));
}
let hearts = 0;
function spawn(x, y, ch, n) {
    for (let k = 0; k < n && hearts < 14; k++) {
        const h = el('span', 'hrt', ch);
        hearts++;
        h.setAttribute('aria-hidden', 'true');
        h.style.left = x - 10 + 'px';
        h.style.top = y - 10 + 'px';
        h.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
        document.body.appendChild(h);
        setTimeout(() => { h.remove(); hearts--; }, 1200);
    }
}
document.addEventListener('pointerdown', e => { const target = e.target instanceof Element ? e.target : null; if (REDUCED || target?.closest('iframe,input,#lb,#prefs,.exp-modal'))
    return; spawn(e.clientX, e.clientY, '♡', target?.closest('.hb') ? 7 : 1); });
{
    let t = 0;
    addEventListener('pointermove', e => { const target = e.target instanceof Element ? e.target : null; if (!REDUCED && !target?.closest('canvas, input, textarea, #lb, #prefs, .exp-modal') && (e.pointerType === 'mouse' || e.buttons === 1) && e.timeStamp - t > 100) {
        t = e.timeStamp;
        spawn(e.clientX, e.clientY, '✦', 1);
    } }, { passive: true });
}
let tp = 0, tt = 0;
$('#title').addEventListener('click', () => { const n = Date.now(); tp = n - tt < 700 ? tp + 1 : 1; tt = n; if (tp >= 3) {
    tp = 0;
    burst();
    toast('Obrigado por ser você ♡');
} });
syncPrefs();
safe('cinematic', cinematic_1.initCinema);
safe('memory film', () => (0, memory_film_1.initMemoryFilm)(C.gallery));
safe('salon', salon_1.initSalon);
runPreloader(runIntro);

}};const cache=Object.create(null);function require(id){if(cache[id])return cache[id].exports;if(!modules[id])throw Error('Módulo desconhecido: '+id);const m={exports:{}};cache[id]=m;modules[id](m,m.exports,require);return m.exports;}require('./main');})();