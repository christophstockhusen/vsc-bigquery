import * as vscode from 'vscode';
import { BigQuery, Job } from '@google-cloud/bigquery';
import { ProjectsClient } from '@google-cloud/resource-manager';
import { BigQueryResourceProvider, BigQueryProject, BigQueryDataset, BigQueryTable, BigQueryResource } from './bigqueryResources';
import { BigQueryFormatter } from './formatter';
import { QueryHistoryProvider } from './queryHistoryProvider';
import { Query } from './query';
import { getJobUri } from './job';
import { updateDiagnosticsCollection } from './diagnostics';
import { DryRunResult, DryRunFailure, DryRunSuccess } from './dryRunResult';
import { DryRunCache } from './dryRunCache';
import { createJobPreview, createDatasetPreview, createTablePreview } from './preview';

const languageId = 'BigQuery';
let bqClient: BigQuery;
let projectsClient: ProjectsClient;

let projectItem: vscode.StatusBarItem;
let dryRunItem: vscode.StatusBarItem;

let dryRunTimers: Map<vscode.TextDocument, NodeJS.Timer>;
let dryRunCache: DryRunCache;

let queryHistoryTimer: NodeJS.Timer;

let bigQueryResourceProvider: BigQueryResourceProvider;
let queryHistoryProvider: QueryHistoryProvider;

const memProjectId = 'projectId';

let diagnosticsCollection: vscode.DiagnosticCollection;

let ctx: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
    ctx = context;
    dryRunTimers = new Map<vscode.TextDocument, NodeJS.Timer>();
    dryRunCache = new DryRunCache();

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'extension.submitQuery',
            () => submitQuery(context, false)
        ),
        vscode.commands.registerCommand(
            'extension.submitQueryAndOpenBrowser',
            () => submitQuery(context, true)
        ),
        vscode.commands.registerCommand(
            'extension.dryRun',
            () => {
                const editor = vscode.window.activeTextEditor;
                if (editor !== undefined) {
                    const document = editor.document;
                    if (document.languageId === languageId) {
                        dryRun(document);
                    }
                }
            }
        ),
        vscode.commands.registerCommand(
            'extension.setProjectCommand',
            () => setProjectCommand()
        )
    );

    bqClient = new BigQuery();
    projectsClient = new ProjectsClient();

    projectItem = createProjectItem();
    dryRunItem = createDryRunItem();
    updateStatusBarItems();
    projectItem.text = "No GCP project selected yet";
    projectItem.show();

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
            if (document.languageId === languageId) {
                dryRun(document);
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(e => {
            if (e !== undefined && e.document.languageId === languageId) {
                dryRun(e.document);
                updateDiagnosticsCollection(dryRunCache, diagnosticsCollection);
                updateStatusBarItems();
            }
        }),
        vscode.window.onDidChangeVisibleTextEditors(editors => {
            updateStatusBarItems();
            dryRunCache.gc();
        }),
        vscode.workspace.onDidCloseTextDocument(document => {
            dryRunCache.remove(document);
            updateDiagnosticsCollection(dryRunCache, diagnosticsCollection);
        }),
        vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.languageId === languageId) {
                dryRunCache.remove(e.document);
                updateDiagnosticsCollection(dryRunCache, diagnosticsCollection);
                updateDryRunTimer(e.document);
            }
        })
    );

    bigQueryResourceProvider = new BigQueryResourceProvider(vscode.workspace.rootPath);

    vscode.window.createTreeView(
        'bigquery.resources',
        {
            treeDataProvider: bigQueryResourceProvider
        }
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "bigQueryResources.refreshAllResources",
            () => bigQueryResourceProvider.refreshAllResources()
        ),
        vscode.commands.registerCommand(
            "bigQueryResources.showResourceInConsole",
            (resource: BigQueryResource) => showResourceInConsole(resource)
        ),
        vscode.commands.registerCommand(
            "bigQueryResources.datasetInfo",
            async (dataset: BigQueryDataset) => {
                createDatasetPreview(context, bqClient, dataset)
            }
        ),
        vscode.commands.registerCommand(
            "bigQueryResources.tableInfo",
            async (table: BigQueryTable) => {
                createTablePreview(context, bqClient, table)
            }
        )
    );

    queryHistoryProvider = new QueryHistoryProvider(vscode.workspace.rootPath);

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
        ),
        vscode.commands.registerCommand(
            'queryHistory.showQueryInConsole',
            (query: Query) => showQueryInConsole(query)
        ),
        vscode.commands.registerCommand(
            'queryHistory.preview',
            (query: Query) => {
                const job = bqClient.job(query.jobId);
                createJobPreview(context, bqClient, job);
            }
        )
    );

    diagnosticsCollection = vscode.languages.createDiagnosticCollection('bigquery');
    context.subscriptions.push(diagnosticsCollection);

    getCurrentProjectId().then(p => setCurrentProjectId(p));

    resetQueryHistoryTimer();
}

export async function getCurrentProjectId(): Promise<string> {
    const memento = ctx.workspaceState.get(memProjectId);
    if (typeof memento === 'undefined') {
        const projectId = await bqClient.getProjectId();
        ctx.workspaceState.update(memProjectId, projectId);
    }
    return ctx.workspaceState.get(memProjectId);
}

function setCurrentProjectId(projectId: string): void {
    ctx.workspaceState.update(memProjectId, projectId);
    bqClient.projectId = projectId;
    updateProjectIdItem();
    queryHistoryProvider.refreshHistory();
    dryRunAll();
}

