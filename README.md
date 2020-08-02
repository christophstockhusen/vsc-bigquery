# BigQuery for Visual Studio Code (vsc-bigquery)

A Visual Studio Code extension for developing [BigQuery SQL](https://cloud.google.com/bigquery/). 

## Features 
- Format your queries.
- Validate your queries while you write them.
- Show the expected number of processed bytes while you write your query.
- Run your queries.
- Set your default Google Cloud Platform (GCP) project.
- List available GCP projects with their datasets, tables, views, models.
- Show table schemas.
- List your query history.
- Open queries from history for further development directly in Visual Studio Code.

## Installation

Installation via the Visual Studio Code Marketplace is not yet available. Sorry for that. However, the manual installation is not that complicated:
- Download the latest VSIX file from the releases.
- Press `CTRL-Shift-P` and select `Extensions: Install from VSIX...` (type `ext vsix`).
- Select the downloaded VSIX file.
- Profit.

## Commands and Shortcuts

| Command                      | Shortcut           | Effect                                                                              |
|------------------------------|--------------------|-------------------------------------------------------------------------------------|
| `Run Query`                  | `CTRL-Enter`       | Run current selection or full query (if no selection).                              |
| `Run Query and Open Browser` | `CTRL-Shift-Enter` | Execute `Run Query` but also open browser with query results.               |
| `Format document`            | `CTRL-Shift-I`     | Format query                                                                        |
| `Dry Run`                    |                    | Force a dry run of your query and show validation results in status bar.            |
| `Set Google Cloud Project`   |                    | List the available Google Cloud Projects and set one as default.                    |
| `Refresh BigQuery Resources` |                    | Update the list of projects, datasets, tables, views, models in the resources view. |