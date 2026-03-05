// =====================================================
// URL Parameter Helpers
// =====================================================

function getUrlVars() {
    var vars = {};
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
        vars[key] = value;
    });
    return vars;
}

function getParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const platja = urlParams.get('platja');
    const municipi = urlParams.get('municipi');
    const lang = urlParams.get('lang');
    return { platja, municipi, lang };
}

function getCurrentLang() {
    const { lang } = getParameters();
    return lang || navigator.language?.substring(0, 2) || 'ca';
}

// =====================================================
// Coordinate Conversion (ported from PHP DecimalToDMS)
// =====================================================

/**
 * Converts a decimal coordinate to Degrees, Minutes, Seconds
 * @param {number} decimal - The decimal coordinate value
 * @param {boolean} isLatitude - true for latitude, false for longitude
 * @returns {string} - Formatted DMS string
 */
function decimalToDMS(decimal, isLatitude) {
    // Handle comma as decimal separator (European format in the XML)
    if (typeof decimal === 'string') {
        decimal = parseFloat(decimal.replace(',', '.'));
    }

    if (isNaN(decimal) || Math.abs(decimal) > 180) {
        return '';
    }

    let direction;
    if (isLatitude) {
        direction = decimal >= 0 ? 'N' : 'S';
    } else {
        direction = decimal >= 0 ? 'E' : 'W';
    }

    const d = Math.abs(decimal);
    const degrees = Math.floor(d);
    const totalSeconds = (d - degrees) * 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds - (minutes * 60));

    return `${degrees}° ${minutes}′ ${seconds}″ ${direction}`;
}

// =====================================================
// Surface Type (ported from PHP getSuperficie)
// =====================================================

function getSuperficieImage(superficieTipus) {
    switch (superficieTipus) {
        case 'còdols': return 'codolar';
        case 'arena': return 'arenal';
        case 'roques': return 'roques';
        case 'grava': return 'grava';
        default: return null;
    }
}

// =====================================================
// Area Calculation (ported from PHP calculaSuperfície)
// =====================================================

function calculaSuperficie(llargaria, ampladaMitjana) {
    const area = llargaria * ampladaMitjana;
    if (area > 1e5) {
        return (area / 1e6) + ' Km²';
    } else {
        return area + ' m²';
    }
}

// =====================================================
// Text Helpers (i18n from XML)
// =====================================================

/**
 * Gets a translated text value from BoMdata XML based on current language
 * @param {string} key - The XML element name to look up
 * @returns {string} - The text content
 */
function getTranslatedText(key) {
    if (!BoMdata) return '';

    // Get current language from URL or default
    const { lang } = getParameters();
    const langCode = lang || navigator.language?.substring(0, 2) || 'ca';

    /**
     * Gets the direct text content of an XML node
     * (excludes text from child elements)
     */
    function getDirectText(node) {
        if (!node) return '';
        // If the node has no element children, return its full textContent
        if (node.children.length === 0) {
            return node.textContent;
        }
        // Otherwise, gather only direct text nodes
        let text = '';
        for (const child of node.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                text += child.textContent.trim();
            }
        }
        return text;
    }

    // Try to find the text node for this language
    const textNodes = BoMdata.querySelectorAll('texts > text');
    for (const textNode of textNodes) {
        const codi = textNode.getAttribute('idiomaCodi');
        if (codi === langCode) {
            // Try all matching nodes (handles duplicate tags like <superficie>)
            const nodes = textNode.querySelectorAll(key);
            for (const node of nodes) {
                const text = getDirectText(node);
                if (text) return text;
            }
            return '';
        }
    }

    // Fallback: try first language
    const firstText = BoMdata.querySelector('texts > text');
    if (firstText) {
        const nodes = firstText.querySelectorAll(key);
        for (const node of nodes) {
            const text = getDirectText(node);
            if (text) return text;
        }
    }

    return '';
}

/**
 * Gets the translated environment type
 */
function getEntornText(value) {
    switch (value) {
        case 'urbà': return getTranslatedText('entorn_urba');
        case 'semi-urbà': return getTranslatedText('entorn_semi_urba');
        case 'natural': return getTranslatedText('entorn_natural');
        default: return '';
    }
}

