import * as vscode from 'vscode';
import { BigQuery } from '@google-cloud/bigquery';

export class QueryHistoryProvider implements vscode.TreeDataProvider<Query> {
    private bqClient: BigQuery;

    constructor(private workspaceRoot: string) {
        this.bqClient = new BigQuery();
    }

    private _onDidChangeTreeData: vscode.EventEmitter<void | Query> = new vscode.EventEmitter<void | Query>()
    readonly onDidChangeTreeData: vscode.Event<void | Query> = this._onDidChangeTreeData.event;

    refreshHistory(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: Query): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getQueries() {
        const [jobs] = await this.bqClient.getJobs();
        const ids = jobs.map(j => j.id);
        const rs = await Promise.all(ids.map(id => this.bqClient.job(id).get().then(r => r[0])));
        const qs = rs
            .filter(f => f.metadata.configuration.jobType === "QUERY")
            .map(r => [
                r.metadata.configuration.query.query,
                r.metadata.statistics.creationTime
            ])
            .sort((a, b) => b[1] - a[1]);

        return qs.map(q => new Query(q[0], q[1]));
    }

    getChildren(element?: Query): vscode.ProviderResult<Query[]> {
        if (!element) {
            return this.getQueries();
        }
        throw new Error("Method not implemented.");
    }

    getParent?(element: Query): vscode.ProviderResult<Query> {
        throw new Error("Method not implemented.");
    }

}

export class Query extends vscode.TreeItem {
    label: string;
    query: string;
    creationTime: number;

    constructor(query: string, creationTime: number) {
        super(query);
        this.query = query;
        this.label = query.replace(/[\n ]+/g, " ").substr(0, 30);
        this.creationTime = creationTime;
    }

    get description(): string {
        const date = new Date();
        date.setTime(this.creationTime);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const res = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
        return res;
    }
}
