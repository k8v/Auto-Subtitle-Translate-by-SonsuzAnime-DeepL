const {
  addonBuilder,
  serveHTTP,
  publishToCentral,
} = require("stremio-addon-sdk");
const processfiles = require("./processfiles");
const opensubtitles = require("./opensubtitles");
var express = require("express");
const connection = require("./connection");
const languages = require("./languages");
const apikey = require("./apikey");
const logger = require("./logger");

const builder = new addonBuilder({
  id: "org.autotranslate.sonsuzanime",
  version: "1.0.1",
  name: "Auto Subtitle Translate by SonsuzAnime (DeepL)",
  logo: "https://stremioaddon.sonsuzanime.com/subtitles/logo.png",
  configurable: true,
  behaviorHints: {
    configurable: true,
    configurationRequired: true,
  },
  config: [
    {
      key: "translateto",
      title: "Translate to",
      type: "select",
      required: true,
      options: languages.getAllValues(),
    },
    {
      key: "apikey",
      title: "DeepL Translate API Key",
      type: "text",
      required: true,
    },
  ],
  description:
    "This addon takes subtitles from OpenSubtitlesV3 then translates into desired language.For donations: https://www.buymeacoffee.com/sonsuzosman Bug report: infinity@sonsuzanime.com",
  types: ["series", "movie"],
  catalogs: [],
  resources: ["subtitles"],
});

builder.defineSubtitlesHandler(async function (args) {
  try {
    const { id, config } = args;
    const iso639_1 = languages.getKeyFromValue(config.translateto);
    let iso639_2 = languages.getISO639_2Code(iso639_1);
    if (iso639_2 === undefined) {
      iso639_2 = iso639_1;
    }
    let imdbid = null;
    if (id !== null && id.startsWith("tt")) {
      const parts = id.split(":");
      if (parts.length >= 1) {
        imdbid = parts[0];
      } else {
        logger.warn("Invalid ID format");
        return { subtitles: [] };
      }
    } else {
      imdbid = null;
      return { subtitles: [] };
    }

    const { type, season = null, episode = null } = parseId(id);
    const apikeyremaining = await apikey.checkapikey(config.apikey);
    logger.info(
      `Request details - API Key: ${config.apikey}, Remaining: ${apikeyremaining}, Language: ${iso639_1} (${iso639_2})`
    );

    if (!config.apikey || apikeyremaining === false) {
      logger.error(`Invalid or depleted API key: ${config.apikey}`);
      return {
        subtitles: [
          {
            id: `Apikey error`,
            url: `https://deeplsubtitle.sonsuzanime.com/subtitles/apikeyerror.srt`,
            lang: iso639_2,
          },
        ],
      };
    }

    try {
      const translatecheck = await connection.checkForTranslation(
        imdbid,
        season,
        episode,
        iso639_1
      );

      if (translatecheck === null || translatecheck === false) {
        const paths = await connection.getsubtitles(
          imdbid,
          season,
          episode,
          iso639_1
        );

        const seriesExists = await connection.checkseries(imdbid);
        if (seriesExists === null) {
          throw new Error("Database error while checking series");
        }

        if (seriesExists) {
          if (paths && paths.length > 0) {
            const subtitle = await fetchSubtitles(
              imdbid,
              season,
              episode,
              paths.length,
              type,
              iso639_2
            );
            logger.info(
              `Sending existing subtitles: ${JSON.stringify(subtitle)}`
            );
            return { subtitles: subtitle };
          }
        }

        // Handle new subtitle processing
        const subs = await opensubtitles.getsubtitles(
          type,
          imdbid,
          season,
          episode,
          iso639_2
        );

        if (subs && subs.length > 0) {
          const apiCheckResult = await processfiles.checkremainingapi(
            subs,
            imdbid,
            season,
            episode,
            iso639_1,
            config.apikey,
            apikeyremaining
          );

          if (!apiCheckResult) {
            logger.warn("API limit reached, returning error message");
            return {
              subtitles: [
                {
                  id: `Apikey error`,
                  url: `https://deeplsubtitle.sonsuzanime.com/subtitles/apikeyerror.srt`,
                  lang: iso639_2,
                },
              ],
            };
          }

          const subtitles = [
            {
              id: `Information`,
              url: `https://deeplsubtitle.sonsuzanime.com/subtitles/information.srt`,
              lang: iso639_2,
            },
          ];

          const translatedsubs = await fetchSubtitles(
            imdbid,
            season,
            episode,
            subs.length,
            type,
            iso639_2
          );

          logger.info(`Returning translated subtitles with information`);
          return { subtitles: [...subtitles, ...translatedsubs] };
        }

        logger.warn(
          `No subtitles found for ${imdbid}, returning not found message`
        );
        return {
          subtitles: [
            {
              id: `Not found`,
              url: `https://deeplsubtitle.sonsuzanime.com/subtitles/notfound.srt`,
              lang: iso639_2,
            },
          ],
        };
      }

      // Handle existing translation
      logger.info(
        `Found existing translation for ${imdbid}, preparing response`
      );
      const subtitles = [
        {
          id: `Information`,
          url: `https://deeplsubtitle.sonsuzanime.com/subtitles/information.srt`,
          lang: iso639_2,
        },
      ];

      const translatedsubs = await fetchSubtitles(
        imdbid,
        season,
        episode,
        translatecheck,
        type,
        iso639_2
      );

      return { subtitles: [...subtitles, ...translatedsubs] };
    } catch (error) {
      logger.error(`Subtitle processing error: ${error.message}`);
      return { subtitles: [] };
    }
  } catch (error) {
    logger.error(`Handler error: ${error.message}`);
    return { subtitles: [] };
  }
});

async function fetchSubtitles(
  imdbid,
  season = null,
  episode = null,
  count,
  type,
  langcode
) {
  const subtitles = [];
  let iso639_1 = languages.getISO639_1Code(langcode);
  if (iso639_1 === undefined) {
    iso639_1 = langcode;
  }
  if (type === "movie") {
    for (let i = 1; i <= count; i++) {
      const subtitle = {
        id: `${imdbid}-subtitle-${i}`,
        url: `https://deeplsubtitle.sonsuzanime.com/subtitles/${iso639_1}/${imdbid}/${imdbid}-translated-${i}.srt`,
        lang: langcode,
      };
      subtitles.push(subtitle);
    }
  } else {
    for (let i = 1; i <= count; i++) {
      const subtitle = {
        id: `${imdbid}-${season}-${episode}subtitle-${i}`,
        url: `https://deeplsubtitle.sonsuzanime.com/subtitles/${iso639_1}/${imdbid}/season${season}/${imdbid}-translated-${episode}-${i}.srt`,
        lang: langcode,
      };
      subtitles.push(subtitle);
    }
  }

  return subtitles;
}

function parseId(id) {
  if (id.startsWith("tt")) {
    const match = id.match(/tt(\d+):(\d+):(\d+)/);
    if (match) {
      const [, , season, episode] = match;
      return {
        type: "series",
        season: Number(season),
        episode: Number(episode),
      };
    } else {
      return { type: "movie" };
    }
  } else {
    return { type: "unknown", season: 0, episode: 0 };
  }
}

const port = process.env.PORT || 3000;
const address = process.env.ADDRESS || "0.0.0.0";

logger.info(`Starting server on ${address}:${port}`);
serveHTTP(builder.getInterface(), {
  cacheMaxAge: 10,
  port: port,
  address: address,
  static: "/subtitles",
});
