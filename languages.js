let data = {
  tr: "Türkçe",
  ar: "العربية",
  bg: "Български",
  zh: "中文",
  "zh-Hant": "繁體中文",
  "zh-Hans": "简体中文",
  cs: "Čeština",
  da: "Dansk",
  nl: "Nederlands",
  en: "English",
  "en-GB": "English (British)",
  "en-US": "English (American)",
  et: "Eesti",
  fi: "Suomi",
  fr: "Français",
  de: "Deutsch",
  el: "Ελληνικά",
  hu: "Magyar",
  id: "Indonesia",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  lv: "Latviešu",
  lt: "Lietuvių",
  nb: "Norsk (Bokmål)",
  pl: "Polski",
  pt: "Português",
  "pt-BR": "Português (Brasil)",
  ro: "Română",
  ru: "Русский",
  sk: "Slovenčina",
  sl: "Slovenščina",
  es: "Español",
  sv: "Svenska",
  uk: "Українська",
};

let iso639_2 = {
  ar: "ara",
  bg: "bul",
  zh: "chi",
  cs: "cze",
  da: "dan",
  nl: "dut",
  en: "eng",
  et: "est",
  fi: "fin",
  fr: "fre",
  de: "ger",
  el: "gre",
  hu: "hun",
  id: "ind",
  it: "ita",
  ja: "jpn",
  ko: "kor",
  lv: "lav",
  lt: "lit",
  nb: "nob",
  pl: "pol",
  pt: "por",
  ro: "rum",
  ru: "rus",
  sk: "slo",
  sl: "slv",
  es: "spa",
  sv: "swe",
  tr: "tur",
  uk: "ukr",
};

function getValueFromKey(key) {
  return data[key];
}

function getKeyFromValue(value) {
  for (let key in data) {
    if (data[key] === value) {
      return key;
    }
  }
}

function getAllValues() {
  return Object.values(data);
}

function getISO639_2Code(value) {
  for (let key in iso639_2) {
    if (value === key) {
      return iso639_2[key];
    }
  }
}

function getISO639_1Code(value) {
  for (let key in iso639_2) {
    if (iso639_2[key] === value) {
      return key;
    }
  }
}

module.exports = {
  getAllValues,
  getKeyFromValue,
  getValueFromKey,
  getISO639_2Code,
  getISO639_1Code,
};
