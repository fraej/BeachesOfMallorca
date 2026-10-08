// =====================================================
// BeachesOfMallorca on phones
// One page, five screens, picked from the same URL parameters the desktop pages use:
//   (none) beaches · municipi= municipality · municipi=&platja= beach
//   vista=mapa map · vista=aprop beaches near the visitor
// =====================================================

// Each municipality on the island outline of mallorca-sprites.png, with the numbers the
// desktop map uses in portal.css: [left, top, width, height, sprite x, sprite y]
const MUNICIPIS_SPRITE = {
    'Alcúdia': [333, 40, 74, 56, 508, 820],
    'Andratx': [20, 187, 53, 73, 11, 1002],
    'Artà': [417, 101, 88, 88, 2111, 594],
    'Banyalbufar': [85, 153, 35, 27, 1971, 820],
    'Calvià': [56, 189, 79, 108, 269, 1003],
    'Campos': [284, 285, 78, 89, 507, 594],
    'Capdepera': [487, 124, 44, 68, 1941, 595],
    'Deià': [143, 112, 26, 27, 1626, 820],
    'Escorca': [196, 35, 99, 91, 890, 820],
    'Estellencs': [62, 170, 32, 25, 2130, 820],
    'Felanitx': [343, 251, 98, 94, 1102, 594],
    'Llucmajor': [189, 242, 115, 116, 267, 595],
    'Manacor': [371, 166, 115, 143, 1325, 594],
    'Muro': [326, 87, 55, 65, 311, 820],
    'Palma': [118, 177, 129, 97, 14, 593],
    'Pollença': [279, 0, 133, 86, 668, 820],
    'Sant Llorenç des Cardassar': [424, 164, 74, 70, 1564, 595],
    'Santa Margalida': [349, 111, 73, 57, 12, 817],
    'Santanyí': [327, 322, 98, 88, 880, 594],
    'Ses Salines': [309, 343, 46, 54, 709, 595],
    'Sóller': [165, 82, 43, 52, 1391, 820],
    'Son Servera': [461, 169, 52, 44, 1764, 594],
    'Valldemossa': [116, 129, 46, 51, 1809, 820]
};
const SPRITE = { amplada: 2200, alcada: 1112 };

// The outline is drawn on a plain longitude/latitude grid; these are its outermost points
const ILLA = { amplada: 532, alcada: 411, oest: 2.347, est: 3.479, nord: 39.962, sud: 39.265, x0: 19, x1: 531, y0: 0, y1: 410 };

const SUPERFICIES = ['arena', 'còdols', 'grava', 'roques'];
const ENTORNS = ['natural', 'semi-urbà', 'urbà'];
const TEXTURES = { arena: 'arenal', 'còdols': 'codolar', grava: 'grava', roques: 'roques' };
const COLORS = { arena: '#dba43c', 'còdols': '#8d929c', grava: '#5c7288', roques: '#94593a' };
const CLAUS_ENTORN = { natural: 'entorn_natural', 'semi-urbà': 'entorn_semi_urba', 'urbà': 'entorn_urba' };

const LEAFLET = {
    css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    cssIntegrity: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
    js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    jsIntegrity: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
};
const MAPA_CARRERS = ['https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'];
const MAPA_SATELLIT = ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    '&copy; Esri, Maxar, Earthstar Geographics'];

// What the visitor has chosen; it lives as long as the page does
const estat = {
    idioma: 'ca',
    cerca: '',
    superficies: new Set(),
    entorns: new Set(),
    naturisme: false,
    ubicacio: null,         // { lat, lon } once the visitor shares it
    ubicacioEstat: 'cap'    // cap | cercant | ok | error
};

let platges = [];       // every beach, in the order of BoMdata.xml
let municipis = [];     // [{ nom, platges }], only municipalities with beaches
let blocIdioma = null;  // <text> block of the chosen language
let blocDefecte = null; // first <text> block, used when a label is missing
let mapes = [];         // Leaflet maps on screen, removed before the next screen is drawn
let vistaActual = {};   // hooks of the screen on show (refresca, selecciona, platja...)
let torn = 0;           // increases with every screen, so late async work can tell it is stale
let tornada = null;     // where the back button goes when there is no history to go back to
let observadorTitol = null;
let temporitzadorAvis = null;

const vista = document.getElementById('vista');
const barra = document.querySelector('.barra');
const barraTitol = barra.querySelector('.barra-titol');
const barraLogo = barra.querySelector('.barra-logo');
const botoEnrere = barra.querySelector('.barra-enrere');
const selectIdioma = document.getElementById('idioma');
const avis = document.querySelector('.avis');

// =====================================================
// Data
// =====================================================

function parseCoord(coord) {
    return parseFloat(String(coord).replace(',', '.'));
}

/**
 * Lower case, no accents, no apostrophes: "s'Illot" and "sillot" both become "sillot"
 */
