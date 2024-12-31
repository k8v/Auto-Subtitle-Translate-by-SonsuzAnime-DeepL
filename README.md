# Auto Subtitle Translate by Sonsuz Anime

This is an auto subtitle translate addon for Stremio application using DeepL Translator API.

## Addon Link

https://deeplsubtitle.sonsuzanime.com

## How the addon works?

It searches OpensubtitlesV3 addon for your language. If desired language subtitle exists, it returns a "sub exists" subfile.
If there is no subs for desired language, it looks up the database to see if that language exists. If it exists in the database, it gives you that translated subfile.

If it doesn't exist, it starts to translate 1 subfile with your API key then stores it in the server. If you are the first one to translate that subfile you will be given 2 sub choices:

1. Information sub file which contains:
   "Your subtitle is now being translated. It will take about 30 seconds.
   After about 30 seconds, if you select the subtitle, it will appear."
2. After you waited about 30 seconds, if you choose this sub it will be your translated sub.

## Features

- Download subtitles from OpenSubtitles
- Translate subtitles using DeepL API
- Support for movies and TV series
- Multiple language support
- Automatic file organization
- Integration with Stremio application

## How to get DeepL API Key?

Follow the guide at: https://deeplsubtitle.sonsuzanime.com/subtitles/how-to-get-api-key.pdf

## Usage

Configure the addon:

- Get your DeepL API Key
- Paste it in the configuration page
- Select your desired language

## Common Errors

### Apikey error

Message: "Make sure that you are subscribed to the API. And make sure that you haven't exceeded your monthly quota."

- This means that your API key is wrong or your 500,000 CHARACTER quota has been exceeded.

### No subtitles found

Message: "No subtitles were found or the original subtitles are available in the OpenSubtitlesV3 addon."

- This means that no subtitles were found in the database or no subtitles were found on OpenSubtitlesV3 addon.

## Project Structure

- `index.js` - Main application entry point
- `opensubtitles.js` - OpenSubtitles API integration
- `processfiles.js` - File processing and translation logic
- `connection.js` - Database connection and operations
- `languages.js` - Language code mappings
- `logger.js` - Logging functionality

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- OpenSubtitles API
- DeepL API
- Stremio Application
