import * as vscode from 'vscode';
import { JobStatus } from './job';
import * as path from 'path';
import * as fs from 'fs';

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
            light: path.join(__filename, '..', '..', 'resources', 'light', this.iconName(this.jobStatus)),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', this.iconName(this.jobStatus))
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
