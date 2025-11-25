export const formatIndianNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
};
