import * as vscode from 'vscode';
import { BigQuery } from '@google-cloud/bigquery';
import { Resource } from '@google-cloud/resource';
import { BigQueryResourceProvider, BigQueryProject, BigQueryDataset, BigQueryTable } from './bigqueryResources';
import { BigQueryFormatter } from './formatter';
import { QueryHistoryProvider, Query } from './queryHistory';

const languageId = 'BigQuery';
let bqClient: BigQuery;
let resourceClient: Resource;

let projectItem: vscode.StatusBarItem;
let dryRunItem: vscode.StatusBarItem;

let dryRunTimer: NodeJS.Timer;

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'extension.dryRun',
            () => dryRun()
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'extension.setProjectCommand',
            () => setProjectCommand()
        )
    );

    bqClient = new BigQuery();
    resourceClient = new Resource();

    projectItem = createProjectItem();
    dryRunItem = createDryRunItem();
    updateStatusBarItem();

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(updateStatusBarItem)
    );

    vscode.window.onDidChangeTextEditorSelection((_) => updateDryRunTimer());

    const bigQueryResourceProvider = new BigQueryResourceProvider(vscode.workspace.rootPath);

    vscode.window.createTreeView(
        'bigquery.resources',
        {
            treeDataProvider: bigQueryResourceProvider
        }
    )

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "bigQueryResources.refreshAllResources",
            () => bigQueryResourceProvider.refreshAllResources()
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "bigQueryResources.showResourceInConsole",
            (resource: Resource) => showResourceInConsole(resource)
        )
    );

    const queryHistoryProvider = new QueryHistoryProvider(vscode.workspace.rootPath);

    context.subscriptions.push(
        vscode.window.createTreeView(
            'bigquery.queries',
            {
                treeDataProvider: queryHistoryProvider
            }
        )
    );

    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider("BigQuery", {
            provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
                const formatter = new BigQueryFormatter();

                const unformatted = document.getText();
                const formatted = formatter.format(unformatted);

                const start = document.lineAt(0).range.start;
                const end = document.lineAt(document.lineCount - 1).range.end;
                const fullRange = new vscode.Range(start, end);

                return [
                    vscode.TextEdit.delete(fullRange),
                    vscode.TextEdit.insert(document.lineAt(0).range.start, formatted)
                ]
            }
        })
    )

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'queryHistory.edit',
            (query: Query) => openQuery(query)
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'queryHistory.showQueryInConsole',
            (query: Query) => showQueryInConsole(query)
        )
    );

}

function createStatusBarItem(priority: number): vscode.StatusBarItem {
    const alignment = vscode.StatusBarAlignment.Right;
    return vscode.window.createStatusBarItem(alignment, priority);
}

function createProjectItem(): vscode.StatusBarItem {
    const item = createStatusBarItem(1);
    item.command = "extension.setProjectCommand";
    return item;
}

function getCurrentProjectId(): string {
    return projectItem.text;
}

function createDryRunItem(): vscode.StatusBarItem {
    const item = createStatusBarItem(0);
    item.command = "extension.dryRun";
    return item;
}

function setProjectCommand(): void {
    let options: vscode.InputBoxOptions = {
        ignoreFocusOut: false,
    }

    resourceClient.getProjects()
        .then(p => p[0])
        .then(ps => ps.map(p => p.id))
        .then(ps => vscode.window.showQuickPick(ps))
        .then(p => {
            if (typeof (p) !== 'undefined') {
                bqClient.projectId = p;
                updateProjectIdItem();
            }
        })
        .catch(error => vscode.window.showErrorMessage(error.message));
}

function updateStatusBarItem(): void {
    if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId == languageId) {
        updateProjectIdItem();
        showStatusBarItems();
    } else {
        hideStatusBarItems();
    }
}

function updateProjectIdItem(): void {
    bqClient.getProjectId()
        .then(p => projectItem.text = p)
        .catch(error => vscode.window.showErrorMessage(error.message));
}

function showStatusBarItems(): void {
    projectItem.show();
    dryRunItem.show();
}

function hideStatusBarItems(): void {
    projectItem.hide();
    dryRunItem.hide();
}

function updateDryRunTimer(): void {
    clearTimeout(dryRunTimer);
    dryRunTimer = setTimeout(() => dryRun(), 500)
}

function dryRun(): void {
    updateStatusBarItem();
    const activeEditor = vscode.window.activeTextEditor;
    if (activate) {
        const query = activeEditor.document.getText()
        const queryOptions = {
            query: query,
            dryRun: true,
            location: bqClient.location
        }
        dryRunItem.text = "$(loading)";
        dryRunItem.tooltip = "Performing dry run..."

        bqClient.createQueryJob(queryOptions)
            .then(jobResponse => jobResponse[0])
            .then(job => job.metadata.statistics)
            .then(statistics => statistics.totalBytesProcessed)
            .then(bytes => formatProcessedBytes(bytes))
            .then(s => {
                dryRunItem.text = "$(pass) " + s;
                dryRunItem.tooltip = s;
            })
            .catch(error => {
                dryRunItem.text = "$(warning)";
                dryRunItem.tooltip = error.message;
            })
    }
}

function formatProcessedBytes(bytes: number): string {
    const capacities = ["B", "KB", "MB", "GB", "TB", "PB"];
    let n = +bytes;
    let capacityIndex = 0;
    for (let i = 0; i < capacities.length; i++) {
        capacityIndex = i;
        if (n < 1024) {
            break;
        } else {
            n /= 1024;
        }
    }

    return `${n.toPrecision(2)} ${capacities[capacityIndex]}`
}

async function openQuery(query: Query) {
    const doc = await vscode.workspace.openTextDocument({
        content: query.query,
        language: "BigQuery"
    });

    vscode.window.showTextDocument(doc);
}

async function showQueryInConsole(query: Query) {
    vscode.env.openExternal(query.resourceUri);
}

async function showResourceInConsole(resource: Resource) {
    const queryParameters = [];
    
    const currentProjectId = getCurrentProjectId();
    queryParameters.push(`project=${currentProjectId}`);

    queryParameters.push(`p=${resource.projectId}`);

    let page: string;

    if (resource instanceof BigQueryProject) {
        page = "project";
    }

    if (resource instanceof BigQueryDataset) {
        queryParameters.push(`d=${resource.datasetId}`);
        page = "dataset";
    }

    if (resource instanceof BigQueryTable) {
        queryParameters.push(`d=${resource.datasetId}`);
        queryParameters.push(`t=${resource.tableId}`);
        page = "table";
    }

    queryParameters.push(`page=${page}`);

    const parameterString = queryParameters.join("&");

    let uri: vscode.Uri = vscode.Uri.parse(`https://console.cloud.google.com/bigquery?${parameterString}`);

    if (typeof(uri) != 'undefined') {
        vscode.env.openExternal(uri);
    }
}

export function deactivate(): void {
    projectItem.dispose();
}
