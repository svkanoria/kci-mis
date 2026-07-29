"use server";

import {
  getConsigneePriceAnalysis as fetchConsigneePriceAnalysis,
  ConsigneePriceAnalysisParams,
  ConsigneePriceAnalysisResult,
} from "@/lib/api";

export async function getConsigneePriceAnalysisAction(
  params: ConsigneePriceAnalysisParams,
): Promise<ConsigneePriceAnalysisResult> {
  return await fetchConsigneePriceAnalysis(params);
}
