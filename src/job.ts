import * as vscode from 'vscode';
import { Job } from '@google-cloud/bigquery';
import { BigQueryProject, BigQueryTable } from './bigqueryResources';

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

export function getJobId(job: Job): string {
    return job.metadata.jobReference.jobId;
}

export function getJobProject(job: Job): BigQueryProject {
    return new BigQueryProject(job.metadata.jobReference.projectId);
}

export function getJobLocation(job: Job): string {
    return job.location;
}

export function getJobUser(job: Job): string {
    return job.metadata.user_email;
}

export function getJobStatus(job: Job): string {
    return job.metadata.status.state;
}

export function getJobCreationTime(job: Job): Date {
    return new Date(+job.metadata.statistics.creationTime);
}

export function getJobStartTime(job: Job): Date {
    return new Date(+job.metadata.statistics.startTime);
}

export function getJobEndTime(job: Job): Date {
    return new Date(+job.metadata.statistics.endTime);
}

export function getJobDestinationTable(job: Job): BigQueryTable {
    const tableInfo = job.metadata.configuration.query.destinationTable;
    return new BigQueryTable(tableInfo.projectId, tableInfo.datasetId, tableInfo.tableId);
}

export function getJobTotalBytesProcessed(job: Job): number {
    return +job.metadata.statistics.totalBytesProcessed;
}
