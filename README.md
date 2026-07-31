# Quick Item Editor (QIE)

Modulo per **Foundry VTT** (v13 / v14, sistema **D&D 5e**) che aggiunge un pulsante
**"Modifica globale"** nella barra laterale degli Item e apre una finestra dedicata
per modificare in massa gli oggetti del mondo.

## Obiettivo finale

- Pulsante **Modifica globale** nella sezione *Items*.
- Finestra separata con **tutti** gli oggetti del mondo, raggruppati per cartella.
- Cartelle **a cascata** (apri/chiudi), con gli stessi nomi della sidebar
  (*Mercante di armature*, *Mercante d'arte*, ecc.).
- **Ricerca** per nome e **filtri** su titolo, peso, prezzo, descrizione, rarità.
- **Modifica inline** di titolo, peso, prezzo, descrizione e rarità.
- **Salvataggio in tempo reale**.

## Note

- Il pulsante e la finestra sono visibili solo al **Game Master**.
- Il modulo usa `ApplicationV2`, quindi non dipende dalle API deprecate rimosse in v14.

## Licenza

MIT - vedi [LICENSE](LICENSE).

## Changelog

### 0.4.0 - Modifica inline e salvataggio in tempo reale

- Titolo, rarita, peso e prezzo (valore e valuta) modificabili direttamente nella riga.
- Descrizione modificabile in un editor ProseMirror espandibile sotto la riga.
- Salvataggio automatico 500 ms dopo l'ultimo tasto, immediato su invio, blur e menu a tendina.
- Riscontro visivo verde/rosso sull'esito e ripristino della riga in caso di errore.
- I controlli non compaiono sugli oggetti privi del campo nello schema (magie, privilegi).
- Sincronizzazione con le modifiche fatte altrove tramite gli hook di Foundry.
- Intestazione di colonne fissata in cima, rientro spostato sulla riga per mantenere le colonne allineate a ogni livello di annidamento.
- Pulsanti Ricarica l'elenco e Apri la scheda.

### 0.3.1 - Percorso del modulo derivato da import.meta.url

- Il nome della cartella non e piu scritto a mano, dopo la rinomina dell'id nel manifest i template venivano cercati in un percorso inesistente (ENOENT).

### 0.3.0 - Ricerca e filtri

- Campo di ricerca per titolo, normalizzato per maiuscole e accenti.
- Pannello filtri con descrizione, rarita, peso min/max e prezzo min/max.
- Prezzi convertiti in monete d'oro prima del confronto, cosi valute diverse restano confrontabili.
- Cartelle senza risultati nascoste, cartelle con risultati aperte in automatico.
- Colonne rarita, peso e prezzo nelle righe e contatore dei risultati.

### 0.2.0 - Albero cartelle a cascata

- L'albero deriva da `game.items.tree`, gerarchia, ordine e modalita di ordinamento seguono la sezione Items della barra laterale.
- Partial Handlebars ricorsivo con elementi `<details>` annidati.
- Colori delle cartelle ripresi dal documento Folder e conteggio ricorsivo degli oggetti.
- Pulsanti Espandi tutto e Comprimi tutto, stato di apertura persistente tra i render.

### 0.1.0 - Pulsante e finestra

- Manifest compatibile con Foundry v13 e v14, sistema D&D 5e.
- Pulsante Modifica globale iniettato nella barra laterale degli Item, visibile al solo GM.
- Finestra `GlobalItemEditor` basata su ApplicationV2, in istanza singola.
- Localizzazione italiano/inglese.
