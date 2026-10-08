// Phones get the mobile app (mobil.html); every other device keeps the desktop pages.
// The query string travels along, so a shared link opens the same beach on either side.
(function () {
    const pantallaPetita = Math.min(screen.width, screen.height) < 600;
    const navegadorMobil = /Mobi|Android|iPhone|iPod/i.test(navigator.userAgent);
    const esMobil = pantallaPetita && navegadorMobil;

    const pagina = location.pathname.split('/').pop();
    const aMobil = /^mobil(\.html)?$/.test(pagina);
    if (esMobil === aMobil) return;

    const params = new URLSearchParams(location.search);
    const desti = esMobil ? 'mobil.html' : (params.get('platja') ? 'platja.html' : 'index.html');
    location.replace(desti + location.search + location.hash);
})();
