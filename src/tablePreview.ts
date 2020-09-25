import { BigQuery, Job } from "@google-cloud/bigquery";
import { BigQueryTable } from "./bigqueryResources";
import { getJobProject, getJobId, getJobLocation, getJobCreationTime, getJobStartTime, getJobEndTime, getJobTotalBytesProcessed, getJobDestinationTable } from './job';

export async function getWebviewContentForBigQueryResults(client: BigQuery, job: Job, rows: any[]): string {
    let html = `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Table Preview</title>
                <style>
                    table.jobInformation {
                        border-collapse: separate;
                        border-spacing: 0.75em 0.25em;
                    }

                    table.jobInformation td.key {
                        text-align: right;
                    }

                    table.jobInformation td.value {
                        font-family: monospace;
                    }

                    table.tablePreview {
                        border-collapse: separate;
                        border-spacing: 0.75em 0.25em;
                    }

                    table.tablePreview th {
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <h1>Job Information</h1>
                ${ queryDescriptionTable(job) }
                <h1>Table Preview</h1>
                ${ await getTablePreview(client, getJobDestinationTable(job), 100) }
            </body>
        </html>`

    return html;
}

function queryDescriptionTable(job: Job): string {
    let html = 
        `<table class="jobInformation">
            <tr>
                <td class="key">Project ID</td>
                <td class="value">${ getJobProject(job).projectId }</td>
            </tr>
            <tr>
                <td class="key">Job ID</td>
                <td class="value">${ getJobId(job) }</td>
            </tr>
            <tr>
                <td class="key">Location</td>
                <td class="value">${ getJobLocation(job) }</td>
            </tr>
            <tr>
                <td class="key">Creation Time</td>
                <td class="value">${ getJobCreationTime(job) }</td>
            </tr>
            <tr>
                <td class="key">Start Time</td>
                <td class="value">${ getJobStartTime(job) }</td>
            </tr>
            <tr>
                <td class="key">End Time</td>
                <td class="value">${ getJobEndTime(job) }</td>
            </tr>
            <tr>
                <td class="key">Bytes Processed</td>
                <td class="value">${ getJobTotalBytesProcessed(job) }</td>
            </tr>
            <tr>
                <td class="key">Destination Table</td>
                <td class="value">${ getJobDestinationTable(job).projectId }:${ getJobDestinationTable(job).datasetId }.${ getJobDestinationTable(job).tableId }</td>
            </tr>
        <table>`

    return html;
}

async function getTablePreview(client: BigQuery, table: BigQueryTable, maxRows: number): Promise<string> {
    const bqTable = client.dataset(table.datasetId).table(table.tableId);
    const [tableMetadata] = await bqTable.getMetadata();
    const schemaFields = tableMetadata.schema.fields;
    const [rows] = await bqTable.getRows({maxResults: maxRows});

    let html = `
    <table class="tablePreview">
        <tr>
            ${ schemaToHtml(schemaFields) }
        </tr>
        ${ rowsToHtml(schemaFields, rows) }
    </table>
    `

    return html;
}

function schemaToHtml(schemaFields: any[]): string {
    return schemaFields.map(f => `<th>${f.name}</th>`).join("");
}

function rowsToHtml(schemaFields: any[], rows: any[]): string {
    return rows.map(row => rowToHtml(schemaFields, row)).join("");
}

function rowToHtml(schemaFields: any[], row: any[]): string {
    return "<tr>" + schemaFields.map(f => f.name).map(f => `<td>${row[f]}</td>`).join("") + "</tr>";
}