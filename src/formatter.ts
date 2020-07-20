import sqlFormatter from "sql-formatter";

export class BigQueryFormatter {
    format(s: string): string {
        const cfg = {
            language: "bigquery"
        }
        return sqlFormatter.format(s, cfg)
    }
}
