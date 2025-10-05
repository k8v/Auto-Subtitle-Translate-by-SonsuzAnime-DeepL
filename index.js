const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const opensubtitles = require('./opensubtitles');
const request = require('request-promise-native'); // Utilisé pour les requêtes aux add-ons externes et l'API DeepL

// Codes de langue (ISO 639-2/639-1) que nous allons rechercher dans TOUTES les sources.
// Ces langues seront utilisées comme 'source' pour la traduction DeepL.
// Nous incluons les codes à 3 lettres (ISO 639-2) et à 2 lettres (ISO 639-1)
const SUPPORTED_SOURCE_LANGS = [
    'eng', 'en', // Anglais
    'fra', 'fr', // Français
    'deu', 'de', // Allemand
    'spa', 'es', // Espagnol
    'chi', 'zho', 'zh', // Chinois
    'kor', 'ko', // Coréen
    'jpn', 'ja'  // Japonais
];

// --------------------------------------------------------------------------------
// Fonction de Traduction DeepL (Intégrée)
// --------------------------------------------------------------------------------

/**
 * Fonction pour traduire le contenu d'un sous-titre via DeepL.
 */
async function translate(subtitle, targetLang, deeplAuthKey) {
    if (!deeplAuthKey || !targetLang) {
        throw new Error("Clé DeepL ou langue cible manquante.");
    }
    
    // 1. Récupérer le contenu du sous-titre source
    const subContent = await request.get(subtitle.url);

    // 2. Préparer les données pour l'API DeepL
    const deeplEndpoint = deeplAuthKey.endsWith(':fx') 
        ? 'https://api-free.deepl.com/v2/translate' // Free API
        : 'https://api.deepl.com/v2/translate';    // Pro API

    const formData = {
        auth_key: deeplAuthKey,
        text: subContent,
        source_lang: subtitle.lang.toUpperCase(),
        target_lang: targetLang.toUpperCase(),
        tag_handling: 'xml' // Pour protéger les balises SRT/VTT
    };

    try {
        // 3. Appeler l'API DeepL
        const response = await request.post({
            uri: deeplEndpoint,
            form: formData,
            json: true
        });

        if (response.translations && response.translations.length > 0) {
            const translatedText = response.translations[0].text;
            
            // 4. Créer le sous-titre traduit (encodage Base64)
            const translatedSubtitle = {
                url: `data:application/x-subrip;base64,${Buffer.from(translatedText).toString('base64')}`,
                lang: targetLang.toLowerCase(),
                label: `Traduit par DeepL (${subtitle.lang.toUpperCase()} > ${targetLang.toUpperCase()})`
            };
            
            return [translatedSubtitle];
        }

        throw new Error("Réponse DeepL invalide ou traduction manquante.");

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API DeepL:", error.message);
        throw new Error(`Erreur DeepL : ${error.message}`);
    }
}


// --------------------------------------------------------------------------------
// Nouvelle fonction pour interroger les add-ons externes configurés
// --------------------------------------------------------------------------------

/**
 * Interroge les add-ons de sous-titres externes pour obtenir des sous-titres.
 * ... (Le reste de la fonction searchExternalAddons est inchangé)
 */
async function searchExternalAddons(type, id, externalAddonUrls) {
    let allExternalSubs = [];
    const [imdbId] = id.split(':');

    for (const manifestUrl of externalAddonUrls) {
        try {
            // 1. Déduire l'URL de base de l'add-on externe
            const baseUrl = manifestUrl.replace('/manifest.json', '').replace('/configure', '');

            // 2. Construire l'URL de la requête de sous-titres
            // Exemple: https://subhero.onrender.com/subtitles/movie/tt1234567.json
            const subRequestUrl = `${baseUrl}/subtitles/${type}/${id}.json`;

            console.log(`Interrogation de la source externe: ${subRequestUrl}`);

            // 3. Effectuer la requête HTTP
            const response = await request({
                uri: subRequestUrl,
                json: true,
                timeout: 5000 
            });

            if (response && Array.isArray(response.subtitles)) {
                // 4. Mappage et filtrage des résultats
                const sourceName = baseUrl.includes('subhero') ? 'SubHero' : 
                                   baseUrl.includes('gestdown') ? 'Gestdown' : 
                                   new URL(baseUrl).hostname.split('.').slice(-2, -1)[0] || 'Externe'; // Essayer d'obtenir le nom de domaine

                const mappedSubs = response.subtitles
                    .filter(sub => SUPPORTED_SOURCE_LANGS.includes(sub.lang.toLowerCase())) // On ne garde que les langues sources que l'on supporte pour la traduction
                    .map(sub => ({
                        ...sub,
                        label: `[${sourceName}] ${sub.label || sub.lang.toUpperCase()}`,
                        source: sourceName
                    }));

                allExternalSubs = allExternalSubs.concat(mappedSubs);
            }

        } catch (error) {
            console.error(`Erreur lors de l'interrogation de l'add-on ${manifestUrl}:`, error.message);
            // Continuer avec l'add-on suivant même en cas d'erreur
        }
    }

    return allExternalSubs;
}

