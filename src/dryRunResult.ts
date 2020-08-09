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
        const capacities = ["B", "KB", "MB", "GB", "TB", "PB"];
        let n = +bytes;
        let capacityIndex = 0;
        for (let i = 0; i < capacities.length; i++) {
            capacityIndex = i;
            if (n < 1024) {
                break;
            } else {
                n /= 1024;
            }
        }
    
        return `${parseFloat(n.toPrecision(2))} ${capacities[capacityIndex]}`
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