/**
 * Gets the translated surface type text
 */
function getSuperficieText(value) {
    // The surface types are nested inside <superficie> in the texts
    if (!BoMdata) return '';

    const { lang } = getParameters();
    const langCode = lang || navigator.language?.substring(0, 2) || 'ca';

    const textNodes = BoMdata.querySelectorAll('texts > text');
    for (const textNode of textNodes) {
        const codi = textNode.getAttribute('idiomaCodi');
        if (codi === langCode) {
            const superficieNode = textNode.querySelector('superficie');
            if (superficieNode) {
                const node = superficieNode.querySelector(value);
                return node ? node.textContent : value;
            }
        }
    }

    return value;
}

// =====================================================
// Weather Data (Open-Meteo API)
// =====================================================

function getWeatherImage(code) {
    if (code === 0) return 'despejado.jpg';
    if (code === 1 || code === 2) return 'poco_nuboso.jpg';
    if (code === 3) return 'nuboso.jpg';
    if (code >= 45 && code <= 48) return 'cubierto.jpg';
    if (code >= 51 && code <= 67) return 'nuboso_con_lluvia.jpg';
    if (code >= 71 && code <= 77) return 'cubierto.jpg';
    if (code >= 80 && code <= 82) return 'nuboso_con_lluvia.jpg';
    if (code >= 85 && code <= 86) return 'cubierto.jpg';
    if (code >= 95) return 'cubierto_con_lluvia.jpg';
    return 'nuboso.jpg';
}

async function fetchWeather(lat, lon) {
    const meteoDiv = document.querySelector('#meteo');
    const meteoContent = document.querySelector('#meteoContent');
    if (!meteoDiv || !meteoContent) return;

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.current && data.daily) {
            const tempMax = data.daily.temperature_2m_max[0];
            const tempMin = data.daily.temperature_2m_min[0];
            const windSpeed = data.current.wind_speed_10m;
            const weatherCode = data.current.weather_code;

            const bgImage = getWeatherImage(weatherCode);
            meteoDiv.style.backgroundImage = `url(imatges/textures/fotos_meteo/${bgImage})`;

            meteoContent.innerHTML =
                "<br><span class='tempMax'>" + Math.round(tempMax) + "&nbsp;&deg;C</span><br>" +
                "<span class='tempMin'>" + Math.round(tempMin) + "&nbsp;&deg;C</span>" +
                "<span class='viento'><img src='imatges/decoracions/wind_cock.png'><br>" +
                Math.round(windSpeed) + " <small>Km/h</small></span>";
        }
    } catch (error) {
        console.error("Error fetching weather:", error);
    }
}

// =====================================================
// Main Beach Page Population
// =====================================================

