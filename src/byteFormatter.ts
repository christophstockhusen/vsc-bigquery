export function formatBytes(bytes: number, precision: number = 2): string {
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

    return `${parseFloat(n.toPrecision(precision))} ${capacities[capacityIndex]}`
}
