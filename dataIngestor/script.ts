import path from "path";
import fs from "fs";
import { Command } from "commander";
import { select } from "@inquirer/prompts";
import { fileSelector } from "inquirer-file-selector";
import chalk from "chalk";
import logger from "./logger";
import { computeDerivedData } from "./ops/computeDerivedData";
import { insertSalesInvoicesFromCSV } from "./ops/insertSalesInvoicesFromCSV";

const program = new Command();

async function main() {
  program
    .name("data-ingestor")
    .description("CLI to ingest sales data and compute derived metrics")
    .argument("[directory]", "Directory containing CSV files to ingest")
    .action(async (directory) => {
      console.log(chalk.bold.blue("Welcome to the KCI MIS Data Ingestor"));

      const processingLevel = await select({
        message: "What level of processing do you want to do?",
        choices: [
          { name: "Full", value: "Full" },
          { name: "Derived data only", value: "Derived data only" },
        ],
      });

      if (processingLevel === "Full") {
        let dirPath = directory;

        if (!dirPath) {
          const selection = await fileSelector({
            message: "Select the directory containing CSV files:",
            type: "directory",
          });
          dirPath = selection.path;
        }

        const absolutePath = path.resolve(dirPath);

        if (!fs.existsSync(absolutePath)) {
          logger.error(
            chalk.red(`The specified path does not exist: ${absolutePath}`),
          );
          process.exit(1);
        }

        if (!fs.statSync(absolutePath).isDirectory()) {
          logger.error(
            chalk.red(`The specified path is not a directory: ${absolutePath}`),
          );
          process.exit(1);
        }

        const files = fs
          .readdirSync(absolutePath)
          .filter((file) => path.extname(file).toLowerCase() === ".csv");

        if (files.length === 0) {
          logger.warn(
            chalk.yellow("No CSV files found in the specified directory."),
          );
          return;
        }

        logger.info(chalk.blue(`Found ${files.length} CSV files.`));

        for (const file of files) {
          const filePath = path.join(absolutePath, file);
          try {
            logger.info(chalk.cyan(`Uploading data from '${file}'...`));
            await insertSalesInvoicesFromCSV(filePath);
            logger.info(chalk.green(`Successfully uploaded '${file}'`));
          } catch (error) {
            logger.error(
              chalk.red(`Error uploading data from '${file}': ${error}`),
            );
            process.exit(1);
          }
        }
      }

      logger.info(chalk.blue("Computing derived data..."));
      await computeDerivedData();
      logger.info(chalk.green("Data ingestion complete."));
    });

  await program.parseAsync(process.argv);
}

main();
