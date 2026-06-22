# Security notes

## CSV exports

`GET /api/v1/usage/export.csv` neutralizes spreadsheet formula injection before
returning usage data. Any exported field that begins with `=`, `+`, `-`, `@`,
tab, or carriage return is prefixed with an apostrophe so spreadsheet software
treats it as text instead of evaluating it as a formula.

The CSV exporter still applies standard quoting for quotes, commas, carriage
returns, and newlines. The JSON usage export is not modified by this mitigation
because JSON consumers do not evaluate spreadsheet formulas.
