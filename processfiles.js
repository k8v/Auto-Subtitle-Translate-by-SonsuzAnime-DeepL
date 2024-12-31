const opensubtitles = require("./opensubtitles");
const connection = require("./connection");
const axios = require("axios");
const fs = require("fs");
const fsPromises = require("fs").promises;
const FormData = require("form-data");
const logger = require("./logger");

async function savetranslatedsubs(
  count,
  imdbid,
  season = null,
  episode = null,
  iso639_1,
  documentId,
  documentKey,
  apikey
) {
  let newSubtitleFilePath = null;
  let type = null;
  if (season && episode) {
    newSubtitleFilePath = `subtitles/${iso639_1}/${imdbid}/season${season}/${imdbid}-translated-${episode}-${count}.srt`;
    type = "series";
  } else {
    newSubtitleFilePath = `subtitles/${iso639_1}/${imdbid}/${imdbid}-translated-${count}.srt`;
    type = "movie";
  }

  try {
    const response = await axios.post(
      `https://api-free.deepl.com/v2/document/${documentId}/result`,
      {
        document_key: documentKey,
      },
      {
        headers: {
          Authorization: `DeepL-Auth-Key ${apikey}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      }
    );
    try {
      await fsPromises.writeFile(newSubtitleFilePath, response.data);
      logger.info(`Translation saved to: ${newSubtitleFilePath}`);

      if (!(await connection.checkseries(imdbid))) {
        await connection.addseries(imdbid, type);
      }

      if (
        !(await connection.checksubtitle(
          imdbid,
          season,
          episode,
          newSubtitleFilePath,
          iso639_1
        ))
      ) {
        await connection.addsubtitle(
          imdbid,
          type,
          season,
          episode,
          newSubtitleFilePath,
          iso639_1
        );
      }

      logger.info(`Subtitle processing completed: ${newSubtitleFilePath}`);
    } catch (error) {
      logger.error(`Error writing translated subtitle: ${error.message}`);
    }
  } catch (error) {
    if (error.response) {
      const errorMessage =
        error.response.data instanceof Buffer
          ? Buffer.from(error.response.data).toString()
          : error.response.data;
      logger.error(`DeepL API error response: ${errorMessage}`);
      logger.error(`Status code: ${error.response.status}`);
    } else if (error.request) {
      logger.error(`No response received from DeepL API: ${error.request}`);
    } else {
      logger.error(`Error in translation request: ${error.message}`);
    }
    logger.error(`Full error details: ${JSON.stringify(error)}`);
  }
}

async function checkremainingapi(
  subtitles,
  imdbid,
  season = null,
  episode = null,
  iso639_1,
  apikey,
  apikeyremaining
) {
  let filepaths = await opensubtitles.downloadSubtitles(
    subtitles,
    imdbid,
    season,
    episode,
    iso639_1
  );
  logger.debug(`Processing subtitle files: ${JSON.stringify(filepaths)}`);

  let totalCharacterCount = 0;
  for (let index = 0; index < filepaths.length; index++) {
    const originalSubtitleFilePath = filepaths[index];
    try {
      const originalSubtitleContent = await fsPromises.readFile(
        originalSubtitleFilePath,
        { encoding: "utf-8" }
      );
      const lines = originalSubtitleContent.split("\n");
      let iscount = true;
      let istimecode = false;
      let istext = false;
      let characters = [];
      let textcount = 0;
      let count = 0;

      for (let line of lines) {
        count++;
        if (line.trim() === "") {
          iscount = true;
          istimecode = false;
          istext = false;
          textcount = 0;
        } else if (iscount === true) {
          iscount = false;
          istimecode = true;
        } else if (istimecode === true) {
          istimecode = false;
          istext = true;
        } else if (istext === true) {
          if (textcount === 0) {
            characters.push(line);
          } else {
            characters[characters.length - 1] += " \n" + line;
          }
          textcount++;
        }
      }

      characters.forEach((character) => {
        totalCharacterCount += character.length;
      });
    } catch (error) {
      logger.error(
        `Error processing subtitle file ${originalSubtitleFilePath}: ${error.message}`
      );
    }
  }

  logger.info(`Total character count for translation: ${totalCharacterCount}`);

  if (apikeyremaining > totalCharacterCount) {
    logger.info(
      `Sufficient API characters remaining. Proceeding with translation.`
    );
    main(imdbid, season, episode, iso639_1, apikey, filepaths);
    return true;
  } else {
    logger.warn(
      `Insufficient API characters remaining. Required: ${totalCharacterCount}, Available: ${apikeyremaining}`
    );
    return false;
  }
}

async function checkFileLimits(filePath) {
  const MAX_FILE_SIZE_KB = 150;
  const MAX_CHARACTERS = 1000000;

  try {
    const stats = await fsPromises.stat(filePath);
    const fileSizeKB = stats.size / 1024;

    if (fileSizeKB > MAX_FILE_SIZE_KB) {
      logger.error(
        `File size (${fileSizeKB.toFixed(
          2
        )} KB) exceeds the limit of ${MAX_FILE_SIZE_KB} KB`
      );
      throw new Error(
        `File size (${fileSizeKB.toFixed(
          2
        )} KB) exceeds the limit of ${MAX_FILE_SIZE_KB} KB`
      );
    }

    const content = await fsPromises.readFile(filePath, "utf-8");
    const characterCount = content.length;

    if (characterCount > MAX_CHARACTERS) {
      logger.error(
        `Character count (${characterCount}) exceeds the limit of ${MAX_CHARACTERS}`
      );
      throw new Error(
        `Character count (${characterCount}) exceeds the limit of ${MAX_CHARACTERS}`
      );
    }

    logger.info(
      `File check passed: Size=${fileSizeKB.toFixed(
        2
      )}KB, Characters=${characterCount}`
    );
    return true;
  } catch (error) {
    logger.error(`File check failed for ${filePath}: ${error.message}`);
    throw error;
  }
}

async function checkStatus(documentId, documentKey, apikey) {
  try {
    logger.debug(`Checking translation status for document: ${documentId}`);
    const response = await axios.post(
      `https://api-free.deepl.com/v2/document/${documentId}`,
      {
        document_key: documentKey,
      },
      {
        headers: {
          Authorization: `DeepL-Auth-Key ${apikey}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      logger.error(`DeepL API error response: ${error.response.data}`);
      logger.error(`Status code: ${error.response.status}`);
    } else if (error.request) {
      logger.error(`No response received from DeepL API: ${error.request}`);
    } else {
      logger.error(`Error in status check request: ${error.message}`);
    }
    throw error;
  }
}

async function waitForTranslation(documentId, documentKey, apikey) {
  while (true) {
    const status = await checkStatus(documentId, documentKey, apikey);
    logger.debug(`Translation status for ${documentId}: ${status.status}`);

    if (status.status === "done") {
      logger.info(`Translation completed for document ${documentId}`);
      return status;
    } else if (status.status === "error") {
      logger.error(
        `Translation failed for document ${documentId}: ${status.message}`
      );
      throw new Error(`Translation failed: ${status.message}`);
    }

    // Wait 5 seconds before checking again
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

async function translateDocument(
  filepath,
  target_lang,
  apikey,
  imdbid,
  season = null,
  episode = null,
  iso639_1
) {
  try {
    // Check file limits before starting translation
    logger.info("Checking file limits...");
    await checkFileLimits(filepath);
    logger.info("File limits OK, proceeding with translation...");

    const formData = new FormData();
    formData.append("file", fs.createReadStream(filepath));
    formData.append("target_lang", target_lang);

    logger.info("Starting document upload...");
    // Step 1: Upload document
    const uploadResponse = await axios.post(
      "https://api-free.deepl.com/v2/document",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `DeepL-Auth-Key ${apikey}`,
        },
      }
    );

    if (!uploadResponse.data.document_id || !uploadResponse.data.document_key) {
      throw new Error(
        "Invalid response from document upload: " +
          JSON.stringify(uploadResponse.data)
      );
    }

    logger.info("Document uploaded successfully:", uploadResponse.data);

    // Step 2: Wait for translation to complete
    const statusResult = await waitForTranslation(
      uploadResponse.data.document_id,
      uploadResponse.data.document_key,
      apikey
    );
    logger.info("Translation completed:", statusResult);

    // Step 3: Download the translated document
    const downloadedFile = await savetranslatedsubs(
      1,
      imdbid,
      season,
      episode,
      iso639_1,
      uploadResponse.data.document_id,
      uploadResponse.data.document_key,
      apikey
    );
    logger.info("Translation downloaded successfully!");

    return downloadedFile;
  } catch (error) {
    if (error.response) {
      logger.error("Error response:", error.response.data);
      logger.error("Status code:", error.response.status);
    } else if (error.request) {
      logger.error("No response received:", error.request);
    } else {
      logger.error("Error:", error.message);
    }
    throw error;
  }
}

async function processsubtitles(
  filepath,
  imdbid,
  season = null,
  episode = null,
  iso639_1,
  apikey
) {
  const totalsubcount = await connection.getSubCount(
    imdbid,
    season,
    episode,
    iso639_1
  );
  for (let index = 0; index < filepath.length; index++) {
    const originalSubtitleFilePath = filepath[index];
    try {
      await translateDocument(
        originalSubtitleFilePath,
        iso639_1,
        apikey,
        imdbid,
        season,
        episode,
        iso639_1
      );
    } catch (error) {
      logger.error("Subtitle translate error: ", error);
    }
  }
}

async function main(
  imdbid,
  season = null,
  episode = null,
  iso639_1,
  apikey,
  filepaths
) {
  try {
    if (filepaths) {
      await connection.addToTranslationQueue(
        imdbid,
        season,
        episode,
        filepaths.length,
        iso639_1
      );

      try {
        await processsubtitles(
          filepaths,
          imdbid,
          season,
          episode,
          iso639_1,
          apikey
        );
      } catch (error) {
        await connection.deletetranslationQueue(
          imdbid,
          season,
          episode,
          iso639_1
        );
        logger.error("Error on processing subtitles:", error.message);
      }

      await connection.deletetranslationQueue(
        imdbid,
        season,
        episode,
        iso639_1
      );
    } else {
      logger.info("No subtitles found");
    }
  } catch (error) {
    logger.error("Error on processing subtitles:", error.message);
  }
}

module.exports = {
  savetranslatedsubs,
  checkremainingapi,
  checkFileLimits,
  checkStatus,
  waitForTranslation,
};
