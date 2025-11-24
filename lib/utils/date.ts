import {
  startOfQuarter,
  endOfQuarter,
  subQuarters,
  subYears,
  setMonth,
  setYear,
  startOfMonth,
  endOfMonth,
  getMonth,
  getYear,
  addMonths,
  format,
} from "date-fns";

const DEFAULT_FY_START_MONTH = 3; // April

/**
 * Returns the start of the financial year for the given date.
 * @param date The date to check (default: now)
 * @param startMonth The month the financial year starts (0-indexed,
 * default: 3 for April)
 */
export function getStartOfFY(
  date: Date = new Date(),
  startMonth: number = DEFAULT_FY_START_MONTH,
): Date {
  const month = getMonth(date);
  const year = getYear(date);
  const fyStartYear = month < startMonth ? year - 1 : year;
  return startOfMonth(setMonth(setYear(date, fyStartYear), startMonth));
}

/**
 * Returns the end of the financial year for the given date.
 * @param date The date to check (default: now)
 * @param startMonth The month the financial year starts (0-indexed,
 * default: 3 for April)
 */
export function getEndOfFY(
  date: Date = new Date(),
  startMonth: number = DEFAULT_FY_START_MONTH,
): Date {
  const startOfFY = getStartOfFY(date, startMonth);
  return endOfMonth(addMonths(startOfFY, 11));
}

/**
 * Returns the start of the financial year N years ago.
 * @param n Number of years to go back (default: 1)
 * @param date The reference date (default: now)
 * @param startMonth The month the financial year starts (0-indexed,
 * default: 3 for April)
 */
export function getStartOfPreviousFY(
  n: number = 1,
  date: Date = new Date(),
  startMonth: number = DEFAULT_FY_START_MONTH,
): Date {
  const startOfFY = getStartOfFY(date, startMonth);
  return subYears(startOfFY, n);
}

/**
 * Returns the end of the financial year N years ago.
 * @param n Number of years to go back (default: 1)
 * @param date The reference date (default: now)
 * @param startMonth The month the financial year starts (0-indexed,
 * default: 3 for April)
 */
export function getEndOfPreviousFY(
  n: number = 1,
  date: Date = new Date(),
  startMonth: number = DEFAULT_FY_START_MONTH,
): Date {
  const startOfPrevFY = getStartOfPreviousFY(n, date, startMonth);
  return endOfMonth(addMonths(startOfPrevFY, 11));
}

/**
 * Returns the start of the quarter N quarters ago.
 * @param n Number of quarters to go back (default: 1)
 * @param date The reference date (default: now)
 */
export function getStartOfPreviousQuarter(
  n: number = 1,
  date: Date = new Date(),
): Date {
  return startOfQuarter(subQuarters(date, n));
}

/**
 * Returns the end of the quarter N quarters ago.
 * @param n Number of quarters to go back (default: 1)
 * @param date The reference date (default: now)
 */
export function getEndOfPreviousQuarter(
  n: number = 1,
  date: Date = new Date(),
): Date {
  return endOfQuarter(subQuarters(date, n));
}
