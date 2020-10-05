import { BigQuery, Job, Table } from "@google-cloud/bigquery";
import { BigQueryTable } from "./bigqueryResources";
import { getJobProject, getJobId, getJobLocation, getJobCreationTime, getJobStartTime, getJobEndTime, getJobTotalBytesProcessed, getJobDestinationTable } from './job';
import { formatBytes } from './byteFormatter';
import * as path from 'path';
import * as vscode from 'vscode';

export async function createJobPreview(context: vscode.ExtensionContext, client: BigQuery, job: Job): Promise<void> {
    const [jobResult] = await job.get();
    const panel = vscode.window.createWebviewPanel('queryResults.' + jobResult.metadata.jobReference.jobId,
        'Job Information',
        { 
            viewColumn: vscode.ViewColumn.Beside,
            preserveFocus: false
        },
        {
            enableScripts: true
        });
    panel.webview.html = await getWebViewContentForJob(context, panel, client, job);
}

export async function createTablePreview(context: vscode.ExtensionContext, client: BigQuery, table: BigQueryTable): Promise<void> {
    const panel = vscode.window.createWebviewPanel(`table.${table.projectId}:${table.datasetId}.${table.tableId}`,
        'Table Information',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true
        });
    panel.webview.html = await getWebViewContentForTable(context, panel, client, table);
}

async function getWebViewContentForJob(context: vscode.ExtensionContext, panel: vscode.WebviewPanel, client: BigQuery, job: Job): Promise<string> {
    const cssPath = panel.webview.asWebviewUri(
        vscode.Uri.file(
            path.join(context.extensionPath, 'resources', 'webview.css')
        )
    );

    let html = `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Table Preview</title>
                <link rel="stylesheet" href="${cssPath}">
            </head>
            <body>
                <h1>Job Information</h1>
                ${queryQueryInfoTable(job)}
                <h1>Table Preview</h1>
                ${await getTablePreview(getJobDestinationTable(job), 100)}
            </body>
        </html>`

    return html;
}

async function getWebViewContentForTable(context: vscode.ExtensionContext, panel: vscode.WebviewPanel, client: BigQuery, table: BigQueryTable): Promise<string> {
    const cssPath = panel.webview.asWebviewUri(
        vscode.Uri.file(
            path.join(context.extensionPath, 'resources', 'webview.css')
        )
    );

    let html = `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Table Preview</title>
                <link rel="stylesheet" href="${cssPath}">
            </head>
            <body>
                <h1>Table Information</h1>
                ${await tableInfoTable(table)}
                <h1>Table Preview</h1>
                ${await getTablePreview(table, 100)}
            </body>
        </html>`

    return html;
}

function queryQueryInfoTable(job: Job): string {
    let html =
        `<table class="jobInformation">
            <tbody>
                <tr>
                    <td class="key">Project ID</td>
                    <td class="value">${getJobProject(job).projectId}</td>
                </tr>
                <tr>
                    <td class="key">Job ID</td>
                    <td class="value">${getJobId(job)}</td>
                </tr>
                <tr>
                    <td class="key">Location</td>
                    <td class="value">${getJobLocation(job)}</td>
                </tr>
                <tr>
                    <td class="key">Creation Time</td>
                    <td class="value">${getJobCreationTime(job)}</td>
                </tr>
                <tr>
                    <td class="key">Start Time</td>
                    <td class="value">${getJobStartTime(job)}</td>
                </tr>
                <tr>
                    <td class="key">End Time</td>
                    <td class="value">${getJobEndTime(job)}</td>
                </tr>
                <tr>
                    <td class="key">Bytes Processed</td>
                    <td class="value">${ formatBytes(getJobTotalBytesProcessed(job)) } ( ${getJobTotalBytesProcessed(job).toLocaleString() })</td>
                </tr>
                <tr>
                    <td class="key">Destination Table</td>
                    <td class="value">${getJobDestinationTable(job).projectId}:${getJobDestinationTable(job).datasetId}.${getJobDestinationTable(job).tableId}</td>
                </tr>
            </tbody>
        </table>`

    return html;
}

async function tableInfoTable(table: BigQueryTable): Promise<string> {
    const client = new BigQuery({
        projectId: table.projectId
    })

    const bqTable = client.dataset(table.datasetId).table(table.tableId);
    console.log(bqTable);
    const [metaData] = await bqTable.getMetadata();
    console.log(metaData);

    let html =
        `<table class="jobInformation">
            <tbody>
                <tr>
                    <td class="key">Project ID</td>
                    <td class="value">${table.projectId}</td>
                </tr>
                <tr>
                    <td class="key">Dataset ID</td>
                    <td class="value">${table.datasetId}</td>
                </tr>
                <tr>
                    <td class="key">Table ID</td>
                    <td class="value">${table.tableId}</td>
                </tr>
                <tr>
                    <td class="key">Description</td>
                    <td class="value">${ metaData.description ? metaData.description : "(none)" }</td>
                </tr>
                <tr>
                    <td class="key">Rows</td>
                    <td class="value">${ (+metaData.numRows).toLocaleString() }</td>
                </tr>
                <tr>
                    <td class="key">Active Storage Size</td>
                    <td class="value">${ formatBytes(metaData.numBytes) } (${ (+metaData.numBytes).toLocaleString() } Bytes)</td>
                </tr>
                <tr>
                    <td class="key">Long Term Storage Size</td>
                    <td class="value">${ formatBytes(metaData.numLongTermBytes) } (${ (+metaData.numLongTermBytes).toLocaleString() } Bytes)</td>
                </tr>
                <tr>
                    <td class="key">Labels</td>
                    <td class="value">${ metaData.labels ? labelTable(metaData.labels) : "(none)" }</td>
                </tr>
            </tbody>
        <table>`

    return html;
}

function labelTable(labels: Map<string, string>): string {
    const labelRows = Object.keys(labels)
        .sort()
        .map(k => `<td class="key">${k}</td><td class="value">${ labels[k] }</td>`)
        .map(td => `<tr>${ td }</tr>`)
        .join("");

    return `<table class="tablePreview">${ labelRows }</table>`;
}

async function getTablePreview(table: BigQueryTable, maxRows: number): Promise<string> {
    const client = new BigQuery({
        projectId: table.projectId
    })

    const bqTable = client.dataset(table.datasetId).table(table.tableId);

    const [tableExists] = await bqTable.exists();
    if (!tableExists) {
        return "Table does not exist anymore."
    }

    const [tableMetadata] = await bqTable.getMetadata();
    const schemaFields = tableMetadata.schema.fields;
    const [rows] = await bqTable.getRows({ maxResults: maxRows });

    let html = `
    <table class="tablePreview">
        <thead>
            <tr>
                ${schemaToHtml(schemaFields)}
            </tr>
        </thead>
        <tbody>
            ${rowsToHtml(schemaFields, rows)}
        </tbody>
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

    const fields = schemaFields
        .map(f => f.name)
        .map(f => row[f])

    return "<tr>" + fields.map(f => `<td class="value">${fieldToHtml(f)}</td>`).join("") + "</tr>";
}

function fieldToHtml(field: any): string {
    if (typeof (field) != 'object') {
        return String(field);
    }

    if (!field) {
        return "NULL";
    }

    if (field.value) {
        return field.value;
    }

    const keys = Object.keys(field);
    const tableRows = keys.map(k => field[k]).map(f => `<tr><td class="value">${fieldToHtml(f)}</td></tr>`).join("")

    return `<table class="tablePreview"><tbody>${tableRows}</tbody></table>`
}
