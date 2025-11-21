import { isStringCloseEnough, replaceStrings } from "../utils/transformers";

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

console.log("### Testing replaceStrings");

console.log(
  replaceStrings([[/Formaldehyde.*37.*Drums/i, "Formaldehyde-37% in Drums"]])(
    "FORMALDEHYDE 37% in Drums (Refilled)",
  ),
);

console.log(
  replaceStrings([[/Anhydrous\s*Ammonia/i, "Anhydrous Ammonia"]])(
    "ANHYDROUS AMMONIA (NH3)",
  ),
);
