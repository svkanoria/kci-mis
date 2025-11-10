import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.Console({
      format: winston.format.cli(),
    }),
    new winston.transports.File({
      filename: "./.logs/dataIngestor.log",
      level: "warn",
      format: winston.format.simple(),
      options: { flags: "w" },
    }),
  ],
});

export default logger;
