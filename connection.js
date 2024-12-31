var mysql = require("mysql");
const util = require("util");
const logger = require("./logger");
require("dotenv").config();

var con = mysql.createConnection({
  host: process.env.DATABASEHOST,
  user: process.env.DATABASEUSER,
  password: process.env.DATABASEPASSWORD,
  database: process.env.DATABASE,
});

try {
  con.connect(function (err) {
    if (err) throw err;
    logger.info("Database connected successfully");
  });
} catch (error) {
  logger.error(`Database connection failed: ${error.message}`);
}

setInterval(function () {
  if (con.state == false) {
    con.connect(function (err) {
      if (err) throw err;
      logger.info("Database reconnected successfully");
    });
  }
}, 60000);

const query = util.promisify(con.query).bind(con);

async function addToTranslationQueue(
  imdbid,
  season = null,
  episode = null,
  count,
  langcode
) {
  try {
    if (season && episode) {
      await query(
        `INSERT INTO translation_queue (series_imdbid,series_seasonno,series_episodeno,subcount,langcode) VALUES (?,?,?,?,?)`,
        [imdbid, season, episode, count, langcode]
      );
      logger.info(
        `Added to translation queue: IMDB=${imdbid}, Season=${season}, Episode=${episode}, Lang=${langcode}`
      );
    } else {
      await query(
        `INSERT INTO translation_queue (series_imdbid,subcount,langcode) VALUES (?,?,?)`,
        [imdbid, count, langcode]
      );
      logger.info(
        `Added to translation queue: IMDB=${imdbid}, Lang=${langcode}`
      );
    }
  } catch (error) {
    logger.error(`Add to translation queue error: ${error.message}`);
  }
}

async function deletetranslationQueue(
  imdbid,
  season = null,
  episode = null,
  langcode
) {
  try {
    if (season && episode) {
      await query(
        `DELETE FROM translation_queue WHERE series_imdbid = ? AND series_seasonno = ? AND series_episodeno = ? AND langcode = ?`,
        [imdbid, season, episode, langcode]
      );
      logger.info(
        `Deleted from translation queue: IMDB=${imdbid}, Season=${season}, Episode=${episode}, Lang=${langcode}`
      );
    } else {
      await query(
        `DELETE FROM translation_queue WHERE series_imdbid = ? AND langcode = ?`,
        [imdbid, langcode]
      );
      logger.info(
        `Deleted from translation queue: IMDB=${imdbid}, Lang=${langcode}`
      );
    }
  } catch (error) {
    logger.error(`Delete translation queue error: ${error.message}`);
  }
}

async function checkForTranslation(
  imdbid,
  season = null,
  episode = null,
  langcode
) {
  try {
    const result = await query(
      "SELECT COUNT(*) AS count,subcount FROM translation_queue WHERE series_imdbid =? AND series_seasonno = ? AND series_episodeno = ? AND langcode = ?",
      [imdbid, season, episode, langcode]
    );
    const count = result[0].count;
    const subcount = result[0].subcount;

    logger.debug(
      `Translation check: IMDB=${imdbid}, Season=${season}, Episode=${episode}, Lang=${langcode}, Found=${
        count > 0
      }`
    );

    if (count > 0) {
      return subcount;
    } else {
      return false;
    }
  } catch (error) {
    logger.error(`Check for translation error: ${error.message}`);
    return null;
  }
}

async function checkseries(imdbid) {
  try {
    const result = await query(
      "SELECT COUNT(*) AS count FROM series WHERE series_imdbid = ?",
      [imdbid]
    );
    const count = result[0].count;

    logger.debug(`Series check for IMDB=${imdbid}: Found=${count > 0}`);
    if (count > 0) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    logger.error(`Checkseries error for ${imdbid}: ${error.message}`);
    return null;
  }
}

