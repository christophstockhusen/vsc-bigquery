import * as vscode from 'vscode';
import { BigQuery, Job } from '@google-cloud/bigquery';
import { Query } from './query';
import { extractJobStatus } from './job';
import { getCurrentProjectId } from './extension';

export class QueryHistoryProvider implements vscode.TreeDataProvider<Query> {

    constructor(
        private workspaceRoot: string,
    ) {
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
        const maxResults = +vscode.workspace
            .getConfiguration('bigquery')
            .get("queryHistory.maxEntries");

        const projectId = await getCurrentProjectId();
        const bqClient = new BigQuery({ projectId: projectId });

        const [jobs] = await bqClient.getJobs({
            maxResults: maxResults
        });
        const ids = jobs.map(j => j.id);
        const rs = await Promise.all(ids.map(id => bqClient.job(id).get().then(r => r[0])));
        const qs = rs
            .filter(f => f.metadata.configuration.jobType === "QUERY")
            .map(r => new Query(
                r.metadata.jobReference.projectId,
                r.metadata.jobReference.location,
                r.metadata.jobReference.jobId,
                r.metadata.configuration.query.query,
                r.metadata.statistics.creationTime,
                extractJobStatus(r)))
            .sort((a, b) => b.creationTime - a.creationTime);

        return qs;
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
