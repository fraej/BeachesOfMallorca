// Declare a global variable to hold BoMdata
let BoMdata; // Global variable

(async () => {
    try {
        const response = await fetch('BoMdata.xml');
        const data = await response.text();
        BoMdata = new DOMParser().parseFromString(data, 'application/xml');
    } catch (error) {
        console.error('Error fetching BoMdata.xml:', error);
    }
})();

// Call the function to execute the code
async function waitForBoMDataLoaded() {
    if (!BoMdata) {
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (BoMdata) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }
}
