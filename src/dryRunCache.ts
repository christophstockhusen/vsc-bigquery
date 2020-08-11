import * as vscode from 'vscode';
import { DryRunResult } from "./dryRunResult";

export class DryRunCache {
    private _dryRunResults: Map<vscode.TextDocument, DryRunResult>;

    constructor() {
        this._dryRunResults = new Map<vscode.TextDocument, DryRunResult>();
    }

    addResult(document: vscode.TextDocument, result: DryRunResult): void {
        this._dryRunResults.set(document, result);
    }

    getResult(document: vscode.TextDocument): DryRunResult {
        return this._dryRunResults.get(document); 
    }

    remove(document: vscode.TextDocument): void {
        this._dryRunResults.delete(document);
    }

    gc(): void {
        const documents = new Set(vscode.workspace.textDocuments);
        const newResults = new Map<vscode.TextDocument, DryRunResult>();
        
        for (const [doc, res] of this._dryRunResults) {
            if (documents.has(doc)) {
                newResults.set(doc, res);
            }
        }

        this._dryRunResults = newResults;
    }
}