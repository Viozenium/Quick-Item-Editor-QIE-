/**
 * Costanti condivise del modulo Quick Item Editor.
 */

export const MODULE_ID = "quick-item-editor";

/** Percorso base per template e asset del modulo. */
export const MODULE_PATH = `modules/${MODULE_ID}`;

/** Percorsi dei campi dnd5e usati dall'editor. */
export const FIELDS = {
  name: "name",
  weight: "system.weight.value",
  price: "system.price.value",
  priceDenomination: "system.price.denomination",
  description: "system.description.value",
  rarity: "system.rarity",
};
