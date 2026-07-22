import { computeMilpClusters, Cluster } from "@/lib/utils/milp-cluster";
import { ConsigneeSalesPoint } from "@/lib/api/sales-by-consignee";

export interface ClusterWorkerInput {
  salesPoints: ConsigneeSalesPoint[];
  radiusKm: number;
  numMonths: number;
}

export interface ClusterWorkerOutput {
  clusters: Cluster[];
}

self.addEventListener("message", (event: MessageEvent<ClusterWorkerInput>) => {
  const { salesPoints, radiusKm, numMonths } = event.data;
  const clusters = computeMilpClusters(salesPoints, radiusKm, numMonths);
  self.postMessage({ clusters } satisfies ClusterWorkerOutput);
});
