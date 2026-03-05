$('ol > li > a').hover(console.log("entra"), console.log("surt"));
$('ol > li > a').each(function () {
    $(this).qtip({
        content: {
            text: $(this).next('.tooltiptext'),
            title: $(this).text()
        },
        hide: {
            fixed: true,
            delay: 300,
            event: 'unfocus',
            leave: false,
            effect: function (offset) {
                $(this).slideUp(200); // "this" refers to the tooltip
            }
        },
        position: {
            my: 'top center', // Position my top left...
            at: 'center', // at the bottom right of...
            //                target: $('.selector') // my target
            viewport: $(window),
            adjust: {
                method: 'shift none'
            }
        },
        show: {
            event: 'click',
            effect: function (offset) {
                $(this).slideDown(200); // "this" refers to the tooltip
            }
        },
        style: {
            tip: {
                //                    corner: 'bottom center',
                //                    mimic: 'bottom left',
                //                    border: 1,
                width: 10,
                height: 25
            },
            classes: 'qtip-green qtip-shadow qtip-rounded'
        }
    });
});

/**
 * Client-side autocomplete search that replaces the old autocomplete.php
 * Searches through BoMdata.xml for matching beach names and alternative names
 */
async function getAllBeachesForAutocomplete() {
    await waitForBoMDataLoaded();

    const municipiNodes = BoMdata.querySelectorAll('municipi');
    const allBeaches = [];

    for (const municipiNode of municipiNodes) {
        const municipiName = municipiNode.getAttribute('nom');
        const platjaNodes = municipiNode.querySelectorAll('platja');

        for (const platjaNode of platjaNodes) {
            const beachName = platjaNode.getAttribute('nom');
            const altNames = [];
            const nomsAltNode = platjaNode.querySelector('noms_alternatius');
            if (nomsAltNode) {
                const altNodes = nomsAltNode.querySelectorAll('nom_alt');
                for (const altNode of altNodes) {
                    altNames.push(altNode.textContent);
                }
            }

            allBeaches.push({
                nom: beachName,
                municipi: municipiName,
                altNames: altNames,
                // Searchable text includes name + alt names
                searchText: [beachName, ...altNames].join(' ').toLowerCase()
            });
        }
    }

    return allBeaches;
}

// Set up the autocomplete with client-side search
(async function initAutocomplete() {
    const allBeaches = await getAllBeachesForAutocomplete();

    $("#inputCercador").autocomplete({
        source: function (request, response) {
            const term = request.term.toLowerCase();
            const matches = allBeaches.filter(beach =>
                beach.searchText.includes(term)
            ).slice(0, 14); // Limit to 14 results like the old PHP

            const results = matches.map(beach => ({
                id: 'platja.html?municipi=' + encodeURIComponent(beach.municipi) + '&platja=' + encodeURIComponent(beach.nom) + '&lang=' + getCurrentLang(),
                value: beach.nom + ' (' + beach.municipi + ')',
                label: beach.nom + ' (' + beach.municipi + ')'
            }));

            response(results);
        },
        minLength: 2,
        select: function (event, ui) {
            var url = ui.item.id;
            if (url != '#') {
                location.href = url;
            }
            return false;
        },
        html: true,
        open: function (event, ui) {
            $(".ui-autocomplete").css("z-index", 1000);
        }
    });
})();


// Function to set the lang attribute based on the browser's language
function setLanguage() {
    var userLang = navigator.language || navigator.userLanguage; // Get browser language
    $("html").attr("lang", userLang); // Set lang attribute
}

/**
 * Gets all beaches (platges) for a given municipality (municipi)
 * @param {string} municipi - The name of the municipality to search for
 * @returns {Promise<Array>} - A promise that resolves to an array of beach objects
 */
async function getPlatgesForMunicipi(municipi) {
    await waitForBoMDataLoaded();

    // Find the municipi node in the XML
    const municipiNodes = BoMdata.querySelectorAll('municipi');
    let platgesArray = [];

    for (const municipiNode of municipiNodes) {
        if (municipiNode.getAttribute('nom') === municipi) {
            // Get all platja nodes for this municipi
            const platjaNodes = municipiNode.querySelectorAll('platja');

            // Convert NodeList to array of beach objects
            platgesArray = Array.from(platjaNodes).map(platjaNode => {
                const platja = {
                    nom: platjaNode.getAttribute('nom'),
                    superficie_tipus: getNodeTextContent(platjaNode, 'superficie_tipus'),
                    entorn: getNodeTextContent(platjaNode, 'entorn'),
                    llargaria: getNodeTextContent(platjaNode, 'llargaria'),
                    amplada_mitjana: getNodeTextContent(platjaNode, 'amplada_mitjana'),
                    latitud: getNodeTextContent(platjaNode, 'latitud'),
                    longitud: getNodeTextContent(platjaNode, 'longitud'),
                    nat: getNodeTextContent(platjaNode, 'nat')
                };

                // Check for alternative names
                const nomsAltNode = platjaNode.querySelector('noms_alternatius');
                if (nomsAltNode) {
                    platja.noms_alternatius = Array.from(nomsAltNode.querySelectorAll('nom_alt'))
                        .map(node => node.textContent);
                }

                return platja;
            });

            break; // Found the municipi, no need to continue searching
        }
    }

    return platgesArray;
}

/**
 * Helper function to safely get text content from an XML node
 * @param {Element} parentNode - The parent node to search in
 * @param {string} tagName - The tag name to find
 * @returns {string} - The text content of the node or empty string if not found
 */
function getNodeTextContent(parentNode, tagName) {
    const node = parentNode.querySelector(tagName);
    return node ? node.textContent : '';
}

