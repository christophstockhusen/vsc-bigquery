import { formatBytes } from './byteFormatter';

export abstract class DryRunResult {}

export class DryRunSuccess extends DryRunResult {
    private _processedBytes: number;

    constructor(processedBytes: number) {
        super();
        this._processedBytes = processedBytes
    }

    get processedBytes(): string {
        return this.formatProcessedBytes(this._processedBytes);
    }

    private formatProcessedBytes(bytes: number): string {
        return formatBytes(bytes);
    }
}

export class DryRunFailure extends DryRunResult {
    private _errorMessage: string;
    
    constructor(errorMessage: string) {
        super();
        this._errorMessage = errorMessage;
    }

    get errorMessage(): string {
        return this._errorMessage;
    }
}
