import { isStringCloseEnough } from "../transformers";

console.log("### Testing isStringCloseEnough:");

const pairs = [
  ["Form  aldehyde", "FORMALDEHYDE"],
  ["Formaldehyde", "FORMALDEHYDE-37%"],
  ["Formaldehyde", "FORMALDEHYDE-36.5%"],
  ["Formaldehyde", "FORMALDEHYDE - 37%"],
  ["Formaldehyde", "FORMALDEHYDE - 36.50%"],
  ["Formaldehyde-36.5%", "FORMALDEHYDE - 36.5%"],
  ["Formaldehyde - 36.5%", "FORMALDEHYDE - 36.5%"],
  ["Formaldehyde-36.5%", "FORMALDEHYDE - 36.50%"],
  ["Formaldehyde - 36.50%", "FORMALDEHYDE - 36.50%"],
  ["Formaldehyde", "Hexamine"],
];

for (const [str, ref] of pairs) {
  console.log(`str:${str}, ref:${ref}: ${isStringCloseEnough(str, ref)}`);
}
