export function performWork(work: number): number {
  let result = 0;

  for (let i = 0; i < work; i++) {
    result += (i * 31) % 997;
  }

  return result;
}