async function setPlatjaName() {
    await waitForBoMDataLoaded();
    const { platja, municipi } = getParameters();

    const platjaObjecte = BoMdata.evaluate(
        `//platja[@nom="${platja}"]`,
        BoMdata, null, XPathResult.FIRST_ORDERED_NODE_TYPE
    ).singleNodeValue;

    if (!platjaObjecte) {
        console.error('Beach not found:', platja);
        return;
    }

    const beachName = platjaObjecte.getAttribute('nom');

    // Set title
    document.querySelector('#platja h1').textContent = beachName;
    document.querySelector('title').textContent = beachName + ' | BeachesOfMallorca';

    // Alternative names
    const nomsAlt = platjaObjecte.getElementsByTagName('nom_alt');
    if (nomsAlt.length > 0) {
        const noms = Array.from(nomsAlt).map(nom => nom.textContent).join(', ');
        document.querySelector('#títolNomsAlternatius').textContent = noms;
    } else {
        // Hide the h3 if no alternative names
        const h3 = document.querySelector('hgroup h3');
        if (h3) h3.style.display = 'none';
    }

    // Barri (neighbourhood)
    const barriNode = platjaObjecte.querySelector('barri');
    if (barriNode) {
        document.querySelector('#barri').textContent = barriNode.textContent + ', ';
    }

    // Municipi
    if (platjaObjecte.parentElement && platjaObjecte.parentElement.parentElement &&
        platjaObjecte.parentElement.parentElement.nodeName === 'municipi') {
        const municipiName = platjaObjecte.parentElement.parentElement.getAttribute('nom');
        document.querySelector('#municipi').textContent = municipiName;
        const municipiLabel = document.querySelector('#municipiLabel');
        if (municipiLabel) municipiLabel.textContent = municipiName;
    }

    // Coordinates
    const latitud = platjaObjecte.querySelector('latitud')?.textContent || '';
    const longitud = platjaObjecte.querySelector('longitud')?.textContent || '';

    const coordLabel = document.querySelector('#coordenadesLabel');
    if (coordLabel) coordLabel.textContent = getTranslatedText('coordenades');
    document.querySelector('#coordenadesLat').textContent = decimalToDMS(latitud, true);
    document.querySelector('#coordenadesLon').textContent = decimalToDMS(longitud, false);

    // Surface type
    const superficieTipus = platjaObjecte.querySelector('superficie_tipus')?.textContent || '';
    const superficieImg = getSuperficieImage(superficieTipus);
    if (superficieImg) {
        const superficieDiv = document.querySelector('#superficie');
        if (superficieDiv) {
            superficieDiv.style.backgroundImage = `url(imatges/textures/${superficieImg}.jpg)`;
        }
    }
    const superficieIntro = document.querySelector('#superficieIntro');
    if (superficieIntro) {
        // Get surface intro text from XML: <superficie><intro>...</intro></superficie>
        const introText = getTranslatedText('superficie > intro');
        superficieIntro.textContent = introText;
    }
    const superficieTipusEl = document.querySelector('#superficieTipus');
    if (superficieTipusEl) {
        superficieTipusEl.textContent = getSuperficieText(superficieTipus);
    }

    // Surface dimensions
    const llargaria = parseInt(platjaObjecte.querySelector('llargaria')?.textContent || '0');
    const ampladaMitjana = parseInt(platjaObjecte.querySelector('amplada_mitjana')?.textContent || '0');
    const superficieMidaContent = document.querySelector('#superficieMidaContent');
    if (superficieMidaContent) {
        const llargariaText = getTranslatedText('llargaria');
        const ampladaText = getTranslatedText('amplada_mitjana');
        const metresText = getTranslatedText('metres');
        const superficieText = getTranslatedText('superficie');

        superficieMidaContent.innerHTML =
            `${llargariaText}: ${llargaria} ${metresText}<br>` +
            `${ampladaText}: ${ampladaMitjana} ${metresText}<br>` +
            `${superficieText}: ${calculaSuperficie(llargaria, ampladaMitjana)}`;
    }

    // Environment type
    const entorn = platjaObjecte.querySelector('entorn')?.textContent || '';
    const entornLabel = document.querySelector('#entornLabel');
    if (entornLabel) entornLabel.textContent = getTranslatedText('tipus_entorn');
    const entornValue = document.querySelector('#entornValue');
    if (entornValue) entornValue.textContent = getEntornText(entorn);

    // Labels
    const platgesDeText = document.querySelector('#platgesDeText');
    if (platgesDeText) platgesDeText.textContent = getTranslatedText('platges_de');

    const iniciText = document.querySelector('#iniciText');
    if (iniciText) iniciText.textContent = getTranslatedText('inici');

    // Update Home link to preserve language
    const iniciLink = document.querySelector('#inici a');
    if (iniciLink) iniciLink.href = 'index.html?lang=' + getCurrentLang();

    const fotoPanoramicaText = document.querySelector('#fotoPanoramicaText');
    if (fotoPanoramicaText) fotoPanoramicaText.innerHTML = getTranslatedText('foto_panoramica');

    const idiomaEleccio = document.querySelector('#idioma_elecció');
    if (idiomaEleccio) idiomaEleccio.textContent = getTranslatedText('idioma_elecció');

    // Meta tags
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
        let keywords = beachName;
        if (nomsAlt.length > 0) {
            keywords += ', ' + Array.from(nomsAlt).map(n => n.textContent).join(', ');
        }
        metaKeywords.setAttribute('content', keywords);
    }

    // Fetch and display weather
    if (latitud && longitud) {
        fetchWeather(parseCoord(latitud), parseCoord(longitud));
    }
}

/**
 * Populates the beach selector dropdown and sets up navigation
 */
