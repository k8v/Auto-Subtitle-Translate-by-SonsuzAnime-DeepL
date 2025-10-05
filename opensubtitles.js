const request = require('request-promise-native');

// L'URL de l'API OpenSubtitles V3 utilisée par cet add-on
const OPENSUBTITLES_URL = 'https://opensubtitles-v3.strem.io';

/**
 * Récupère les sous-titres d'OpenSubtitles V3 pour une vidéo donnée.
 * * @param {object} info - Contient les détails de la vidéo { id, type, extra }
 * @param {Array<string>} supportedLangs - Liste des codes de langue sources à rechercher (ex: ['eng', 'fra', 'deu'])
 * @returns {Promise<Array<object>>} - Tableau de sous-titres au format Stremio
 */
exports.getSubs = async (info, supportedLangs) => {
    // id est généralement au format 'ttXXXXXX' ou 'ttXXXXXX:s01e01'
    const { id, type } = info;

    if (!id || !type) {
        return [];
    }

    try {
        const subRequestUrl = `${OPENSUBTITLES_URL}/subtitles/${type}/${id}.json`;

        const response = await request({
            uri: subRequestUrl,
            json: true
        });

        if (!response || !Array.isArray(response.subtitles)) {
            return [];
        }

        // 1. Filtrer les sous-titres par la liste des langues sources que nous supportons.
        // On utilise .toLowerCase() car les langues dans la liste supportée sont en minuscules.
        const subtitles = response.subtitles
            .filter(sub => supportedLangs.includes(sub.lang.toLowerCase()))
            .map(sub => ({
                ...sub,
                // 2. Ajout de l'étiquette [OpenSubs] pour identifier la source
                label: `[OpenSubs] ${sub.label}`,
                source: 'OpenSubtitles'
            }));

        return subtitles;

    } catch (e) {
        console.error(`Erreur OpenSubtitles V3 pour ${id}:`, e.message);
        return [];
    }
};
