import path from "path";
import fs from "fs";
import { Command } from "commander";
import { select, confirm } from "@inquirer/prompts";
import { fileSelector } from "inquirer-file-selector";
import chalk from "chalk";
import logger, { logStyles } from "./logger";
import { computeDerivedData } from "./ops/computeDerivedData";
import { insertSalesInvoicesFromCSV } from "./ops/insertSalesInvoicesFromCSV";
import { insertICISMethanolPricesFromCSV } from "./ops/insertICISMethanolPricesFromCSV";
import { computeRoutes } from "./ops/computeRoutes";
import { deleteAllSalesData } from "./ops/deleteAllSalesData";
import { populateDestinationCoords } from "./ops/populateDestinationCoords";
import { populateRouteDistances } from "./ops/populateRouteDistances";

const program = new Command();

async function main() {
  program
    .name("data-ingestor")
    .description("CLI to ingest sales/RM data and compute derived metrics")
    .argument("[directory]", "Directory containing CSV files to ingest")
    .action(async (directory) => {
      console.log(chalk.bold.blue("Welcome to the KCI MIS Data Ingestor"));

      const processingType = await select({
        message: "What type of processing do you want to do?",
        choices: [
          { name: "Full sales data", value: "Full sales" },
          { name: "Derived sales data", value: "Derived sales" },
          { name: "Methanol price data", value: "Methanol price" },
          { name: "Delete all sales data", value: "Delete sales" },
          { name: "Destination coordinates", value: "Dest coords" },
          { name: "Route distances", value: "Route distances" },
        ],
      });

      if (processingType === "Delete sales") {
        const isConfirmed = await confirm({
          message:
            "Are you sure you want to delete all sales data?" +
            " This action cannot be undone.",
          default: false,
        });

        if (isConfirmed) {
          await deleteAllSalesData();
        } else {
          console.log(chalk.yellow("Operation cancelled."));
        }
        return;
      }

      if (processingType === "Dest coords") {
        const useCsv = await confirm({
          message: "Do you want to use a CSV file for manual coordinates?",
          default: false,
        });

        let csvFilePath: string | undefined;

        if (useCsv) {
          const selection = await fileSelector({
            message: "Select the CSV file:",
            filter: (item) =>
              !item.name.startsWith(".") &&
              (item.isDirectory || item.name.toLowerCase().endsWith(".csv")),
          });
          csvFilePath = selection.path;
        }

        await populateDestinationCoords(csvFilePath);
        return;
      }

      if (processingType === "Route distances") {
        const useCsv = await confirm({
          message: "Do you want to use a CSV file for manual distances?",
          default: false,
        });

        let csvFilePath: string | undefined;

        if (useCsv) {
          const selection = await fileSelector({
            message: "Select the CSV file:",
            filter: (item) =>
              !item.name.startsWith(".") &&
              (item.isDirectory || item.name.toLowerCase().endsWith(".csv")),
          });
          csvFilePath = selection.path;
        }

        await populateRouteDistances(csvFilePath);
        return;
      }

      if (
        processingType === "Full sales" ||
        processingType === "Methanol price"
      ) {
        let dirPath = directory;

        if (!dirPath) {
          const selection = await fileSelector({
            message: "Select the directory containing CSV files:",
            type: "directory",
            filter: (item) => !item.name.startsWith("."),
          });
          dirPath = selection.path;
        }

        const absolutePath = path.resolve(dirPath);

        if (!fs.existsSync(absolutePath)) {
          console.error(
            logStyles.error(
              `The specified path does not exist: ${absolutePath}`,
            ),
          );
          process.exit(1);
        }

        if (!fs.statSync(absolutePath).isDirectory()) {
          console.error(
            logStyles.error(
              `The specified path is not a directory: ${absolutePath}`,
            ),
          );
          process.exit(1);
        }

        const files = fs
          .readdirSync(absolutePath)
          .filter((file) => path.extname(file).toLowerCase() === ".csv");

        if (files.length === 0) {
          console.warn(
            logStyles.warn("No CSV files found in the specified directory."),
          );
          return;
        }

        logger.info(chalk.blue(`Found ${files.length} CSV files.`));

        for (const file of files) {
          const filePath = path.join(absolutePath, file);
          try {
            logger.info(logStyles.info(`Uploading data from '${file}'...`));
            if (processingType === "Full sales") {
              await insertSalesInvoicesFromCSV(filePath);
            } else if (processingType === "Methanol price") {
              await insertICISMethanolPricesFromCSV(filePath);
            }
            logger.info(logStyles.success(`Completed upload from '${file}'.`));
          } catch (error) {
            logger.error(
              logStyles.error(`Error uploading data from '${file}': ${error}`),
            );
            process.exit(1);
          }
        }
      }

      if (
        processingType === "Full sales" ||
        processingType === "Derived sales"
      ) {
        logger.info(logStyles.info("Computing sales routes..."));
        await computeRoutes();

        logger.info(logStyles.info("Computing derived sales data..."));
        await computeDerivedData();

        logger.info(logStyles.success("Data ingestion complete."));
        logger.verbose(
          chalk.magenta("See ./.logs/dataIngestor.log file for details."),
        );
      }
    });

  await program.parseAsync(process.argv);
}

main();