async function populateBeachSelector() {
    await waitForBoMDataLoaded();
    const { platja, municipi } = getParameters();

    if (!municipi) return;

    // Find all beaches in this municipality
    const municipiNode = BoMdata.evaluate(
        `//municipi[@nom="${municipi}"]`,
        BoMdata, null, XPathResult.FIRST_ORDERED_NODE_TYPE
    ).singleNodeValue;

    if (!municipiNode) return;

    const platjaNodes = municipiNode.querySelectorAll('platja');
    const select = document.getElementById('selectPlatja');

    if (!select) return;

    let currentIndex = -1;
    const beaches = [];

    platjaNodes.forEach((platjaNode, index) => {
        const nom = platjaNode.getAttribute('nom');
        beaches.push(nom);

        const option = document.createElement('option');
        option.value = 'platja.html?municipi=' + encodeURIComponent(municipi) +
            '&platja=' + encodeURIComponent(nom) +
            '&lang=' + getCurrentLang();
        option.textContent = nom;

        if (nom === platja) {
            option.selected = true;
            currentIndex = index;
        }

        select.appendChild(option);
    });

    // Set up select change handler
    select.addEventListener('change', function () {
        const url = this.value;
        if (url) {
            window.location = url;
        }
    });

    // Set up prev/next arrows
    const prevLink = document.querySelector('#fletxaEsquerra a');
    const nextLink = document.querySelector('#fletxaDreta a');

    if (currentIndex > 0) {
        const prevBeach = beaches[currentIndex - 1];
        prevLink.href = 'platja.html?municipi=' + encodeURIComponent(municipi) +
            '&platja=' + encodeURIComponent(prevBeach) +
            '&lang=' + getCurrentLang();
    }

    if (currentIndex >= 0 && currentIndex < beaches.length - 1) {
        const nextBeach = beaches[currentIndex + 1];
        nextLink.href = 'platja.html?municipi=' + encodeURIComponent(municipi) +
            '&platja=' + encodeURIComponent(nextBeach) +
            '&lang=' + getCurrentLang();
    }
}

/**
 * Sets up language selector options
 */
async function setLangOptions() {
    await waitForBoMDataLoaded();

    const languageNodes = BoMdata.evaluate('//text', BoMdata, null, XPathResult.ANY_TYPE, null);
    let node = languageNodes.iterateNext();

    let options = '';
    while (node) {
        // Avoid matching non-language text nodes (only match direct children of <texts>)
        if (node.parentElement && node.parentElement.nodeName === 'texts') {
            const idioma = node.getAttribute('idioma');
            const codi = node.getAttribute('idiomaCodi');
            if (idioma && codi) {
                options += `<option value="${codi}">${idioma}</option>`;
            }
        }
        node = languageNodes.iterateNext();
    }

    const langSelect = document.getElementById('lang');
    if (langSelect) {
        langSelect.innerHTML = options;

        // Set current language
        const { lang } = getParameters();
        if (lang) {
            const option = langSelect.querySelector(`option[value="${lang}"]`);
            if (option) option.selected = true;
        }

        // Handle language change
        langSelect.addEventListener('change', function () {
            const { platja, municipi } = getParameters();
            const newUrl = 'platja.html?platja=' + encodeURIComponent(platja) +
                '&municipi=' + encodeURIComponent(municipi) +
                '&lang=' + this.value;
            window.location = newUrl;
        });
    }
}

// =====================================================
// jQuery-based UI interactions
// =====================================================

$(document).ready(function () {
    ocultaDivSenseFoto();
    ocultaCintaFoto();
    efectesSeccióNavegació();

    $("#inici").mouseenter(function () {
        $("#mapet").css("background-position", "0 0");
        $("#navegacio ul li a[href^='index']").animate({ top: "0" }, 500);
    });
    $("#inici").mouseleave(function () {
        $("#mapet").css("background-position", "0 -24px");
        $("#navegacio ul li a[href^='index']").animate({ top: "-38px" }, 200);
    });
});

function ocultaCintaFoto() {
    $("#envoltoriFoto").scroll(function () {
        $("#ribbon").fadeOut(1500);
    });
}

/**
 * If a beach has no photo, hide the entire ribbon container
 */
