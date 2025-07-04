export enum Movement {
    NONE = 0,
    MOVED = 0b1,
    GROW = 0b10,
    SHRINK = 0b100,
    LEFT = 0b1000,
    UP = 0b10000,
    RIGHT = 0b100000,
    DOWN = 0b1000000,
}

export function calculate(from: Rectangular, change: Rectangular): Movement[] {
    const xchange = change.x - from.x;
    const ychange = change.y - from.y;
    const wchange = change.width - from.width;
    const hchange = change.height - from.height;

    const result: Movement[] = [];

    if (xchange === 0 && ychange === 0 && wchange === 0 && hchange === 0) {
        return [Movement.NONE];
    }

    if (wchange !== 0) {
        if (wchange > 0) {
            result.push(
                Movement.GROW | (xchange < 0 ? Movement.LEFT : Movement.RIGHT)
            );
        } else {
            result.push(
                Movement.SHRINK | (xchange > 0 ? Movement.RIGHT : Movement.LEFT)
            );
        }
    }

    if (hchange !== 0) {
        if (hchange > 0) {
            result.push(
                Movement.GROW | (ychange < 0 ? Movement.UP : Movement.DOWN)
            );
        } else {
            result.push(
                Movement.SHRINK | (ychange > 0 ? Movement.DOWN : Movement.UP)
            );
        }
    }

    if (result.length === 0 && (xchange !== 0 || ychange !== 0)) {
        result.push(Movement.MOVED);
    }

    return result;
}