/**
 * Returns the active language code: from ?lang= URL param, or browser language, or fallback 'ca'
 */
function getCurrentLang() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('lang') || navigator.language?.substring(0, 2) || 'ca';
}

/**
 * Gets text content from BoMdata for the current language by element tag name.
 * Searches within the correct <text idiomaCodi="xx"> block.
 * @param {string} id - The XML tag name to look up
 * @returns {Promise<string>} - The translated text content
 */
async function getTextById(id) {
    await waitForBoMDataLoaded();
    const langCode = getCurrentLang();

    // Try matching language first, then fall back to the first <text> block
    const textBlocks = BoMdata.querySelectorAll('texts > text');
    let fallbackNode = null;

    for (const block of textBlocks) {
        const node = block.querySelector(id);
        if (!node) continue;
        if (block.getAttribute('idiomaCodi') === langCode) return node.textContent;
        if (!fallbackNode) fallbackNode = node;
    }

    return fallbackNode ? fallbackNode.textContent : '';
}

/**
 * Gets the meta keywords from the XML data for the current language
 */
async function getIndexMetaKeywords() {
    return getTextById('index_meta_name_keywords');
}

/**
 * Gets the meta description from the XML data for the current language
 */
async function getIndexMetaDescription() {
    return getTextById('index_meta_name_description');
}

/**
 * Updates all spans and divs with their corresponding content from BoMdata
 */
async function setPageContents() {
    // Handle spans
    const spans = document.querySelectorAll('span[id], small[id]');
    for (const element of spans) {
        const content = await getTextById(element.id);
        if (content) {
            element.textContent = content;
        }
    }

    // Handle divs that need content from BoMdata
    const divIds = ['textClickaMapa', 'textCercaPlatja'];
    for (const divId of divIds) {
        const div = document.getElementById(divId);
        if (div) {
            const content = await getTextById(divId);
            if (content) {
                const p = div.querySelector('p');
                if (p) {
                    p.textContent = content;
                }
            }
        }
    }
}


/**
 * Sets a meta tag in the document head
 * @param {string} name - The name attribute value
 * @param {string} content - The content attribute value
 */
function setMetaTag(name, content) {
    let metaTag = document.querySelector(`meta[name="${name}"]`);
    if (metaTag) {
        metaTag.setAttribute('content', content);
    } else {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('name', name);
        metaTag.setAttribute('content', content);
        document.head.appendChild(metaTag);
    }
}

/**
 * Sets the meta tags in the document head
 */
async function setMetaTags() {
    const [keywords, description] = await Promise.all([
        getIndexMetaKeywords(),
        getIndexMetaDescription()
    ]);

    setMetaTag('keywords', keywords);
    setMetaTag('description', description);
}

async function createDynamicLinks() {
    $('#mapa > li').each(async function () {
        const municipi = $(this).find('a').text(); // Get the text of the <a> element

        // Create a new ul element
        const ul = $('<ul></ul>');

        // Get all beaches for this municipality
        const platgesArray = await getPlatgesForMunicipi(municipi);

        // Create a link for each beach
        for (const platja of platgesArray) {
            const platjaName = platja.nom;
            const link = $('<a></a>')
                .attr('href', 'platja.html?municipi=' + encodeURIComponent(municipi) + '&platja=' + encodeURIComponent(platjaName) + '&lang=' + getCurrentLang())
                .text(platjaName);
            const listItem = $('<li></li>').append(link);

            // Append the list item to the ul
            ul.append(listItem);
        }

        // If no beaches were found, create a generic municipality link
        if (platgesArray.length === 0) {
            const link = $('<a></a>')
                .attr('href', 'platja.html?municipi=' + encodeURIComponent(municipi) + '&lang=' + getCurrentLang())
                .text('Platges de ' + municipi);
            const listItem = $('<li></li>').append(link);
            ul.append(listItem);
        }

        // Append the ul to the tooltiptext div
        $(this).find('.tooltiptext').append(ul);
    });
}

async function setLangOptions() {
    await waitForBoMDataLoaded();

    const langCode = getCurrentLang();
    const textBlocks = BoMdata.querySelectorAll('texts > text');
    let options = '';

    textBlocks.forEach(block => {
        const idioma = block.getAttribute('idioma');
        const codi = block.getAttribute('idiomaCodi');
        if (idioma && codi) {
            const selected = codi === langCode ? ' selected' : '';
            options += `<option value="${codi}"${selected}>${idioma}</option>`;
        }
    });

    const langSelect = document.getElementById('lang');
    langSelect.innerHTML = options;

    // Reload the page with the chosen language when user changes it
    langSelect.addEventListener('change', function () {
        const url = new URL(window.location.href);
        url.searchParams.set('lang', this.value);
        window.location = url.toString();
    });
}

async function setCodis() {
    await waitForBoMDataLoaded();

    // XPath query to get all language nodes and their codes
    const languageNodes = BoMdata.evaluate('//text', BoMdata, null, XPathResult.ANY_TYPE, null);
    let node = languageNodes.iterateNext();

    let options = '';
    // Iterate through results
    while (node) {
        options += `<a href=index.html?lang=${node.attributes[1].value}>${node.attributes[1].value}</a>`;
        node = languageNodes.iterateNext();
    }
    // Append options to the select element
    document.getElementById('idiomes').innerHTML = options;
}

async function searchPlatjaInSearcher() {
    const text = await getTextById('cercador_text_defecte');
    const placeholder = document.querySelector('#inputCercador');
    if (placeholder && text) placeholder.setAttribute('placeholder', text);
}

// Call functions on page load
setLanguage();
createDynamicLinks();
setMetaTags();
setPageContents(); // Replace setSpanContents()
setLangOptions();
setCodis();
searchPlatjaInSearcher();