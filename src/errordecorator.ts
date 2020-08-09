import * as vscode from 'vscode';
import * as path from 'path';
import { isNull } from 'util';

export const errorDecorationType = vscode.window.createTextEditorDecorationType({
    overviewRulerColor: new vscode.ThemeColor("editorOverviewRuler.errorForeground"),
    light: {
        gutterIconPath: path.join(__filename, '..', '..', 'resources', 'light', 'error.svg'),
    },
    dark: {
        gutterIconPath: path.join(__filename, '..', '..', 'resources', 'dark', 'error.svg'),
    }
});

export function getErrorRange(errorMessage: string): vscode.Range {
    const regex = /\[(?<row>\d+):(?<column>\d+)\]/;
    const match = errorMessage.match(regex);
    
    if (match === null || match.groups === undefined || match.groups.row === undefined) {
        return null;
    }

    const row = +match.groups.row - 1;

    return new vscode.Range(
        new vscode.Position(row, 0),
        new vscode.Position(row, 0)
    )
}

export function setErrorDecorations(document: vscode.TextDocument, ranges: vscode.Range[] = []): void {
    const editors = vscode.window.visibleTextEditors;
    editors.forEach(e => {
        if (e.document === document) {
            e.setDecorations(errorDecorationType, ranges);
        }
    });
}
