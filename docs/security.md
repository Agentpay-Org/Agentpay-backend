# Security Notes

## CSV exports

`GET /api/v1/usage/export.csv` neutralizes spreadsheet formula injection in
dynamic fields before returning the attachment. Any exported `agent` or
`serviceId` value that starts with `=`, `+`, `-`, `@`, a tab, or a carriage
return is prefixed with an apostrophe so spreadsheet tools treat the value as
text.

The CSV path still preserves standard CSV quoting for quotes, commas, and line
breaks. JSON exports are not modified because they are not interpreted as
spreadsheet formulas.
