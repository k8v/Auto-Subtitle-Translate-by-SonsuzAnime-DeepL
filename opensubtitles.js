const axios = require("axios");
const connection = require("./connection");
const fs = require("fs").promises;
const logger = require("./logger");

const opensubtitlesbaseurl = "https://opensubtitles-v3.strem.io/subtitles/";

const downloadSubtitles = async (
  subtitles,
  imdbid,
  season = null,
  episode = null,
  iso639_1
) => {
  let uniqueTempFolder = null;
  if (season && episode) {
    await fs.mkdir(`subtitles/${iso639_1}/${imdbid}/season${season}`, {
      recursive: true,
    });
    uniqueTempFolder = `subtitles/${iso639_1}/${imdbid}/season${season}`;
  } else {
    await fs.mkdir(`subtitles/${iso639_1}/${imdbid}`, { recursive: true });
    uniqueTempFolder = `subtitles/${iso639_1}/${imdbid}`;
  }

  let filepaths = [];

  for (let i = 0; i < subtitles.length; i++) {
    const url = subtitles[i];
    try {
      const response = await axios.get(url, { responseType: "arraybuffer" });
      let filePath = null;
      if (episode) {
        filePath = `${uniqueTempFolder}/${imdbid}-subtitle_${episode}-${
          i + 1
        }.srt`;
      } else {
        filePath = `${uniqueTempFolder}/${imdbid}-subtitle-${i + 1}.srt`;
      }
      logger.debug(`Processing subtitle file: ${filePath}`);
      await fs.writeFile(filePath, response.data);
      logger.info(`Subtitle downloaded and saved: ${filePath}`);
      filepaths.push(filePath);
    } catch (error) {
      logger.error(`Subtitle download error for ${url}: ${error.message}`);
    }
  }
  return filepaths;
};

const getsubtitles = async (
  type,
  imdbid,
  season = null,
  episode = null,
  iso639_2
) => {
  let url = opensubtitlesbaseurl;

  if (type === "series") {
    url = url.concat(type, "/", imdbid, ":", season, ":", episode, ".json");
  } else {
    url = url.concat(type, "/", imdbid, ".json");
  }

  logger.debug(`Fetching subtitles from URL: ${url}`);

  try {
    const response = await axios.get(url);
    if (response.data.subtitles.length > 0) {
      if (
        response.data.subtitles.filter((subtitle) => subtitle.lang === iso639_2)
          .length > 0
      ) {
        logger.info(
          `Subtitles already exist for ${imdbid} in language ${iso639_2}`
        );
        return null;
      } else {
        let subtitles = response.data.subtitles
          .filter((subtitle) => subtitle.lang === "eng")
          .map((subtitle) => subtitle.url);
        if (subtitles.length === 0) {
          logger.info(
            `No English subtitles found, using first available subtitle`
          );
          subtitles = [response.data.subtitles[0].url];
        }
        logger.info(`Found ${subtitles.length} subtitle(s) for ${imdbid}`);
        return subtitles.slice(0, 1);
      }
    } else {
      logger.warn(`No subtitles found for ${imdbid}`);
      return null;
    }
  } catch (error) {
    logger.error(`Failed to fetch subtitles for ${imdbid}: ${error.message}`);
    return null;
  }
};

module.exports = { getsubtitles, downloadSubtitles };
