export function nullifyEmpty(str: string) {
  if (str == "") {
    return null;
  } else {
    return str;
  }
}

export function transformDateFormat(str: string) {
  if (!str) return str;
  const parts = str.split(/[\.\/]/);
  if (parts.length !== 3)
    throw new Error(
      `Unrecognized date format '${str}', it should be dd.mm.yyyy or dd/mm/yyyy`,
    );
  const [month, day, year] = parts;
  return `${day}/${month}/${year}`;
}
