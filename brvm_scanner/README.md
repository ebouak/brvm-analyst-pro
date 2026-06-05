# BRVM Scanner

> ⚠️ **DEPRECATED (2026-06-05)** — L'analyse fondamentale est désormais intégrée
> au site Next.js (`/fondamentaux`), sans mise en veille ni synchro locale.
> Cette app Streamlit n'est plus maintenue ; conservée pour archive uniquement.

Application Streamlit d'analyse des 48 actions de la BRVM (UEMOA) : cours,
backtest et fondamentaux extraits des états financiers (IFRS / SYSCOHADA).

## Structure des données

```
brvm_scanner/
├── app.py                      # application Streamlit
├── requirements.txt
├── utils/
│   ├── data_loader.py          # chargement cours / fondamentaux / métadonnées
│   └── extract_fundamentals.py # extraction PDF → JSON (script autonome)
└── data/
    ├── prices/                 # {SYMBOLE}_backtest.csv  (Date, Stratégie, Buy&Hold, Cours)
    ├── financials/             # {SYMBOLE}_{ANNEE}_{NORME}.pdf  (IFRS / SYSCOHADA)
    ├── extracted/              # {SYMBOLE}_fundamentals.json  (généré)
    └── metadata/symbols.json   # référentiel des 48 actions
```

**Règle de nommage** : le **symbole** (code BRVM à 4 lettres, ex. `ABJC`, `BOAB`)
est toujours la première partie du nom de fichier, avant le premier `_`.

## Installation

```bash
cd brvm_scanner
python -m venv .venv && source .venv/bin/activate   # Windows : .venv\Scripts\activate
pip install -r requirements.txt
```

## Utilisation

1. **Cours** : déposez vos CSV de backtest dans `data/prices/`
   (`ABJC_backtest.csv`, colonnes `Date, Stratégie, Buy&Hold, Cours`).
2. **États financiers** : déposez les PDFs dans `data/financials/`
   (`ABJC_2024_IFRS.pdf`, `ABJC_2024_SYSCOHADA.pdf`…).
3. **Extraction des fondamentaux** :
   ```bash
   python -m utils.extract_fundamentals
   ```
   → génère `data/extracted/{SYMBOLE}_fundamentals.json`.
4. **Lancer l'app** :
   ```bash
   streamlit run app.py
   ```

## API de chargement (`utils.data_loader`)

| Fonction | Rôle |
|---|---|
| `get_available_symbols()` | Liste les symboles ayant un CSV dans `prices/`. |
| `load_price_data(symbol)` | Charge le CSV de cours (DataFrame) ou `None`. |
| `load_fundamentals(symbol)` | Charge le JSON de fondamentaux ou `None`. |
| `load_symbols_metadata()` | Charge `symbols.json`. |
| `get_symbol_info(symbol)` | Métadonnées d'une action (nom, secteur, pays). |

## Fondamentaux extraits

`{SYMBOLE}_fundamentals.json` :

```json
{
  "revenue": 13298,
  "net_income": 1331,
  "equity": 5512,
  "cash": 4035,
  "debt": null,
  "bfr": null,
  "year": 2024,
  "source_file": "ABJC_2024_IFRS.pdf"
}
```

> Les libellés recherchés (`PATTERNS` dans `extract_fundamentals.py`) sont
> calibrés sur les états IFRS/SYSCOHADA BRVM. Ajustez-les si vos PDFs utilisent
> d'autres intitulés (ex. « Résultat net part du groupe »).

## Gestion des erreurs

- **JSON fondamental manquant** → l'app affiche « Données non disponibles » et
  continue (aucun blocage).
- **PDF corrompu** → journalisé (log) puis ignoré ; l'extraction poursuit les
  autres fichiers.
- **CSV illisible / dossier absent** → fonctions de chargement renvoient `None`
  ou une liste vide, l'app reste fonctionnelle.
