import winston from "winston";
import chalk from "chalk";

const logger = winston.createLogger({
  level: "debug",
  transports: [
    new winston.transports.Console({
      format: winston.format.cli(),
    }),
    new winston.transports.File({
      filename: "./.logs/dataIngestor.log",
      level: "info",
      format: winston.format.combine(
        winston.format.uncolorize(),
        winston.format.simple(),
      ),
      options: { flags: "w" },
    }),
  ],
});

const error = chalk.bold.red;
const info = chalk.blue;
const success = chalk.green;
const warn = chalk.yellow;

/**
 * Log styling is not applied automatically based on log level.
 * It must be applied manually. This is a deliberate design call.
 *
 * Example:
 *
 *     logger.warn(logStyles.warn("Warning message"));
 */
export const logStyles = {
  error,
  info,
  success,
  warn,
};

export default logger;
