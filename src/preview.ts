import { BigQuery, Job, Table } from "@google-cloud/bigquery";
import { BigQueryDataset, BigQueryTable } from "./bigqueryResources";
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

export async function createDatasetPreview(context: vscode.ExtensionContext, client: BigQuery, dataset: BigQueryDataset): Promise<void> {
    const panel = vscode.window.createWebviewPanel(`dataset.${dataset.projectId}:${dataset.datasetId}`,
        'Dataset Information',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true
        });
    panel.webview.html = await getWebViewContentForDataset(context, panel, client, dataset);
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
                <title>Job Information and Preview</title>
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

async function getWebViewContentForDataset(context: vscode.ExtensionContext, panel: vscode.WebviewPanel, client: BigQuery, dataset: BigQueryDataset): Promise<string> {
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
                <title>Dataset Information</title>
                <link rel="stylesheet" href="${cssPath}">
            </head>
            <body>
                <h1>Dataset Information</h1>
                ${await datasetInfoTable(dataset)}
            </body>
        </html>`

    return html;
}

async function datasetInfoTable(dataset: BigQueryDataset): Promise<string> {
    const client = new BigQuery({
        projectId: dataset.projectId
    })

    const bqDataset = client.dataset(dataset.datasetId);
    const [metaData] = await bqDataset.getMetadata();

    const keyValues: [string, string][] = [
        ["Project ID", dataset.projectId],
        ["Dataset ID", dataset.datasetId],
        ["Description", metaData.description ? metaData.description : "(none)" ],
        ["Location", metaData.location],
        ["Creation Time", "" + new Date(+metaData.creationTime)],
        ["Last Modified Time", "" + new Date(+metaData.lastModifiedTime)],
        ["Default Table Expiration Time", metaData.defaultTableExpirationMs ? +metaData.defaultTableExpirationMs + " ms" : "(none)"],
        ["Default Partition Expiration Time", metaData.defaultPartitionExpirationMs? +metaData.defaultPartitionExpirationMs + " ms" : "(none)"],
        ["Labels", metaData.labels ? labelTable(metaData.labels) : "(none)" ]
    ]

    const rows = keyValues.map(t => keyValueToHtmlRow(t[0], t[1]))

    return `<table class="jobInformation"><tbody>` + rows.join("") + `</tbody></table>`
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
    const keyValues: [string, string][] = [
        ["Project ID", getJobProject(job).projectId],
        ["Job ID", getJobId(job)],
        ["Location", getJobLocation(job)],
        ["Creation Time", "" + getJobCreationTime(job)],
        ["Start Time", "" + getJobStartTime(job)],
        ["End Time", "" + getJobEndTime(job)],
        ["Bytes Processed", `${ formatBytes(getJobTotalBytesProcessed(job)) } ( ${getJobTotalBytesProcessed(job).toLocaleString() })`],
        ["Destination Table", `${ getJobDestinationTable(job).projectId }:${ getJobDestinationTable(job).datasetId }.${ getJobDestinationTable(job).tableId }`]
    ]

    const rows = keyValues.map(t => keyValueToHtmlRow(t[0], t[1]))

    return `<table class="jobInformation"><tbody>` + rows.join("") + `</tbody></table>`
}

function keyValueToHtmlRow(key: string, value: string): string {
    return "" + 
    `<tr>
        <td class="key">${ key }</td>
        <td class="value">${ value }</td>
    </tr>`
}

async function tableInfoTable(table: BigQueryTable): Promise<string> {
    const client = new BigQuery({
        projectId: table.projectId
    })

    const bqTable = client.dataset(table.datasetId).table(table.tableId);
    const [metaData] = await bqTable.getMetadata();

    const keyValues: [string, string][] = [
        ["Project ID", table.projectId],
        ["Dataset ID", table.datasetId],
        ["Table ID", table.tableId],
        ["Description", metaData.description ? metaData.description : "(none)" ],
        ["Location", metaData.location],
        ["Creation Time", "" + new Date(+metaData.creationTime)],
        ["Last Modified Time", "" + new Date(+metaData.lastModifiedTime)],
        ["Expiration Time", metaData.expirationTime ? new Date(+metaData.expirationTime) : "(none)"],
        ["Rows", (+metaData.numRows).toLocaleString() ],
        ["Partitioning", isPartitioned(metaData) ? partitioningTableHtml(metaData) : "(none)" ],
        ["Clustering", metaData.clustering ? metaData.clustering.fields.join(", ") : "(none)"],
        ["Active Storage Size", `${ formatBytes(metaData.numBytes) } ( ${ (+metaData.numBytes).toLocaleString() } Bytes)`],
        ["Long Term Storage Size", `${ formatBytes(metaData.numLongTermBytes) } ( ${ (+metaData.numLongTermBytes).toLocaleString() } Bytes)`],
        ["Labels", metaData.labels ? labelTable(metaData.labels) : "(none)" ]
    ]

    const rows = keyValues.map(t => keyValueToHtmlRow(t[0], t[1]))

    return `<table class="jobInformation"><tbody>` + rows.join("") + `</tbody></table>`
}

function isPartitioned(metaData: any): boolean {
    return metaData.timePartitioning || metaData.rangePartitioning;
}

function partitioningTableHtml(metaData: any): string {
    let partitioningType = "Unknown Partitioning Type";

    if (metaData.timePartitioning) {
        partitioningType = `Time Partitioning (${ metaData.timePartitioning.type }) on ${ metaData.timePartitioning.field }`;
    }

    if (metaData.rangePartitioning) {
        let range = metaData.rangePartitioning.range;
        partitioningType = `Range Partitioning (Start: ${ range.start }, Interval: ${ range.interval }, End: ${ range.end }) on ${ metaData.rangePartitioning.field }`;
    }

    return partitioningType;
}

function labelTable(labels: Map<string, string>): string {
    const labelRows = Object.keys(labels)
        .sort()
        .map(k => keyValueToHtmlRow(k, labels[k]))
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
