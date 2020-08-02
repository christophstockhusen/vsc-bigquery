import * as vscode from 'vscode';
import { Job } from '@google-cloud/bigquery';

export enum JobStatus {
    PENDING,
    RUNNING,
    SUCCESS,
    FAILURE,
}

export function extractJobStatus(job: Job): JobStatus {
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

export async function getJobUri(job: Job): Promise<vscode.Uri> {
    const [metadata] = await job.getMetadata();
    const {projectId, jobId, location} = metadata.jobReference;

    return vscode.Uri.parse(
        `https://console.cloud.google.com/bigquery?`
        + `project=${projectId}`
        + `&j=bq:${location}:${jobId}`
        + `&page=queryresults`
    );
}