function setProjectCommand(): void {
    let options: vscode.InputBoxOptions = {
        ignoreFocusOut: false,
    }

    projectsClient.searchProjects()
        .then(p => p[0])
        .then(ps => ps.map(p => p.projectId))
        .then(id => vscode.window.showQuickPick(id))
        .then(p => {
            if (typeof (p) !== 'undefined') {
                setCurrentProjectId(p);
            }
        })
        .catch(error => vscode.window.showErrorMessage(error.message));
}

function getLocation(): string {
    const location = String(vscode.workspace
        .getConfiguration('bigquery')
        .get("location"));
    return location;
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

function createDryRunItem(): vscode.StatusBarItem {
    const item = createStatusBarItem(0);
    item.command = "extension.dryRun";
    return item;
}

function updateStatusBarItems(): void {
    updateProjectIdItem();
    updateDryRunItem();
}

function updateProjectIdItem(): void {
    getCurrentProjectId()
        .then(p => projectItem.text = p)
        .catch(error => vscode.window.showErrorMessage(error.message));
}

function updateDryRunItem(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        dryRunItem.hide();
        return;
    }

    const document = editor.document;
    if (document.languageId !== languageId) {
        dryRunItem.hide();
        return;
    }

    dryRunItem.show();

    const dryRunResult = dryRunCache.getResult(document);
    if (dryRunResult === undefined) {
        dryRunItem.tooltip = "no dryrun performed yet";
        dryRunItem.text = "$(warning)";
    } else {
        if (dryRunResult instanceof DryRunSuccess) {
            dryRunItem.text = "$(pass) " + dryRunResult.processedBytes;
            dryRunItem.tooltip = 'Success!';
        }
        if (dryRunResult instanceof DryRunFailure) {
            dryRunItem.text = "$(error)";
            dryRunItem.tooltip = dryRunResult.errorMessage;
        }
    }
}

function updateDryRunTimer(document: vscode.TextDocument): void {
    const oldTimer = dryRunTimers.get(document);
    if (oldTimer !== undefined) {
        clearTimeout(oldTimer);
    }
    const delay = +vscode.workspace
        .getConfiguration('bigquery')
        .get("bigquery.dryRunDelay");
    const newTimer = setTimeout(() => dryRun(document), delay)
    dryRunTimers.set(document, newTimer);
}

function dryRunAll(): void {
    const editors = vscode.window.visibleTextEditors;
    editors.forEach(e => {
        if (e.document.languageId === languageId) {
            dryRun(e.document);
        }
    })
}

async function dryRun(document: vscode.TextDocument): Promise<void> {
    const projectId = await getCurrentProjectId();
    const location = getLocation();
    const bqClient = new BigQuery({
        projectId: projectId,
        location: location
    });

    const queryOptions = {
        query: document.getText(),
        dryRun: true
    }

    let dryRunResult: DryRunResult;

    try {
        const [job] = await bqClient.createQueryJob(queryOptions);
        const totalBytesProcessed = +job.metadata.statistics.totalBytesProcessed;
        dryRunResult = new DryRunSuccess(totalBytesProcessed);
    } catch (error) {
        dryRunResult = new DryRunFailure(error.message);
    }

    dryRunCache.addResult(document, dryRunResult);

    updateDiagnosticsCollection(dryRunCache, diagnosticsCollection);
    updateDryRunItem();
}

async function submitQuery(context: vscode.ExtensionContext, showPreview: boolean): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (typeof activeEditor !== 'undefined') {
        let query: string;

        if (activeEditor.selection.isEmpty) {
            query = activeEditor.document.getText();
        } else {
            const selection = activeEditor.selection;
            query = activeEditor.document.getText(selection)
        }

        const projectId = await getCurrentProjectId();
        const location = getLocation();
        const bqClient = new BigQuery({
            projectId: projectId,
            location: location
        });

        const queryOptions = {
            query: query,
            dryRun: false
        }

        const progressOptions: vscode.ProgressOptions = {
            title: "Running query ...",
            location: vscode.ProgressLocation.Notification
        }

        const task = async () => {
            try {
                const [job] = await bqClient.createQueryJob(queryOptions);
                const jobUri = await getJobUri(job);

                const [rows] = await job.getQueryResults();

                if (showPreview) {
                    createJobPreview(context, bqClient, job);   
                }

                vscode.window
                    .showInformationMessage("Finished running query", "Preview", "Open in Browser")
                    .then(selection => {
                        if (selection === "Preview") {
                            createJobPreview(context, bqClient, job);
                        }
                        if (selection === "Open in Browser") {
                            vscode.env.openExternal(jobUri);
                        }
                    });

                return rows;
            } catch (error) {
                vscode.window.showErrorMessage(error.message);
            }
        }

        vscode.window.withProgress(progressOptions, task);

        resetQueryHistoryTimer(2 * 1000);
    }
}

function resetQueryHistoryTimer(millis: number = 30 * 1000): void {
    clearTimeout(queryHistoryTimer);
    queryHistoryTimer = setTimeout(
        () => {
            queryHistoryProvider.refreshHistory();
            resetQueryHistoryTimer();
        }
        , millis)
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

async function showResourceInConsole(resource: BigQueryResource) {
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

    let uri: vscode.Uri = vscode.Uri.parse(
        `https://console.cloud.google.com/bigquery?${parameterString}`
    );

    if (typeof (uri) != 'undefined') {
        vscode.env.openExternal(uri);
    }
}
