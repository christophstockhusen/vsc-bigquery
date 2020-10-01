import * as vscode from 'vscode';
import * as path from 'path';
import { BigQuery } from '@google-cloud/bigquery';
import { Resource } from '@google-cloud/resource';
import { google, cloudresourcemanager_v1, serviceusage_v1 } from 'googleapis';
import { auth, GoogleAuth, JWT, Compute, UserRefreshClient } from 'google-auth-library';
import bigquery from '@google-cloud/bigquery/build/src/types';

export class BigQueryResourceProvider implements vscode.TreeDataProvider<BigQueryResource> {
    private bqClient: BigQuery;
    private resourceClient: Resource;
    private cloudResourceManager: cloudresourcemanager_v1.Cloudresourcemanager;

    constructor(private workspaceRoot: string) {
        this.bqClient = new BigQuery();
        this.resourceClient = new Resource();
        this.cloudResourceManager = google.cloudresourcemanager('v1');
    }

    private _onDidChangeTreeData: vscode.EventEmitter<BigQueryResource | undefined> = new vscode.EventEmitter<BigQueryResource | undefined>()
    readonly onDidChangeTreeData: vscode.Event<BigQueryResource | undefined> = this._onDidChangeTreeData.event;

    refreshAllResources(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: BigQueryResource): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    private async authorize() {
        return new GoogleAuth({
            scopes: [
                'https://www.googleapis.com/auth/cloud-platform',
                'https://www.googleapis.com/auth/cloud-platform.read-only'
            ]
        });
    }

    private async fetchProjectIds(): Promise<string[]> {
        return this.resourceClient.getProjects()
            .then(ps => ps[0])
            .then(ps => ps.map(p => p.id))
    }

    getChildren(element?: BigQueryResource): vscode.ProviderResult<BigQueryResource[]> {

        if (!element) {
            return this.fetchProjectIds()
                .then(ids => ids.sort().map(id => new BigQueryProject(id)))
        }

        this.bqClient.projectId = element.projectId;

        if (element instanceof BigQueryProject) {
            return this.bqClient.getDatasets()
                .then(res => res[0])
                .then(datasets => datasets.map(d => d.id))
                .then(datasets => datasets.sort())
                .then(datasetIds => datasetIds.map(datasetId => new BigQueryDataset(element.projectId, datasetId)));
        }

        if (element instanceof BigQueryDataset) {
            return this.bqClient.dataset(element.datasetId).getTables()
                .then(res => res[0])
                .then(tables => tables.map(d => d.id))
                .then(tableIds => tableIds.map(tableId => new BigQueryTable(element.projectId, element.datasetId, tableId)));
        }

        if (element instanceof BigQueryTable) {
            return this.bqClient.dataset(element.datasetId).table(element.tableId).getMetadata()
                .then(res => res[0])
                .then(m => m.schema)
                .then(s => s.fields || [])
                .then(fs => fs.map(f =>
                    new BigQueryTableField(element.projectId, element.datasetId, element.tableId, f.name, f.type)))
        }
    }

    getParent?(element: BigQueryResource): vscode.ProviderResult<BigQueryResource> {
        throw new Error("Method not implemented.");
    }
}

class BigQueryResource extends vscode.TreeItem {
    projectId: string;

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed
    ) {
        super(label, collapsibleState);
        this.projectId = label;
    }

    get tooltip(): string {
        return this.label;
    }

    get description(): string {
        return "";
    }
}

export class BigQueryProject extends BigQueryResource {
    constructor(
        public readonly projectId: string
    ) {
        super(projectId)
    }

    get contextValue(): string {
        return "project";
    }

    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'light', 'database.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'database.svg')
    }

}

export class BigQueryDataset extends BigQueryResource {
    constructor(
        public readonly projectId: string,
        public readonly datasetId: string
    ) {
        super(datasetId)
    }

    get contextValue(): string {
        return "dataset";
    }

    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'light', 'folder.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'folder.svg')
    }
}

export class BigQueryTable extends BigQueryResource {
    constructor(
        public readonly projectId: string,
        public readonly datasetId: string,
        public readonly tableId: string
    ) {
        super(tableId)
    }

    get contextValue(): string {
        return "table";
    }

    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'light', 'list-flat.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'list-flat.svg')
    }
}

export class BigQueryTableField extends BigQueryResource {
    constructor(
        public readonly projectId: string,
        public readonly datasetId: string,
        public readonly tableId: string,
        public readonly fieldName: string,
        public readonly dataType: string
    ) {
        super(fieldName, vscode.TreeItemCollapsibleState.None)
    }

    get contextValue(): string {
        return "field";
    }

    get description(): string {
        return this.dataType;
    }

    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'light', 'symbol-field.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'symbol-field.svg')
    }
}
