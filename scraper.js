// scraper.js
const puppeteer = require('puppeteer');

async function scrapeLikesWithCredentials({ username, password, headless = true }) {
    const browser = await puppeteer.launch({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    });


    const page = await browser.newPage();
    try {
        // user agent desktop to ensure menu appears (tu peux tester mobile by setting viewport)
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36');
        await page.setViewport({ width: 1200, height: 800 });

        // 1) aller à la page de login
        await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2', timeout });

        // attend et remplit le formulaire
        await page.waitForSelector('input[name="username"]', { timeout: 15000 });
        await page.type('input[name="username"]', username, { delay: 50 });
        await page.type('input[name="password"]', password, { delay: 50 });
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout }),
        ]);

        // gérer popups (Save info / Turn on notifications)
        try {
            await page.waitForTimeout(1000);
            const notNowBtn = await page.$x("//button[contains(., 'Not Now') or contains(., \"Plus tard\") or contains(., 'Plus tard')]");
            if (notNowBtn.length) await notNowBtn[0].click();
        } catch (e) { }

        // 2) Aller sur le profil
        // click sur l'avatar menu (sélecteur susceptible de changer)
        await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle2', timeout });

        // 3) Ouvrir le menu (3 barres) -> Your activity -> Likes
        // NOTE: L'UI peut différer, on tente une stratégie par navigation: Profile -> Menu -> Your activity
        try {
            // ouvrir menu (icône burger)
            await page.waitForSelector('svg[aria-label="Options"]', { timeout: 4000 }).then(el => el.click()).catch(() => { });
        } catch (e) { }

        // Si l'UI ne fournit pas de menu cliquer sur les trois points / menu
        // Fallback: essayer directement la route "Your activity" si accessible
        // (on essaye d'ouvrir via URL où possible — l'UI Instagram change souvent)
        // TENTATIVE directe vers /account_activity ou /account/activity
        // Certains comptes/versions affichent "Your Activity" à /accounts/activity/
        await page.goto('https://www.instagram.com/accounts/activity/', { waitUntil: 'networkidle2', timeout }).catch(() => { });

        // 4) Si la page dédiée "Likes" existe on essaie d'extraire
        // Ici on parcourt la page pour récupérer tous les liens de posts visibles
        await page.waitForTimeout(2000);

        // Scroller pour charger plus d'items (si nécessaire)
        const scrollTimes = 6;
        for (let i = 0; i < scrollTimes; i++) {
            await page.evaluate(() => window.scrollBy(0, window.innerHeight));
            await page.waitForTimeout(700);
        }

        // 5) Extraction : récupérer URLs des posts visibles
        const posts = await page.$$eval('article a[href^="/p/"], a[href*="/reel/"], a[href*="/tv/"]', anchors =>
            anchors.map(a => a.href).filter(Boolean)
        );

        // Deduplicate
        const unique = Array.from(new Set(posts));

        await browser.close();
        return { success: true, posts: unique };
    } catch (err) {
        await browser.close();
        return { success: false, error: (err && err.message) || String(err) };
    }
}

module.exports = { scrapeLikesWithCredentials };
// JavaScript source code