function normalitza(text) {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/['’·]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function llegeixDades() {
    const text = (node, etiqueta) => node.querySelector(etiqueta)?.textContent.trim() || '';

    for (const nodeMunicipi of BoMdata.querySelectorAll('municipis > municipi')) {
        const nomMunicipi = nodeMunicipi.getAttribute('nom');
        const llista = Array.from(nodeMunicipi.querySelectorAll('platja'), node => {
            const platja = {
                node,
                nom: node.getAttribute('nom'),
                municipi: nomMunicipi,
                nomsAlternatius: Array.from(node.querySelectorAll('nom_alt'), alt => alt.textContent.trim()),
                barri: text(node, 'barri'),
                superficie: text(node, 'superficie_tipus'),
                entorn: text(node, 'entorn'),
                llargaria: parseInt(text(node, 'llargaria')) || 0,
                amplada: parseInt(text(node, 'amplada_mitjana')) || 0,
                lat: parseCoord(text(node, 'latitud')),
                lon: parseCoord(text(node, 'longitud')),
                naturisme: text(node, 'nat') === 'true'
            };
            platja.nomCerca = normalitza(platja.nom);
            platja.textCerca = normalitza([platja.nom, ...platja.nomsAlternatius, platja.barri, nomMunicipi].join(' '));
            return platja;
        });
        platges.push(...llista);
        if (llista.length) municipis.push({ nom: nomMunicipi, platges: llista });
    }
}

/**
 * Some names repeat across municipalities (Cala Blanca, Cala Figuera...), so the municipality decides
 */
function trobaPlatja(nomMunicipi, nom) {
    if (!nom) return null;
    return platges.find(p => p.nom === nom && p.municipi === nomMunicipi) ||
        platges.find(p => p.nom === nom) || null;
}

function descripcio(platja) {
    const nodes = Array.from(platja.node.querySelectorAll('descripcions > descripcio'));
    const node = nodes.find(n => n.getAttribute('idiomaCodi') === estat.idioma) ||
        nodes.find(n => n.getAttribute('idiomaCodi') === 'ca');
    return node ? node.textContent.trim() : '';
}

// =====================================================
// Texts (i18n from XML)
// =====================================================

/**
 * Text of the first leaf element matching the selector in the chosen language,
 * so 'superficie' skips the <superficie> group and finds the label
 */
function t(selector) {
    for (const bloc of [blocIdioma, blocDefecte]) {
        for (const node of bloc.querySelectorAll(selector)) {
            if (!node.children.length) return node.textContent.replace(/\s+/g, ' ').trim();
        }
    }
    return '';
}

// Labels that only the phone screens use, kept in <text><mobil>
const tm = clau => t('mobil > ' + clau);

function esc(text) {
    return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const formats = new Map();

function nombre(valor, decimals = 0) {
    const clau = estat.idioma + decimals;
    if (!formats.has(clau)) formats.set(clau, new Intl.NumberFormat(estat.idioma, { maximumFractionDigits: decimals }));
    return formats.get(clau).format(valor);
}

function compte(n) {
    return nombre(n) + ' ' + (n === 1 ? tm('platja_una') : tm('platja_moltes'));
}

function distanciaText(km) {
    if (km < 1) return nombre(Math.round(km * 100) * 10) + ' m';
    return nombre(km, km < 10 ? 1 : 0) + ' km';
}

/**
 * Degrees, minutes and seconds, as on the desktop beach page
 */
function dms(valor, esLatitud) {
    const direccio = esLatitud ? (valor >= 0 ? 'N' : 'S') : (valor >= 0 ? 'E' : 'W');
    const d = Math.abs(valor);
    const graus = Math.floor(d);
    const totalSegons = (d - graus) * 3600;
    const minuts = Math.floor(totalSegons / 60);
    const segons = Math.floor(totalSegons - minuts * 60);
    return `${graus}° ${minuts}′ ${segons}″ ${direccio}`;
}

function posaDescripcioMeta(text) {
    document.querySelector('meta[name="description"]').setAttribute('content', text);
}

// =====================================================
// Navigation
// =====================================================

function enllac(params = {}) {
    const query = new URLSearchParams();
    for (const clau of ['municipi', 'platja', 'vista']) {
        if (params[clau]) query.set(clau, params[clau]);
    }
    query.set('lang', estat.idioma);
    return 'mobil.html?' + query;
}

const enllacPlatja = p => enllac({ municipi: p.municipi, platja: p.nom });

// The screen a URL shows, whatever the language
function clauRuta(url) {
    const query = new URL(url, location.href).searchParams;
    query.delete('lang');
    query.sort();
    return query.toString();
}

function navega(href) {
    history.replaceState({ ...history.state, scroll: scrollY }, '');
    history.pushState({ dins: true, scroll: 0 }, '', href);
    mostra();
    scrollTo(0, 0);
    vista.focus({ preventScroll: true });
}

addEventListener('popstate', event => {
    // A language change only rewrote the entry it happened on
    const url = new URL(location.href);
    if (url.searchParams.get('lang') !== estat.idioma) {
        url.searchParams.set('lang', estat.idioma);
        history.replaceState(event.state, '', url);
    }
    mostra();
    scrollTo(0, event.state?.scroll || 0);
});

botoEnrere.addEventListener('click', () => {
    if (history.state?.dins) history.back();
    else if (tornada) navega(tornada);
});

document.addEventListener('click', event => {
    const enllacIntern = event.target.closest('a[data-nav]');
    if (enllacIntern) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (clauRuta(enllacIntern.href) === clauRuta(location.href)) scrollTo({ top: 0, behavior: 'smooth' });
        else navega(enllacIntern.getAttribute('href'));
        return;
    }

    const boto = event.target.closest('button[data-filtre], button[data-accio]');
    if (!boto) return;
    if (boto.dataset.filtre) canviaFiltre(boto);
    else accions[boto.dataset.accio]?.();
});

const accions = {
    'comparteix': () => comparteix(vistaActual.platja),
    'copia-coordenades': async () => {
        const p = vistaActual.platja;
        if (await copia(`${p.lat}, ${p.lon}`)) avisa(tm('coordenades_copiades'));
    },
    'ubica': () => demanaUbicacio(),
    'esborra-cerca': () => vistaActual.esborraCerca?.(),
    'esborra-filtres': () => {
        estat.superficies.clear();
        estat.entorns.clear();
        estat.naturisme = false;
        document.querySelectorAll('.xip').forEach(xip => xip.setAttribute('aria-pressed', 'false'));
        vistaActual.refresca?.();
    },
    'tanca-fitxa': () => vistaActual.selecciona?.(null)
};

// =====================================================
// Screens
// =====================================================

/**
 * Draws the screen the URL asks for
 */
function mostra() {
    torn++;
    mapes.forEach(mapa => mapa.remove());
    mapes = [];
    vistaActual = {};
    observadorTitol?.disconnect();
    document.body.classList.remove('amb-mapa');
    blocIdioma = BoMdata.querySelector(`texts > text[idiomaCodi="${estat.idioma}"]`) || blocDefecte;
    document.documentElement.lang = estat.idioma;

    const params = new URLSearchParams(location.search);
    const vistaDemanada = params.get('vista');
    const municipi = municipis.find(m => m.nom === params.get('municipi'));
    const platja = trobaPlatja(params.get('municipi'), params.get('platja'));

    actualitzaMarc(vistaDemanada === 'mapa' ? 'mapa' : vistaDemanada === 'aprop' ? 'aprop' : 'platges');

    if (vistaDemanada === 'mapa') vistaMapa(municipi, platja);
    else if (vistaDemanada === 'aprop') vistaAProp();
    else if (platja) vistaPlatja(platja);
    else if (municipi) vistaMunicipi(municipi);
    else vistaInici();
}

/**
 * Header and tab bar texts, links and current tab
 */
function actualitzaMarc(pestanyaActiva) {
    const marca = t('beaches_of_mallorca');
    barraLogo.href = enllac();
    barraLogo.setAttribute('aria-label', marca);
    botoEnrere.setAttribute('aria-label', tm('tornar'));
    selectIdioma.value = estat.idioma;
    selectIdioma.setAttribute('aria-label', t('idioma_elecció'));
    barra.querySelector('.idioma-codi').textContent = estat.idioma.toUpperCase();

    const noms = { platges: 'pestanya_platges', mapa: 'pestanya_mapa', aprop: 'pestanya_a_prop' };
    const vistes = { platges: null, mapa: 'mapa', aprop: 'aprop' };
    for (const pestanya of document.querySelectorAll('.pestanya')) {
        const clau = pestanya.dataset.pestanya;
        pestanya.href = enllac({ vista: vistes[clau] });
        pestanya.querySelector('.pestanya-nom').textContent = tm(noms[clau]);
        if (clau === pestanyaActiva) pestanya.setAttribute('aria-current', 'page');
        else pestanya.removeAttribute('aria-current');
    }
}

/**
 * Title in the header; with a parent the logo becomes a back button
 */
function preparaBarra(titol, pare) {
    barraTitol.textContent = titol;
    barra.classList.add('barra-titol-visible');
    botoEnrere.hidden = !pare;
    barraLogo.hidden = Boolean(pare);
    tornada = pare;
    document.title = titol + ' | BeachesOfMallorca';
}

const peuHtml = () => `
    <footer class="peu">
        <div class="peu-gent"></div>
        <p class="peu-text">&copy; Copyright 2015 BeachesOfMallorca</p>
    </footer>`;

// ---------- Beaches (home) ----------

function vistaInici() {
    preparaBarra(t('beaches_of_mallorca'), null);
    document.title = 'BeachesOfMallorca';
    posaDescripcioMeta(t('index_meta_name_description'));

    const resum = tm('resum')
        .replace('{platges}', nombre(platges.length))
        .replace('{municipis}', nombre(municipis.length));

    vista.innerHTML = `
        <section class="portada">
            <p class="portada-salutacio">${esc(t('welcome_to'))}</p>
            <h1 class="portada-titol">${esc(t('beaches_of_mallorca'))}</h1>
            <p class="portada-resum">${esc(resum)}</p>
            <span class="portada-final"></span>
        </section>
        <div class="cercador">
            <div class="cercador-camp">
                <svg class="icona"><use href="#i-cerca" /></svg>
                <input id="cerca" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false"
                    placeholder="${esc(t('cercador_text_defecte'))}" aria-label="${esc(t('cercador_text_defecte'))}"
                    value="${esc(estat.cerca)}">
                <button type="button" class="cercador-esborra" data-accio="esborra-cerca"
                    aria-label="${esc(tm('esborra_cerca'))}"${estat.cerca ? '' : ' hidden'}>
                    <svg class="icona"><use href="#i-tanca" /></svg>
                </button>
            </div>
        </div>
        ${filtresHtml()}
        <div class="resultats"></div>
        ${peuHtml()}`;

    const camp = vista.querySelector('#cerca');
    const botoEsborra = vista.querySelector('.cercador-esborra');
    const resultats = vista.querySelector('.resultats');

    vistaActual.refresca = () => {
        botoEsborra.hidden = !estat.cerca;
        if (!normalitza(estat.cerca) && !hiHaFiltres()) {
            resultats.innerHTML = `
                <h2 class="seccio-titol">${esc(tm('municipis'))}</h2>
                <ul class="municipis">${municipis.map(targetaMunicipi).join('')}</ul>`;
        } else {
            resultats.innerHTML = llistaResultats(cercaPlatges());
        }
    };
    vistaActual.esborraCerca = () => {
        estat.cerca = '';
        camp.value = '';
        vistaActual.refresca();
        camp.focus();
    };
    camp.addEventListener('input', () => {
        estat.cerca = camp.value;
        vistaActual.refresca();
    });
    camp.addEventListener('keydown', event => {
        if (event.key === 'Enter') camp.blur();
    });
    vistaActual.refresca();

    // The big title doubles as the header title until it scrolls under the header,
    // and the search box gets a background once it sticks there
    const titol = vista.querySelector('.portada-titol');
    const cercador = vista.querySelector('.cercador');
    barra.classList.remove('barra-titol-visible');
    observadorTitol = new IntersectionObserver(entrades => {
        for (const entrada of entrades) {
            const amagat = !entrada.isIntersecting && entrada.boundingClientRect.top < barra.offsetHeight;
            if (entrada.target === titol) barra.classList.toggle('barra-titol-visible', amagat);
            else cercador.classList.toggle('cercador-enganxat', amagat);
        }
    }, { rootMargin: `-${barra.offsetHeight}px 0px 0px 0px` });
    observadorTitol.observe(titol);
    observadorTitol.observe(vista.querySelector('.portada-final'));
}

function targetaMunicipi(m) {
    return `
        <li><a class="municipi" href="${esc(enllac({ municipi: m.nom }))}" data-nav>
            ${finestraMunicipi(m)}
            <span class="municipi-text">
                <span class="municipi-nom">${esc(m.nom)}</span>
                <span class="municipi-compte">${esc(compte(m.platges.length))}</span>
            </span>
            <svg class="icona"><use href="#i-endavant" /></svg>
        </a></li>`;
}

// ---------- Municipality ----------

function vistaMunicipi(m) {
    preparaBarra(m.nom, enllac());
    posaDescripcioMeta(`${t('platges_de')} ${m.nom}`);

    vista.innerHTML = `
        <section class="capcalera">
            <div class="capcalera-mapa">${mapet(m.nom, m.platges)}</div>
            <div class="capcalera-text">
                <p class="capcalera-sub">${esc(t('platges_de'))}</p>
                <h1 class="capcalera-titol">${esc(m.nom)}</h1>
                <p class="capcalera-compte">${esc(compte(m.platges.length))}</p>
                <a class="boto boto-contorn" href="${esc(enllac({ vista: 'mapa', municipi: m.nom }))}" data-nav>
                    <svg class="icona"><use href="#i-mapa" /></svg>${esc(tm('mostra_al_mapa'))}
                </a>
            </div>
        </section>
        <ul class="llista">${m.platges.map(p => targetaPlatja(p, { senseMunicipi: true })).join('')}</ul>
        ${peuHtml()}`;
}

// ---------- Beach ----------

function vistaPlatja(p) {
    const municipi = municipis.find(m => m.nom === p.municipi);
    const posicio = municipi.platges.indexOf(p);
    const anterior = municipi.platges[posicio - 1];
    const seguent = municipi.platges[posicio + 1];
    const text = descripcio(p);
    const properes = platges
        .filter(q => q !== p)
        .map(q => ({ q, km: distancia(p, q) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 8);
    const enllacMapa = enllac({ vista: 'mapa', municipi: p.municipi, platja: p.nom });

    preparaBarra(p.nom, enllac({ municipi: p.municipi }));
    posaDescripcioMeta(text || p.nom);
    vistaActual.platja = p;

    const dada = (etiqueta, valor, nota = '', classe = '', estil = '') => `
        <div class="dada ${classe}"${estil ? ` style="${estil}"` : ''}>
            <span class="dada-etiqueta">${esc(etiqueta)}</span>
            <span class="dada-valor">${esc(valor)}</span>
            ${nota ? `<span class="dada-nota">${esc(nota)}</span>` : ''}
        </div>`;
    const mida = p.llargaria && p.amplada
        ? `${nombre(p.llargaria)} × ${nombre(p.amplada)} m` : '–';
    const area = p.llargaria && p.amplada
        ? `${t('superficie')}: ${nombre(p.llargaria * p.amplada)} m²` : '';
    const veina = (q, classe, etiqueta, icona) => q ? `
        <a class="veina ${classe}" href="${esc(enllacPlatja(q))}" data-nav>
            ${classe === 'veina-anterior' ? `<svg class="icona"><use href="#${icona}" /></svg>` : ''}
            <span><small>${esc(etiqueta)}</small><strong>${esc(q.nom)}</strong></span>
            ${classe === 'veina-seguent' ? `<svg class="icona"><use href="#${icona}" /></svg>` : ''}
        </a>` : '';

    vista.innerHTML = `
        <div class="heroi">
            <div class="heroi-mapa"></div>
            <a class="heroi-enllac" href="${esc(enllacMapa)}" data-nav aria-label="${esc(tm('mostra_al_mapa'))}"></a>
            <div class="heroi-situacio">${mapet(p.municipi, [p], p)}</div>
        </div>
        <section class="fitxa">
            <h1 class="fitxa-nom">${esc(p.nom)}</h1>
            ${p.nomsAlternatius.length ? `
                <p class="fitxa-alt"><span class="ocult">${esc(t('noms_alternatius'))}: </span>${esc(p.nomsAlternatius.join(', '))}</p>` : ''}
            <p class="fitxa-lloc">${p.barri ? esc(p.barri) + ', ' : ''}<a href="${esc(enllac({ municipi: p.municipi }))}" data-nav>${esc(p.municipi)}</a></p>
            <div class="accions">
                <a class="accio accio-principal" href="${esc(enllacRuta(p))}" target="_blank" rel="noopener">
                    <svg class="icona"><use href="#i-ruta" /></svg><span>${esc(tm('com_arribar'))}</span>
                </a>
                <a class="accio" href="${esc(enllacMapa)}" data-nav>
                    <svg class="icona"><use href="#i-mapa" /></svg><span>${esc(tm('pestanya_mapa'))}</span>
                </a>
                <button class="accio" type="button" data-accio="comparteix">
                    <svg class="icona"><use href="#i-comparteix" /></svg><span>${esc(tm('compartir'))}</span>
                </button>
            </div>
        </section>
        <section class="dades">
            ${dada(t('superficie > intro'), t('superficie > ' + p.superficie), '', 'dada-superficie',
                `--textura:url(imatges/textures/${TEXTURES[p.superficie] || 'arenal'}.jpg)`)}
            ${dada(tm('mida'), mida, area)}
            ${dada(t('tipus_entorn'), t(CLAUS_ENTORN[p.entorn]))}
            ${dada(tm('naturisme'), p.naturisme ? tm('si') : tm('no'))}
        </section>
        <section class="temps temps-carregant" aria-busy="true"></section>
        ${text ? `
            <section class="seccio descripcio">
                <h2>${esc(t('descripcio_titol'))}</h2>
                <p>${esc(text)}</p>
            </section>` : ''}
        <section class="seccio coordenades">
            <div>
                <h2>${esc(t('coordenades'))}</h2>
                <p>${dms(p.lat, true)} · ${dms(p.lon, false)}</p>
            </div>
            <button class="boto-icona" type="button" data-accio="copia-coordenades" aria-label="${esc(tm('copia'))}">
                <svg class="icona"><use href="#i-copia" /></svg>
            </button>
        </section>
        <section class="properes">
            <h2>${esc(tm('platges_properes'))}</h2>
            <ul class="carrusel">${properes.map(({ q, km }) => `
                <li><a class="propera" href="${esc(enllacPlatja(q))}" data-nav>
                    <span class="propera-textura" style="background-image:url(imatges/textures/petites/${TEXTURES[q.superficie] || 'arenal'}.jpg)"></span>
                    <span class="propera-nom">${esc(q.nom)}</span>
                    <span class="propera-dist">${esc(distanciaText(km))} · ${esc(q.municipi)}</span>
                </a></li>`).join('')}
            </ul>
        </section>
        <nav class="veines">
            ${veina(anterior, 'veina-anterior', tm('anterior'), 'i-enrere')}
            ${veina(seguent, 'veina-seguent', tm('seguent'), 'i-endavant')}
        </nav>
        ${peuHtml()}`;

    iniciaMapaHeroi(p, torn);
    carregaTemps(p, torn);
}

function enllacRuta(p) {
    return /iPhone|iPad|iPod/.test(navigator.userAgent)
        ? `https://maps.apple.com/?daddr=${p.lat},${p.lon}`
        : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
}

async function comparteix(p) {
    // Share the desktop address: phones that open it are sent to this page anyway
    const url = new URL('platja.html', location.href);
    url.search = new URLSearchParams({ municipi: p.municipi, platja: p.nom, lang: estat.idioma });
    if (navigator.share) {
        try {
            await navigator.share({ title: p.nom, text: `${p.nom} (${p.municipi})`, url: url.href });
            return;
        } catch (error) {
            if (error.name === 'AbortError') return;
        }
    }
    if (await copia(url.href)) avisa(tm('enllac_copiat'));
}

async function copia(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        const camp = document.createElement('textarea');
        camp.value = text;
        camp.setAttribute('readonly', '');
        camp.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(camp);
        camp.select();
        const copiat = document.execCommand('copy');
        camp.remove();
        return copiat;
    }
}

function avisa(text) {
    avis.textContent = text;
    avis.classList.add('visible');
    clearTimeout(temporitzadorAvis);
    temporitzadorAvis = setTimeout(() => avis.classList.remove('visible'), 2200);
}

// ---------- Map ----------

function vistaMapa(municipi, platja) {
    const pare = platja ? enllacPlatja(platja) : municipi ? enllac({ municipi: municipi.nom }) : null;
    preparaBarra(tm('pestanya_mapa'), pare);
    posaDescripcioMeta(t('index_meta_name_description'));
    document.body.classList.add('amb-mapa');

    vista.innerHTML = `
        <div class="mapa-gran">
            ${filtresHtml()}
            <div class="mapa-gran-mapa"></div>
            <div class="mapa-gran-fitxa" hidden></div>
        </div>`;

    iniciaMapaGran(municipi, platja, torn);
}

// ---------- Nearby ----------

function vistaAProp() {
    preparaBarra(tm('pestanya_a_prop'), null);
    posaDescripcioMeta(tm('a_prop_titol'));

    vista.innerHTML = `
        <section class="aprop">
            <h1 class="aprop-titol">${esc(tm('a_prop_titol'))}</h1>
            <div class="aprop-cos"></div>
        </section>
        ${peuHtml()}`;

    const cos = vista.querySelector('.aprop-cos');
    vistaActual.errorEnLinia = true;
    vistaActual.refresca = () => {
        if (estat.ubicacioEstat === 'ok') {
            if (!cos.querySelector('.filtres')) cos.innerHTML = filtresHtml() + '<div class="aprop-llista"></div>';
            const kms = new Map(platges.map(p => [p, distancia(estat.ubicacio, p)]));
            const llista = platges.filter(passaFiltres).sort((a, b) => kms.get(a) - kms.get(b));
            cos.querySelector('.aprop-llista').innerHTML = llistaResultats(llista, p => kms.get(p));
        } else if (estat.ubicacioEstat === 'cercant') {
            cos.innerHTML = `<p class="aprop-cercant"><span class="girant"></span>${esc(tm('cercant_ubicacio'))}</p>`;
        } else {
            cos.innerHTML = `
                <div class="aprop-buit">
                    ${mapet(null, platges)}
                    <p>${esc(estat.ubicacioEstat === 'error' ? tm('ubicacio_error') : tm('a_prop_text'))}</p>
                    <button type="button" class="boto" data-accio="ubica">
                        <svg class="icona"><use href="#i-ubica" /></svg>${esc(tm('usa_ubicacio'))}
                    </button>
                </div>`;
        }
    };
    vistaActual.refresca();

    // Ask straight away only if the visitor already allowed it before
    if (estat.ubicacioEstat === 'cap' && navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' })
            .then(permis => { if (permis.state === 'granted' && estat.ubicacioEstat === 'cap') demanaUbicacio(); })
            .catch(() => { });
    }
}

function demanaUbicacio() {
    const torna = estatNou => {
        estat.ubicacioEstat = estatNou;
        vistaActual.refresca?.();
    };
    if (!navigator.geolocation) {
        torna('error');
        if (!vistaActual.errorEnLinia) avisa(tm('ubicacio_error'));
        return Promise.resolve(null);
    }
    torna('cercant');
    return new Promise(resol => navigator.geolocation.getCurrentPosition(
        posicio => {
            estat.ubicacio = { lat: posicio.coords.latitude, lon: posicio.coords.longitude };
            torna('ok');
            resol(estat.ubicacio);
        },
        () => {
            // A failed retry keeps the last known position
            torna(estat.ubicacio ? 'ok' : 'error');
            if (!vistaActual.errorEnLinia) avisa(tm('ubicacio_error'));
            resol(estat.ubicacio);
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }));
}

// =====================================================
// Search and filters
// =====================================================

function hiHaFiltres() {
    return Boolean(estat.superficies.size || estat.entorns.size || estat.naturisme);
}

function passaFiltres(p) {
    return (!estat.superficies.size || estat.superficies.has(p.superficie)) &&
        (!estat.entorns.size || estat.entorns.has(p.entorn)) &&
        (!estat.naturisme || p.naturisme);
}

function filtreActiu(filtre, valor) {
    if (filtre === 'naturisme') return estat.naturisme;
    return (filtre === 'superficie' ? estat.superficies : estat.entorns).has(valor);
}

function canviaFiltre(boto) {
    const { filtre, valor } = boto.dataset;
    if (filtre === 'naturisme') {
        estat.naturisme = !estat.naturisme;
    } else {
        const conjunt = filtre === 'superficie' ? estat.superficies : estat.entorns;
        if (conjunt.has(valor)) conjunt.delete(valor);
        else conjunt.add(valor);
    }
    boto.setAttribute('aria-pressed', String(filtreActiu(filtre, valor)));
    vistaActual.refresca?.();
}

function filtresHtml() {
    const xip = (filtre, valor, etiqueta, color) => `
        <button type="button" class="xip" data-filtre="${filtre}" data-valor="${esc(valor)}" aria-pressed="${filtreActiu(filtre, valor)}">
            ${color ? `<span class="xip-color" style="background:${color}"></span>` : ''}${esc(etiqueta)}
        </button>`;
    return `
        <div class="filtres" role="group" aria-label="${esc(tm('filtres'))}">
            ${SUPERFICIES.map(s => xip('superficie', s, t('superficie > ' + s), COLORS[s])).join('')}
            <span class="xip-separador"></span>
            ${ENTORNS.map(e => xip('entorn', e, t(CLAUS_ENTORN[e]))).join('')}
            <span class="xip-separador"></span>
            ${xip('naturisme', 'si', tm('naturisme'))}
        </div>`;
}

/**
 * Beaches matching every word typed, names that start with the search first
 */
function cercaPlatges() {
    const cerca = normalitza(estat.cerca);
    const paraules = cerca ? cerca.split(' ') : [];
    const trobades = platges.filter(p => passaFiltres(p) && paraules.every(paraula => p.textCerca.includes(paraula)));
    if (!cerca) return trobades;

    const punts = p => p.nomCerca.startsWith(cerca) ? 0
        : (' ' + p.nomCerca).includes(' ' + cerca) ? 1
            : p.nomCerca.includes(cerca) ? 2 : 3;
    return trobades
        .map(p => [punts(p), p])
        .sort((a, b) => a[0] - b[0] || a[1].nom.localeCompare(b[1].nom, estat.idioma))
        .map(([, p]) => p);
}

function llistaResultats(llista, km = null) {
    const esborra = hiHaFiltres()
        ? `<button type="button" class="enllac-boto" data-accio="esborra-filtres">${esc(tm('esborra_filtres'))}</button>` : '';
    if (!llista.length) {
        return `<div class="buit"><p>${esc(tm('cap_resultat'))}</p>${esborra}</div>`;
    }
    return `
        <div class="resultats-capcalera"><span>${esc(compte(llista.length))}</span>${esborra}</div>
        <ul class="llista">${llista.map(p => targetaPlatja(p, { km: km ? km(p) : null })).join('')}</ul>`;
}

function targetaPlatja(p, { km = null, senseMunicipi = false } = {}) {
    const lloc = [senseMunicipi ? '' : p.municipi, p.barri].filter(Boolean).join(' · ');
    const dades = [
        t('superficie > ' + p.superficie),
        p.llargaria ? nombre(p.llargaria) + ' m' : '',
        t(CLAUS_ENTORN[p.entorn])
    ].filter(Boolean);
    return `
        <li><a class="platja" href="${esc(enllacPlatja(p))}" data-nav>
            <span class="platja-textura" style="background-image:url(imatges/textures/petites/${TEXTURES[p.superficie] || 'arenal'}.jpg)"></span>
            <span class="platja-cos">
                <span class="platja-nom">${esc(p.nom)}</span>
                ${p.nomsAlternatius.length ? `<span class="platja-alt">${esc(p.nomsAlternatius.join(', '))}</span>` : ''}
                ${lloc ? `<span class="platja-lloc">${esc(lloc)}</span>` : ''}
                <span class="platja-dades">${dades.map(esc).join(' · ')}${p.naturisme ? `<span class="etiqueta">${esc(tm('naturisme'))}</span>` : ''}</span>
            </span>
            ${km != null ? `<span class="platja-distancia">${esc(distanciaText(km))}</span>` : ''}
        </a></li>`;
}

// =====================================================
// Island mini-maps (drawn from the desktop map sprite)
// =====================================================

function puntIlla(lat, lon) {
    return [
        ILLA.x0 + (lon - ILLA.oest) / (ILLA.est - ILLA.oest) * (ILLA.x1 - ILLA.x0),
        ILLA.y0 + (ILLA.nord - lat) / (ILLA.nord - ILLA.sud) * (ILLA.y1 - ILLA.y0)
    ];
}

/**
 * The island with one municipality in colour and a dot per beach.
 * Everything is in percentages, so CSS decides how big it is.
 */
function mapet(nomMunicipi, platgesMarcades = [], destacada = null) {
    const pc = (valor, total) => (valor / total * 100).toFixed(3) + '%';
    let html = '<span class="mapet" aria-hidden="true">';

    const sprite = MUNICIPIS_SPRITE[nomMunicipi];
    if (sprite) {
        const [x, y, w, h, sx, sy] = sprite;
        html += `<span class="mapet-municipi" style="left:${pc(x, ILLA.amplada)};top:${pc(y, ILLA.alcada)};` +
            `width:${pc(w, ILLA.amplada)};height:${pc(h, ILLA.alcada)};` +
            `--mida:${pc(SPRITE.amplada, w)} ${pc(SPRITE.alcada, h)};` +
            `--posicio:${pc(sx, SPRITE.amplada - w)} ${pc(sy, SPRITE.alcada - h)}"></span>`;
    }
    for (const p of platgesMarcades) {
        const [x, y] = puntIlla(p.lat, p.lon);
        html += `<span class="mapet-punt${p === destacada ? ' mapet-punt-destacat' : ''}" ` +
            `style="left:${pc(x, ILLA.amplada)};top:${pc(y, ILLA.alcada)}"></span>`;
    }
    return html + '</span>';
}

/**
 * A window on the sea centred on the municipality, zoomed so the municipality
 * fills about half of it (the window is 80 × 62 px in mobil.css)
 */
function finestraMunicipi(m) {
    const [x, y, w, h] = MUNICIPIS_SPRITE[m.nom];
    const escala = Math.min(0.9, Math.max(0.26, 0.55 * Math.min(80 / w, 62 / h)));
    const zoom = ILLA.amplada * escala / 80;
    const cx = (x + w / 2) / ILLA.amplada * 100;
    const cy = (y + h / 2) / ILLA.alcada * 100;
    return `<span class="finestra" style="--zoom:${zoom.toFixed(3)};--cx:${cx.toFixed(2)}%;--cy:${cy.toFixed(2)}%">` +
        mapet(m.nom, m.platges) + '</span>';
}

/**
 * Great-circle distance in km
 */
function distancia(a, b) {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
}

// =====================================================
// Leaflet maps (loaded the first time a map is shown)
// =====================================================

let promesaLeaflet = null;

function carregaLeaflet() {
    if (!promesaLeaflet) {
        const carrega = (etiqueta, atributs) => new Promise((resol, rebutja) => {
            const element = Object.assign(document.createElement(etiqueta), atributs);
            element.crossOrigin = '';
            element.onload = resol;
            element.onerror = rebutja;
            document.head.appendChild(element);
        });
        promesaLeaflet = Promise.all([
            carrega('link', { rel: 'stylesheet', href: LEAFLET.css, integrity: LEAFLET.cssIntegrity }),
            carrega('script', { src: LEAFLET.js, integrity: LEAFLET.jsIntegrity })
        ]).then(() => window.L);
        promesaLeaflet.catch(() => { promesaLeaflet = null; });
    }
    return promesaLeaflet;
}

const iconaPin = L => L.divIcon({
    className: 'pin',
    html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.3 7-12a7 7 0 0 0-14 0c0 5.7 7 12 7 12z" /><circle cx="12" cy="10" r="2.6" /></svg>',
    iconSize: [40, 40],
    iconAnchor: [20, 37]
});

/**
 * Satellite picture at the top of a beach; a link on top of it opens the full map
 */
async function iniciaMapaHeroi(p, tornMapa) {
    const L = await carregaLeaflet().catch(() => null);
    const contenidor = vista.querySelector('.heroi-mapa');
    if (!L || tornMapa !== torn || !contenidor) return;

    const mapa = L.map(contenidor, {
        zoomControl: false, dragging: false, touchZoom: false, doubleClickZoom: false,
        scrollWheelZoom: false, boxZoom: false, keyboard: false
    });
    mapes.push(mapa);
    mapa.attributionControl.setPrefix(false);
    mapa.setView([p.lat, p.lon], 16);
    L.tileLayer(MAPA_SATELLIT[0], { attribution: MAPA_SATELLIT[1], maxZoom: 19 }).addTo(mapa);
    L.marker([p.lat, p.lon], { icon: iconaPin(L), interactive: false, keyboard: false }).addTo(mapa);
}

/**
 * Every beach as a dot coloured by its surface; tapping one shows its card
 */
async function iniciaMapaGran(municipi, platjaInicial, tornMapa) {
    const L = await carregaLeaflet().catch(() => null);
    const contenidor = vista.querySelector('.mapa-gran-mapa');
    if (!L || tornMapa !== torn || !contenidor) return;

    // No keyboard panning: Leaflet would focus the map on every tap and draw a focus ring
    const fitxa = vista.querySelector('.mapa-gran-fitxa');
    const mapa = L.map(contenidor, { zoomControl: false, keyboard: false });
    mapes.push(mapa);
    mapa.attributionControl.setPrefix(false);
    L.control.zoom({ position: 'topright' }).addTo(mapa);
    L.tileLayer(MAPA_CARRERS[0], { attribution: MAPA_CARRERS[1], maxZoom: 19 }).addTo(mapa);

    const renderer = L.canvas({ tolerance: 10 });
    const capa = L.layerGroup().addTo(mapa);
    const marcadors = new Map();
    let seleccionada = null;
    let puntVisitant = null;

    // Smaller dots while the whole island is in view, so the coast does not turn into one line
    const radi = () => mapa.getZoom() < 10 ? 5 : 7;
    const estil = (p, triada) => ({
        renderer,
        radius: triada ? radi() + 4 : radi(),
        weight: triada ? 3 : 2,
        color: triada ? '#10204f' : '#ffffff',
        fillColor: COLORS[p.superficie] || '#888888',
        fillOpacity: 1,
        bubblingMouseEvents: false
    });

    const selecciona = p => {
        marcadors.get(seleccionada)?.setStyle(estil(seleccionada, false));
        seleccionada = p;
        fitxa.hidden = !p;
        if (!p) return;
        marcadors.get(p)?.setStyle(estil(p, true)).bringToFront();
        const km = estat.ubicacio ? distancia(estat.ubicacio, p) : null;
        fitxa.innerHTML = `
            <ul class="llista">${targetaPlatja(p, { km })}</ul>
            <button type="button" class="mapa-gran-tanca" data-accio="tanca-fitxa" aria-label="${esc(tm('tanca'))}">
                <svg class="icona"><use href="#i-tanca" /></svg>
            </button>`;
    };

    const pinta = () => {
        capa.clearLayers();
        marcadors.clear();
        for (const p of platges) {
            if (!passaFiltres(p)) continue;
            marcadors.set(p, L.circleMarker([p.lat, p.lon], estil(p, p === seleccionada))
                .on('click', () => selecciona(p))
                .addTo(capa));
        }
        if (seleccionada && !marcadors.has(seleccionada)) selecciona(null);
    };

    const mostraVisitant = () => {
        if (!estat.ubicacio) return;
        puntVisitant?.remove();
        puntVisitant = L.circleMarker([estat.ubicacio.lat, estat.ubicacio.lon], {
            radius: 8, weight: 3, color: '#ffffff', fillColor: '#1a73e8', fillOpacity: 1, interactive: false
        }).addTo(mapa);
    };

    const BotoUbicacio = L.Control.extend({
        options: { position: 'topright' },
        onAdd() {
            const boto = L.DomUtil.create('button', 'leaflet-bar mapa-ubica');
            boto.type = 'button';
            boto.setAttribute('aria-label', tm('la_meva_ubicacio'));
            boto.innerHTML = '<svg class="icona"><use href="#i-ubica" /></svg>';
            L.DomEvent.disableClickPropagation(boto);
            L.DomEvent.on(boto, 'click', async () => {
                const lloc = await demanaUbicacio();
                if (!lloc || tornMapa !== torn) return;
                mostraVisitant();
                mapa.setView([lloc.lat, lloc.lon], 12);
            });
            return boto;
        }
    });
    new BotoUbicacio().addTo(mapa);

    vistaActual.refresca = pinta;
    vistaActual.selecciona = selecciona;
    mapa.on('click', () => selecciona(null));
    mapa.on('zoomend', () => marcadors.forEach((marcador, p) => marcador.setStyle(estil(p, p === seleccionada))));

    if (platjaInicial) {
        mapa.setView([platjaInicial.lat, platjaInicial.lon], 14);
    } else {
        mapa.fitBounds((municipi ? municipi.platges : platges).map(p => [p.lat, p.lon]), { padding: [28, 28], maxZoom: 14 });
    }
    pinta();
    mostraVisitant();
    if (platjaInicial) selecciona(platjaInicial);
}

// =====================================================
// Weather (Open-Meteo forecast and marine APIs)
// =====================================================

// Same pictures and thresholds as the desktop beach page
function fotoTemps(codi) {
    if (codi === 0) return 'despejado.jpg';
    if (codi === 1 || codi === 2) return 'poco_nuboso.jpg';
    if (codi === 3) return 'nuboso.jpg';
    if (codi >= 45 && codi <= 48) return 'cubierto.jpg';
    if (codi >= 51 && codi <= 67) return 'nuboso_con_lluvia.jpg';
    if (codi >= 71 && codi <= 77) return 'cubierto.jpg';
    if (codi >= 80 && codi <= 82) return 'nuboso_con_lluvia.jpg';
    if (codi >= 85 && codi <= 86) return 'cubierto.jpg';
    if (codi >= 95) return 'cubierto_con_lluvia.jpg';
    return 'nuboso.jpg';
}

function simbolTemps(codi) {
    if (codi === 0) return '☀️';
    if (codi <= 2) return '🌤️';
    if (codi === 3) return '☁️';
    if (codi <= 48) return '🌫️';
    if (codi <= 67) return '🌧️';
    if (codi <= 77) return '🌨️';
    if (codi <= 82) return '🌦️';
    if (codi <= 86) return '🌨️';
    return '⛈️';
}

async function carregaTemps(p, tornTemps) {
    const lloc = `latitude=${p.lat}&longitude=${p.lon}`;
    const demana = url => fetch(url).then(resposta => resposta.ok ? resposta.json() : Promise.reject(new Error(resposta.status)));
    const [previsio, mar] = await Promise.allSettled([
        demana(`https://api.open-meteo.com/v1/forecast?${lloc}&current=weather_code,wind_speed_10m,wind_direction_10m` +
            '&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=2'),
        demana(`https://marine-api.open-meteo.com/v1/marine?${lloc}&current=wave_height,sea_surface_temperature&timezone=auto`)
    ]);

    const seccio = vista.querySelector('.temps');
    if (tornTemps !== torn || !seccio) return;
    const { current: ara, daily: dies } = previsio.status === 'fulfilled' ? previsio.value : {};
    if (!ara || !dies?.temperature_2m_max?.length) {
        seccio.remove();
        return;
    }

    const dia = (i, nom) => dies.temperature_2m_max[i] == null ? '' : `
        <div class="temps-dia">
            <span class="temps-dia-nom">${esc(nom)}</span>
            <span class="temps-simbol" aria-hidden="true">${simbolTemps(dies.weather_code[i])}</span>
            <span class="temps-max">${Math.round(dies.temperature_2m_max[i])}°</span>
            <span class="temps-min">${Math.round(dies.temperature_2m_min[i])}°</span>
        </div>`;
    // The arrow points where the wind blows to; the API gives where it comes from
    const extres = [];
    if (ara.wind_speed_10m != null) {
        extres.push(`
            <li><svg class="icona" style="transform:rotate(${((ara.wind_direction_10m || 0) + 180) % 360}deg)"><use href="#i-vent" /></svg>
                ${esc(tm('vent'))} ${nombre(Math.round(ara.wind_speed_10m))} km/h</li>`);
    }
    const aigua = mar.status === 'fulfilled' ? mar.value.current : null;
    if (aigua?.sea_surface_temperature != null) {
        extres.push(`<li>${esc(tm('aigua'))} ${nombre(Math.round(aigua.sea_surface_temperature))} °C</li>`);
    }
    if (aigua?.wave_height != null) {
        extres.push(`<li>${esc(tm('onades'))} ${nombre(aigua.wave_height, 1)} m</li>`);
    }

    seccio.classList.remove('temps-carregant');
    seccio.removeAttribute('aria-busy');
    seccio.style.setProperty('--foto', `url(imatges/textures/fotos_meteo/${fotoTemps(ara.weather_code)})`);
    seccio.innerHTML = `
        <h2>${esc(tm('temps'))}</h2>
        <div class="temps-dies">${dia(0, t('avui'))}${dia(1, t('dema'))}</div>
        <ul class="temps-extres">${extres.join('')}</ul>
        <a class="temps-font" href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>`;
}

// =====================================================
// Initialize
// =====================================================

(async function inicia() {
    history.scrollRestoration = 'manual';
    await waitForBoMDataLoaded();

    blocDefecte = BoMdata.querySelector('texts > text');
    const codis = Array.from(BoMdata.querySelectorAll('texts > text'), bloc => bloc.getAttribute('idiomaCodi'));
    const demanat = new URLSearchParams(location.search).get('lang') || navigator.language?.substring(0, 2);
    estat.idioma = codis.includes(demanat) ? demanat : (codis.includes('en') ? 'en' : codis[0]);

    selectIdioma.innerHTML = Array.from(BoMdata.querySelectorAll('texts > text'), bloc =>
        `<option value="${esc(bloc.getAttribute('idiomaCodi'))}">${esc(bloc.getAttribute('idioma'))}</option>`).join('');
    selectIdioma.addEventListener('change', () => {
        estat.idioma = selectIdioma.value;
        const url = new URL(location.href);
        url.searchParams.set('lang', estat.idioma);
        history.replaceState(history.state, '', url);
        const scroll = scrollY;
        mostra();
        scrollTo(0, scroll);
    });

    llegeixDades();
    if (!history.state) history.replaceState({ dins: false, scroll: 0 }, '');
    mostra();
})();