async function addseries(imdbid, type) {
  try {
    let seriestype;
    if (type === "series") {
      seriestype = 0;
    } else {
      seriestype = 1;
    }
    await query("INSERT INTO series(series_imdbid,series_type) VALUES (?,?)", [
      imdbid,
      seriestype,
    ]);
    logger.info(`Added new series: IMDB=${imdbid}, Type=${type}`);
  } catch (error) {
    logger.error(`Add series error for ${imdbid}: ${error.message}`);
  }
}

//CHECK SUBS
async function getSubCount(imdbid, season, episode, langcode) {
  try {
    let count;
    if (season && episode) {
      count = await query(
        `SELECT COUNT(*) AS count FROM subtitle WHERE series_imdbid = ? AND subtitle_seasonno = ? AND subtitle_episodeno = ? AND subtitle_langcode = ?`,
        [imdbid, season, episode, langcode]
      );
    } else {
      count = await query(
        `SELECT COUNT(*) AS count FROM subtitle WHERE series_imdbid = ? AND subtitle_langcode = ?`,
        [imdbid, langcode]
      );
    }
    logger.debug(
      `Subtitle count for IMDB=${imdbid}, Season=${season}, Episode=${episode}, Lang=${langcode}: Count=${count[0].count}`
    );
    return count[0].count;
  } catch (error) {
    logger.error(`Get sub count error for ${imdbid}: ${error.message}`);
    return null;
  }
}

async function addsubtitle(
  imdbid,
  type,
  season = null,
  episode = null,
  path,
  langcode
) {
  try {
    let seriestype;
    if (type === "series") {
      seriestype = 0;
    } else {
      seriestype = 1;
    }
    await query(
      "INSERT INTO subtitle(series_imdbid,subtitle_type,subtitle_seasonno,subtitle_episodeno,subtitle_langcode,subtitle_path) VALUES (?,?,?,?,?,?)",
      [imdbid, seriestype, season, episode, langcode, path]
    );
    logger.info(
      `Added new subtitle: IMDB=${imdbid}, Type=${type}, Season=${season}, Episode=${episode}, Lang=${langcode}, Path=${path}`
    );
  } catch (error) {
    logger.error(`Add subtitle error for ${imdbid}: ${error.message}`);
  }
}

async function getsubtitles(imdbid, season = null, episode = null, langcode) {
  try {
    let rows;
    if (episode && season) {
      rows = await query(
        `SELECT subtitle_path FROM subtitle WHERE series_imdbid = ? AND subtitle_seasonno = ? AND subtitle_episodeno = ? AND subtitle_langcode = ?`,
        [imdbid, season, episode, langcode]
      );
    } else {
      rows = await query(
        `SELECT subtitle_path FROM subtitle WHERE series_imdbid = ? AND subtitle_langcode = ?`,
        [imdbid, langcode]
      );
    }
    const paths = rows.map((row) => row.subtitle_path);
    logger.debug(
      `Retrieved subtitles for IMDB=${imdbid}, Season=${season}, Episode=${episode}, Lang=${langcode}: Count=${paths.length}`
    );
    return paths;
  } catch (error) {
    logger.error(`Get subtitles error for ${imdbid}: ${error.message}`);
    return null;
  }
}

async function checksubtitle(
  imdbid,
  season = null,
  episode = null,
  subtitlepath,
  langcode
) {
  try {
    const result = await query(
      "SELECT COUNT(*) AS count FROM subtitle WHERE series_imdbid = ? AND subtitle_seasonno = ? AND subtitle_episodeno = ? AND subtitle_path = ? AND subtitle_langcode = ?",
      [imdbid, season, episode, subtitlepath, langcode]
    );
    const count = result[0].count;
    logger.debug(
      `Subtitle check for IMDB=${imdbid}, Season=${season}, Episode=${episode}, Lang=${langcode}, Path=${subtitlepath}: Found=${
        count > 0
      }`
    );

    if (count > 0) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    logger.error(`Check subtitle error for ${imdbid}: ${error.message}`);
    return false;
  }
}

module.exports = {
  addToTranslationQueue,
  deletetranslationQueue,
  getSubCount,
  checkseries,
  addseries,
  addsubtitle,
  getsubtitles,
  checkForTranslation,
  checksubtitle,
};
