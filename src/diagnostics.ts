import * as vscode from 'vscode';
import { DryRunCache } from './dryRunCache';
import { DryRunSuccess, DryRunFailure } from './dryRunResult';

export async function updateDiagnosticsCollection(dryRunCache: DryRunCache, diagnosticsCollection: vscode.DiagnosticCollection): Promise<void> {
    const documents = vscode.workspace.textDocuments;

    diagnosticsCollection.clear();
    
    documents.forEach(document => {
        const dryRunResult = dryRunCache.getResult(document);
        if (dryRunResult instanceof DryRunSuccess) {
            diagnosticsCollection.delete(document.uri);
        }
        if (dryRunResult instanceof DryRunFailure) {
            const errorMessage = dryRunResult.errorMessage;
            const errorRange = getErrorRange(document, errorMessage);
            const severity = vscode.DiagnosticSeverity.Error;

            const diagnostics = [new vscode.Diagnostic(errorRange, errorMessage, severity)];
            diagnosticsCollection.set(document.uri, diagnostics);
        }
    }
    );
}

function getErrorRange(document: vscode.TextDocument, errorMessage: string): vscode.Range {
    const regex = /at \[(?<row>\d+):(?<column>\d+)\]/;
    const match = errorMessage.match(regex);

    if (match === null || match.groups === undefined || match.groups.row === undefined) {
        return new vscode.Range(
            new vscode.Position(0, 0),
            document.lineAt(document.lineCount - 1).range.end
        );
    }

    const row = +match.groups.row - 1;
    const column = +match.groups.column - 1;

    const pos = new vscode.Position(row, column);

    return document.getWordRangeAtPosition(pos);
}