import { ConsigneeSalesPoint } from "@/lib/api/sales-by-consignee";
import { calculateDistance } from "@/lib/utils/distance";

export interface Cluster {
  id: string;
  center: { lat: number; lng: number };
  hubName: string;
  totalQty: number;
  avgMonthlyQty: number;
  isDense: boolean;
  points: ConsigneeSalesPoint[];
  maxDistanceKm: number;
}

export function computeMilpClusters(
  salesPoints: ConsigneeSalesPoint[],
  radiusKm: number,
  numMonths: number,
): Cluster[] {
  if (salesPoints.length === 0) return [];

  const n = salesPoints.length;

  // Step 1: Pre-calculate candidate neighborhoods within radiusKm
  const candidateNeighborhoods: number[][] = salesPoints.map((pj) => {
    const neighbors: number[] = [];
    for (let i = 0; i < n; i++) {
      if (
        calculateDistance(
          pj.lat,
          pj.lng,
          salesPoints[i].lat,
          salesPoints[i].lng,
        ) <= radiusKm
      ) {
        neighbors.push(i);
      }
    }
    return neighbors;
  });

  // Potential volume if candidate j is chosen as a hub center
  const potentialVolumes: number[] = candidateNeighborhoods.map((neighbors) =>
    neighbors.reduce((sum, idx) => sum + salesPoints[idx].totalQty, 0),
  );

  // Filter valid candidate hub centers (potential volume > 0)
  const candidateIndices: number[] = [];
  for (let j = 0; j < n; j++) {
    if (potentialVolumes[j] > 0) {
      candidateIndices.push(j);
    }
  }

  // Sort candidate hubs by potential volume descending
  candidateIndices.sort((a, b) => potentialVolumes[b] - potentialVolumes[a]);

  // Step 2: MILP Solver for Set Packing / Facility Location
  const evalHubSet = (hubs: number[]) => {
    const assignments = new Array(n).fill(-1);
    let totalCoveredVol = 0;

    for (let i = 0; i < n; i++) {
      let bestHub = -1;
      let maxHubVol = -1;
      for (const h of hubs) {
        if (candidateNeighborhoods[h].includes(i)) {
          if (potentialVolumes[h] > maxHubVol) {
            maxHubVol = potentialVolumes[h];
            bestHub = h;
          }
        }
      }
      if (bestHub !== -1) {
        assignments[i] = bestHub;
        totalCoveredVol += salesPoints[i].totalQty;
      }
    }
    const obj = totalCoveredVol - hubs.length * 0.001;
    return { obj, assignments, totalCoveredVol };
  };

  // Fast Primal Heuristic to initialize lower bound
  const greedyAssigned = new Set<number>();
  const greedyHubs: number[] = [];
  const candidatePool = [...candidateIndices];

  while (candidatePool.length > 0) {
    let bestCand = -1;
    let maxNewVolume = -1;

    for (const cand of candidatePool) {
      const newVol = candidateNeighborhoods[cand].reduce(
        (sum, idx) =>
          greedyAssigned.has(idx) ? sum : sum + salesPoints[idx].totalQty,
        0,
      );
      if (newVol > maxNewVolume) {
        maxNewVolume = newVol;
        bestCand = cand;
      }
    }

    if (bestCand === -1 || maxNewVolume <= 0) break;

    greedyHubs.push(bestCand);
    for (const idx of candidateNeighborhoods[bestCand]) {
      greedyAssigned.add(idx);
    }
    const idxInPool = candidatePool.indexOf(bestCand);
    if (idxInPool !== -1) candidatePool.splice(idxInPool, 1);
  }

  const greedyEval = evalHubSet(greedyHubs);
  let bestObjective = greedyEval.obj;
  let bestHubs = [...greedyHubs];
  let bestAssignments = [...greedyEval.assignments];

  // Branch-and-Bound solver for global maximum optimization
  const candidateList = candidateIndices.slice(
    0,
    Math.min(100, candidateIndices.length),
  );

  function branchAndBound(
    candIndex: number,
    currentHubs: number[],
    coveredPoints: Set<number>,
    currentVol: number,
  ) {
    let maxPossibleAdditionalVol = 0;
    for (let i = 0; i < n; i++) {
      if (!coveredPoints.has(i)) {
        maxPossibleAdditionalVol += salesPoints[i].totalQty;
      }
    }

    if (currentVol + maxPossibleAdditionalVol <= bestObjective + 0.0001) {
      return; // Prune branch
    }

    if (candIndex >= candidateList.length) {
      const { obj, assignments } = evalHubSet(currentHubs);
      if (obj > bestObjective) {
        bestObjective = obj;
        bestHubs = [...currentHubs];
        bestAssignments = [...assignments];
      }
      return;
    }

    const nextCand = candidateList[candIndex];

    // Branch 1: Include nextCand as hub
    const newCoveredPoints = new Set(coveredPoints);
    let addedVol = 0;
    for (const pIdx of candidateNeighborhoods[nextCand]) {
      if (!newCoveredPoints.has(pIdx)) {
        newCoveredPoints.add(pIdx);
        addedVol += salesPoints[pIdx].totalQty;
      }
    }

    if (addedVol > 0) {
      currentHubs.push(nextCand);
      branchAndBound(
        candIndex + 1,
        currentHubs,
        newCoveredPoints,
        currentVol + addedVol,
      );
      currentHubs.pop();
    }

    // Branch 2: Exclude nextCand as hub
    branchAndBound(candIndex + 1, currentHubs, coveredPoints, currentVol);
  }

  branchAndBound(0, [], new Set(), 0);

  // Step 3: Local 2-opt Refinement to align hub centers with peak density points
  for (let hIdx = 0; hIdx < bestHubs.length; hIdx++) {
    const currentHub = bestHubs[hIdx];
    const clusterPointsIdx: number[] = [];
    for (let i = 0; i < n; i++) {
      if (bestAssignments[i] === currentHub) {
        clusterPointsIdx.push(i);
      }
    }

    let bestCenter = currentHub;
    let maxCenterVol = -1;

    for (const candCenter of candidateNeighborhoods[currentHub]) {
      const valid = clusterPointsIdx.every(
        (pIdx) =>
          calculateDistance(
            salesPoints[candCenter].lat,
            salesPoints[candCenter].lng,
            salesPoints[pIdx].lat,
            salesPoints[pIdx].lng,
          ) <= radiusKm,
      );

      if (valid) {
        const candVol = candidateNeighborhoods[candCenter].reduce(
          (sum, idx) => sum + salesPoints[idx].totalQty,
          0,
        );
        if (candVol > maxCenterVol) {
          maxCenterVol = candVol;
          bestCenter = candCenter;
        }
      }
    }

    bestHubs[hIdx] = bestCenter;
  }

  // Step 4: Assign points strictly to their closest hub center within radiusKm
  const finalClustersMap = new Map<number, ConsigneeSalesPoint[]>();
  for (const h of bestHubs) {
    finalClustersMap.set(h, []);
  }

  for (let i = 0; i < n; i++) {
    const p = salesPoints[i];
    let closestHub = -1;
    let minDist = Infinity;

    for (const h of bestHubs) {
      const dist = calculateDistance(
        p.lat,
        p.lng,
        salesPoints[h].lat,
        salesPoints[h].lng,
      );
      if (dist <= radiusKm && dist < minDist) {
        minDist = dist;
        closestHub = h;
      }
    }

    if (closestHub !== -1) {
      finalClustersMap.get(closestHub)!.push(p);
    }
  }

  // Step 5: Build final Cluster objects
  const clusters: Cluster[] = [];
  let clusterIdx = 0;

  for (const [hubIdx, points] of finalClustersMap.entries()) {
    if (points.length === 0) continue;

    const hubPoint = salesPoints[hubIdx];
    const totalQty = points.reduce(
      (sum: number, p: ConsigneeSalesPoint) => sum + p.totalQty,
      0,
    );
    const avgMonthlyQty = totalQty / numMonths;

    let maxDist = 0;
    points.forEach((p: ConsigneeSalesPoint) => {
      const d = calculateDistance(hubPoint.lat, hubPoint.lng, p.lat, p.lng);
      if (d > maxDist) maxDist = d;
    });

    clusters.push({
      id: `cluster-milp-${clusterIdx++}-${hubPoint.lat}-${hubPoint.lng}`,
      center: { lat: hubPoint.lat, lng: hubPoint.lng },
      hubName: `${hubPoint.city}, ${hubPoint.region}`,
      totalQty,
      avgMonthlyQty,
      isDense: false,
      points,
      maxDistanceKm: maxDist,
    });
  }

  return clusters;
}
