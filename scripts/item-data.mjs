// Lettura e normalizzazione dei dati dnd5e usati dall'editor.

/**
 * Minuscolo e senza accenti, così "rarità" trova anche "rarita".
 * @param {string} value
 * @returns {string}
 */
export function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Testo semplice a partire da una descrizione HTML.
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converte un prezzo in monete d'oro, per poter confrontare valute diverse.
 * In dnd5e `conversion` è quante monete di quel taglio valgono 1 mo.
 * @param {number|string|null} value
 * @param {string} [denomination="gp"]
 * @returns {number|null}
 */
export function priceToGold(value, denomination = "gp") {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  const conversion = CONFIG.DND5E?.currencies?.[denomination]?.conversion;
  return Number.isFinite(conversion) && conversion > 0
    ? amount / conversion
    : amount;
}

/**
 * Peso dell'oggetto.
 * dnd5e >= 3.x usa un oggetto {value, units}, le versioni precedenti un numero semplice.
 * @param {Item} item
 * @returns {number|null}
 */
export function readWeight(item) {
  const raw = item.system?.weight;
  const value = raw !== null && typeof raw === "object" ? raw.value : raw;
  return Number.isFinite(Number(value)) && value !== "" && value !== null
    ? Number(value)
    : null;
}

/**
 * Valori dell'oggetto rilevanti per l'editor.
 * @param {Item} item
 */
export function readItem(item) {
  const rarity = item.system?.rarity ?? "";
  const priceValue = item.system?.price?.value ?? null;
  const denomination = item.system?.price?.denomination ?? "gp";
  const description = item.system?.description?.value ?? "";

  return {
    id: item.id,
    uuid: item.uuid,
    name: item.name,
    img: item.img,
    type: item.type,
    weight: readWeight(item),
    priceValue:
      priceValue === null || priceValue === "" ? null : Number(priceValue),
    denomination,
    priceGold: priceToGold(priceValue, denomination),
    rarity,
    description,
    descriptionText: stripHtml(description),
  };
}

/**
 * Etichetta localizzata di una rarità dnd5e.
 * @param {string} rarity
 * @returns {string}
 */
export function rarityLabel(rarity) {
  if (!rarity) return "";
  const label = CONFIG.DND5E?.itemRarity?.[rarity];
  return label ? game.i18n.localize(label) : rarity;
}

/**
 * Elenco delle rarità disponibili per i menu a tendina.
 * @returns {{value: string, label: string}[]}
 */
export function rarityChoices() {
  const config = CONFIG.DND5E?.itemRarity ?? {};
  return Object.entries(config).map(([value, label]) => ({
    value,
    label: game.i18n.localize(label),
  }));
}

/**
 * Abbreviazione della valuta (mo, ma, ...).
 * @param {string} denomination
 * @returns {string}
 */
export function denominationLabel(denomination) {
  const abbr = CONFIG.DND5E?.currencies?.[denomination]?.abbreviation;
  return abbr ? game.i18n.localize(abbr) : denomination;
}

/**
 * Elenco delle valute disponibili per i menu a tendina.
 * @returns {{value: string, label: string}[]}
 */
export function currencyChoices() {
  const config = CONFIG.DND5E?.currencies ?? {};
  return Object.keys(config).map((value) => ({
    value,
    label: denominationLabel(value),
  }));
}
