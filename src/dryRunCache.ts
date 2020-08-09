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

    gc(): void {
        const editors = vscode.window.visibleTextEditors;
        const documents = new Set(editors.map(e => e.document));

        const newResults = new Map<vscode.TextDocument, DryRunResult>();
        
        for (const [doc, res] of this._dryRunResults) {
            if (documents.has(doc)) {
                newResults.set(doc, res);
            }
        }

        this._dryRunResults = newResults;
    }
}