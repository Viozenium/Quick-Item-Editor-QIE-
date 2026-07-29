/** Costanti condivise del modulo Quick Item Editor. */

/**
 * Percorso del modulo ricavato dalla posizione di questo file.
 */
const scriptFolder = decodeURIComponent(new URL("../", import.meta.url).pathname);
const modulesIndex = scriptFolder.lastIndexOf("modules/");

/** Percorso base per template e asset, relativo alla route di Foundry. */
export const MODULE_PATH = (modulesIndex >= 0 ? scriptFolder.slice(modulesIndex) : scriptFolder)
  .replace(/^\/+/, "")
  .replace(/\/$/, "");

/** Identificativo del modulo, cioè il nome della sua cartella. */
export const MODULE_ID = MODULE_PATH.split("/").pop();

/** Percorsi dei campi dnd5e usati dall'editor. */
export const FIELDS = {
  name: "name",
  weight: "system.weight.value",
  price: "system.price.value",
  priceDenomination: "system.price.denomination",
  description: "system.description.value",
  rarity: "system.rarity",
};
