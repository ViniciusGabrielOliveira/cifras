let _idCounter = Date.now();

export function newId(prefix: string): string {
  return `${prefix}-${++_idCounter}`;
}