// --------------------------------------------------------------------------------
// Définition du Manifeste
// --------------------------------------------------------------------------------

const manifest = {
    id: 'org.stremio.auto-subtitle-translate-by-sonsuzanime-deepl-modified',
    version: '1.0.0',
    name: 'Auto-Subtitle DeepL (Multi-Source/Langue)',
    description: 'Traduit automatiquement les sous-titres sources trouvés (EN, FR, DE, ES, ZH, KO, JP, etc.) vers votre langue cible via DeepL. Supporte les sources OpenSubtitles et externes configurables.',
    resources: ['subtitles'],
    types: ['movie', 'series'],
    catalogs: [],
    idPrefixes: ['tt'],
    endpoint: '/manifest.json',
    // La page de configuration est désormais nécessaire pour toutes les options
    config: [
        { id: 'deeplAuthKey', name: 'Clé DeepL', type: 'text', required: true, default: '' },
        { id: 'targetLanguage', name: 'Langue Cible (DeepL)', type: 'select', options: ['FR', 'EN', 'ES', 'DE', 'IT', 'PT'], required: true, default: 'FR' },
        { id: 'externalAddons', name: 'URLs Manifestes Externes', type: 'text', required: false, default: '', options: { textarea: true } }
    ]
};

const builder = new addonBuilder(manifest);

// --------------------------------------------------------------------------------
// Définition du Subtitles Handler (Le cœur de l'add-on)
// --------------------------------------------------------------------------------

builder.defineSubtitlesHandler(async ({ id, type, extra }) => {
    let config = {};
    if (extra.config) {
        try {
            config = JSON.parse(extra.config);
        } catch (e) {
            console.error("Erreur de parsing de la configuration:", e);
        }
    }
    
    // Récupération des paramètres de configuration
    const DEEPL_AUTH_KEY = config.deeplAuthKey;
    const TARGET_LANG = config.targetLanguage;
    // La liste des URLs d'add-ons externe (séparées par des sauts de ligne si elles viennent du textarea)
    const EXTERNAL_ADDON_URLS = (config.externalAddons || '')
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (!DEEPL_AUTH_KEY || !TARGET_LANG) {
        return Promise.resolve({ subtitles: [{
            url: '#', lang: 'zxx', label: 'Veuillez configurer l\'add-on sur la page web. Clé DeepL ou Langue Cible manquante.'
        }]});
    }

    // 1. Récupérer les sous-titres de la source intégrée (opensubtitles.js)
    let opensubtitlesSubs = [];
    try {
        // Passe l'objet info et la liste des langues sources
        opensubtitlesSubs = await opensubtitles.getSubs({ id, type, extra }, SUPPORTED_SOURCE_LANGS);
    } catch (e) {
        console.error("Erreur opensubtitles.js:", e.message);
    }
    
    // 2. Récupérer les sous-titres des sources externes
    let externalSubs = [];
    if (EXTERNAL_ADDON_URLS.length > 0) {
        externalSubs = await searchExternalAddons(type, id, EXTERNAL_ADDON_URLS);
    }

    // 3. Fusionner TOUS les sous-titres sources trouvés
    const allSourceSubs = [
        ...opensubtitlesSubs, 
        ...externalSubs
    ];
    
    if (allSourceSubs.length === 0) {
        return Promise.resolve({ subtitles: [{ url: '#', lang: 'zxx', label: 'Aucun sous-titre source trouvé dans les langues prises en charge.' }] });
    }

    // 4. Choix du MEILLEUR sous-titre source (le premier de la liste combinée)
    const bestSourceSub = allSourceSubs[0];
    
    // 5. Procéder à la traduction
    console.log(`Traduction du sous-titre source: ${bestSourceSub.lang} (${bestSourceSub.label}) vers ${TARGET_LANG}`);
    
    // Appeler la fonction de traduction
    let translatedSubtitles;
    try {
        // *** APPEL DE LA FONCTION INTÉGRÉE ***
        translatedSubtitles = await translate(bestSourceSub, TARGET_LANG, DEEPL_AUTH_KEY);
    } catch (e) {
        console.error("Erreur de traduction DeepL:", e.message);
        return Promise.resolve({ subtitles: [{
            url: '#', lang: 'zxx', label: `Erreur de traduction DeepL: ${e.message}`
        }]});
    }

    // 6. Retourner les sous-titres : Traduit, et l'original comme option
    return Promise.resolve({
        subtitles: [
            ...translatedSubtitles, // Le sous-titre traduit
            // Inclure l'original comme 'fallback'
            {
                url: bestSourceSub.url,
                lang: bestSourceSub.lang,
                label: `[Original Source] ${bestSourceSub.label}`
            }
        ]
    });
});

// Lancer le serveur (si l'add-on est exécuté en tant que module principal)
if (require.main === module) {
    // CORRECTION : getManifest()
    serveHTTP(builder.getManifest(), { port: process.env.PORT || 7000 });
}

module.exports = builder.getManifest();
