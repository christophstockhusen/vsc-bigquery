# BigQuery for Visual Studio Code (vsc-bigquery)

A Visual Studio Code extension for developing [BigQuery SQL](https://cloud.google.com/bigquery/). 

## Features 

- Syntax highlighting.
- Query formatting.
- Query validation on the fly with presentation of expected number of bytes that will be processed.
- Error highlighting.
- Query submission with notification on error or success.
- GCP Project selection and saving per workspace.
- Listing of datasets, tables, views, models, table schemas.
- Query history listing with success and failed state.
- Query editing from history for further development directly in Visual Studio Code.

## Installation

Installation via the Visual Studio Code Marketplace is not yet available. Sorry for that. However, the manual installation is not that complicated:
- Download the latest VSIX file from [GitHub](https://github.com/christophstockhusen/vsc-bigquery/releases).
- Press `CTRL-Shift-P` and select `Extensions: Install from VSIX...` (type `ext vsix`).
- Select the downloaded VSIX file.
- Profit.

## Commands and Shortcuts

| Command                      | Shortcut           | Effect                                                                              |
|------------------------------|--------------------|-------------------------------------------------------------------------------------|
| `Run Query`                  | `CTRL-Enter`       | Run current selection or full query (if no selection).                              |
| `Run Query and Preview`      | `CTRL-Shift-Enter` | Execute `Run Query` but also open preview with query results.                       |
| `Format document`            | `CTRL-Shift-I`     | Format query                                                                        |
| `Dry Run`                    |                    | Force a dry run of your query and show validation results in status bar.            |
| `Set Google Cloud Project`   |                    | List the available Google Cloud Projects and set one as default.                    |
| `Refresh BigQuery Resources` |                    | Update the list of projects, datasets, tables, views, models in the resources view. |
