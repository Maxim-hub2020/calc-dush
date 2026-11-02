# Installation pricing

Installation has independent per-construction selling prices (`installationPrice`)
and total crew payouts (`installationCost`). Both are amounts per installed unit,
not per worker. Transport and consumables must be accounted for separately.

| Construction ID | Client price, RUB | Crew payout, RUB |
| --- | ---: | ---: |
| 6663 / 6747 | 5000 | 3000 |
| 6745 | 8000 | 5000 |
| 6744 / 6746 | 10000 | 6000 |
| 6748 / 6749 / 6751 | 12000 | 8000 |
| 6750 / 6752 / 6753 | 14000 | 10000 |
| 6754 | 15000 | 10000 |

The optional form flag `complexInstallation` applies a factor of 1.25 to both
amounts, only when installation is selected. Switching installation off clears
the flag in the UI. Conditions are preserved in saved quote details and PDFs.
The designer commission on installation is based on the selling price rather
than the crew payout. Discounts affect revenue, not the crew payout.

Existing saved quotes retain their price snapshots until explicitly recalculated.
The price editor exposes both installation amounts independently. Custom/legacy
constructions without a configured crew payout conservatively use their selling
price as cost. Shared delivery remains a separate order-level calculation.

Applying a new grid to an existing company requires updating only its catalog;
default source values do not override stored prices or historical quotes.
