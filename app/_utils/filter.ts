export function extractFilterParams(searchParams: {
  [key: string]: string | string[] | undefined;
}) {
  const { from, to, product } = searchParams;
  const fromStr = typeof from === "string" ? from : undefined;
  const toStr = typeof to === "string" ? to : undefined;
  const productStr = typeof product === "string" ? product : undefined;

  return {
    from: fromStr ? new Date(fromStr) : undefined,
    to: toStr ? new Date(toStr) : undefined,
    product: productStr,
  };
}
