const winston = require("winston");
const path = require("path");

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Create the logger
const logger = winston.createLogger({
  levels: logLevels,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] ${level}: ${message}`;
        })
      ),
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join("logs", "all.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Separate file for error logs
    new winston.transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Create logs directory if it doesn't exist
const fs = require("fs");
if (!fs.existsSync("logs")) {
  fs.mkdirSync("logs");
}

module.exports = logger;
