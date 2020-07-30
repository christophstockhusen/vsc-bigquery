import * as vscode from 'vscode';
import * as path from 'path';
import { BigQuery, Job } from '@google-cloud/bigquery';
import * as bigquery from './extension';

export class QueryHistoryProvider implements vscode.TreeDataProvider<Query> {
    private bqClient: BigQuery;

    constructor(
        private workspaceRoot: string,
        bqClient: BigQuery
    ) {
        this.bqClient = bqClient;
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
        const [jobs] = await this.bqClient.getJobs({
            maxResults: 100
        });
        const ids = jobs.map(j => j.id);
        const rs = await Promise.all(ids.map(id => this.bqClient.job(id).get().then(r => r[0])));
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

enum JobStatus {
    PENDING,
    RUNNING,
    SUCCESS,
    FAILURE,
}

export class Query extends vscode.TreeItem {
    label: string;
    projectId: string;
    location: string;
    id: string;
    query: string;
    creationTime: number;
    jobStatus: JobStatus;

    constructor(
        projectId: string,
        location: string,
        id: string,
        query: string,
        creationTime: number,
        jobStatus: JobStatus
    ) {
        super(query);
        this.projectId = projectId;
        this.location = location;
        this.id = id;
        this.query = query;
        this.creationTime = creationTime;
        this.label = query.replace(/[\n ]+/g, " ").substr(0, 30);
        this.jobStatus = jobStatus;
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

    get tooltip(): string {
        return this.query;
    }

    get resourceUri(): vscode.Uri {
        return vscode.Uri.parse(
            `https://console.cloud.google.com/bigquery?`
            + `project=${this.projectId}`
            + `&j=bq:${this.location}:${this.id}`
            + `&page=queryresults`
        );
    }

    get iconPath() {
        return {
            light: path.join(__dirname, '..', 'resources', 'light', this.iconName(this.jobStatus)),
            dark: path.join(__dirname, '..', 'resources', 'dark', this.iconName(this.jobStatus))
        }
    }

    private iconName(s: JobStatus): string {
        switch (this.jobStatus) {
            case JobStatus.PENDING:
                return "watch.svg";

            case JobStatus.RUNNING:
                return "loading.svg";

            case JobStatus.SUCCESS:
                return "pass.svg";

            case JobStatus.FAILURE:
            default:
                return "error.svg";
        }
    }
}

function extractJobStatus(job: Job): JobStatus {
    const status = job.metadata.status;

    if (status.state === 'PENDING') {
        return JobStatus.PENDING;
    }

    if (status.state === 'RUNNING') {
        return JobStatus.RUNNING;
    }

    if (typeof (status.errorResult) === 'undefined') {
        return JobStatus.SUCCESS;
    }

    return JobStatus.FAILURE;
}