function ocultaDivSenseFoto() {
    if ($("#foto").attr("src") === "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7") {
        $("#envoltoriRibbon").hide();
    }
}

/**
 * Navigation section hover effects
 */
function efectesSeccióNavegació() {
    $("#fletxaEsquerra").mouseenter(function () {
        $("#municipiForm").css("background-image", "linear-gradient(270deg,#636200 40%,#fffc00)");
    });
    $("#fletxaDreta").mouseenter(function () {
        $("#municipiForm").css("background-image", "linear-gradient(90deg,#636200 40%,#fffc00)");
    });

    $("#fletxaDreta, #fletxaEsquerra").mouseleave(function () {
        $("#municipiForm").css("background-image", "none");
    });
}

// =====================================================
// Leaflet Maps (replaces old Google Maps)
// =====================================================

/**
 * Parses a coordinate string from the XML (European format with comma)
 * @param {string} coord - Coordinate string like "39,86557"
 * @returns {number} - Parsed float
 */
function parseCoord(coord) {
    if (!coord) return 0;
    return parseFloat(coord.replace(',', '.'));
}

/**
 * Initializes both maps: general overview + specific satellite view
 */
async function initializeMaps() {
    await waitForBoMDataLoaded();
    const { platja, municipi } = getParameters();

    if (!platja || !municipi) return;

    // Find the current beach's coordinates
    const platjaNode = BoMdata.evaluate(
        `//platja[@nom="${platja}"]`,
        BoMdata, null, XPathResult.FIRST_ORDERED_NODE_TYPE
    ).singleNodeValue;

    if (!platjaNode) return;

    const lat = parseCoord(platjaNode.querySelector('latitud')?.textContent);
    const lon = parseCoord(platjaNode.querySelector('longitud')?.textContent);

    if (!lat || !lon) return;

    // ---- Right map: Satellite/aerial view of the specific beach ----
    const mapEspecific = L.map('mapaEspecífic', {
        scrollWheelZoom: false
    }).setView([lat, lon], 17);

    // Esri World Imagery (free satellite tiles)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        maxZoom: 19
    }).addTo(mapEspecific);

    // Add marker for the current beach
    L.marker([lat, lon]).addTo(mapEspecific)
        .bindPopup(`<b>${platja}</b>`)
        .openPopup();

    // ---- Left map: Overview of all beaches in the municipality ----
    const mapGeneral = L.map('mapaGeneral', {
        scrollWheelZoom: false
    }).setView([lat, lon], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19
    }).addTo(mapGeneral);

    // Find all beaches in the municipality and add markers
    const municipiNode = BoMdata.evaluate(
        `//municipi[@nom="${municipi}"]`,
        BoMdata, null, XPathResult.FIRST_ORDERED_NODE_TYPE
    ).singleNodeValue;

    if (!municipiNode) return;

    const platjaNodes = municipiNode.querySelectorAll('platja');
    const bounds = L.latLngBounds();

    // Custom icons
    const redIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    const greyIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    platjaNodes.forEach(node => {
        const beachName = node.getAttribute('nom');
        const beachLat = parseCoord(node.querySelector('latitud')?.textContent);
        const beachLon = parseCoord(node.querySelector('longitud')?.textContent);

        if (!beachLat || !beachLon) return;

        const isCurrent = (beachName === platja);
        const icon = isCurrent ? redIcon : greyIcon;

        const marker = L.marker([beachLat, beachLon], { icon: icon, zIndexOffset: isCurrent ? 1000 : 0 })
            .addTo(mapGeneral);

        if (isCurrent) {
            marker.bindPopup(`<b>${beachName}</b>`).openPopup();
        } else {
            // Clicking on other beach markers navigates to that beach
            marker.bindPopup(
                `<a href="platja.html?municipi=${encodeURIComponent(municipi)}&platja=${encodeURIComponent(beachName)}&lang=${getCurrentLang()}">${beachName}</a>`
            );
        }

        bounds.extend([beachLat, beachLon]);
    });

    // Fit the general map to show all markers
    if (bounds.isValid()) {
        mapGeneral.fitBounds(bounds, { padding: [30, 30] });
    }
}

// =====================================================
// Initialize
// =====================================================

setPlatjaName();
populateBeachSelector();
setLangOptions();
initializeMaps();
