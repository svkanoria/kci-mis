import { linearRegression } from "simple-statistics";

/**
 * Calculates the linear regression (slope and intercept) for a given array of
 * numerical values.
 *
 * The function treats the array indices as the x-coordinates and the array
 * values as the y-coordinates. If the input array has fewer than 2 elements, it
 * returns a slope and intercept of 0.
 *
 * @param values - An array of numbers representing the y-values for the
 * regression.
 * @returns An object containing the calculated `slope` (m) and `intercept` (b)
 * of the best-fit line.
 */
export function calculateRegression(values: number[]) {
  if (values.length < 2) return { slope: 0, intercept: 0 };
  const points = values.map((y, x) => [x, y]);
  const { m, b } = linearRegression(points);
  return { slope: m, intercept: b };
}
