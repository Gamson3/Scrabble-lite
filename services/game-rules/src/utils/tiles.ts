const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function createTileBag(): string[] {
  const bag: string[] = [];
  for (const ch of LETTERS) {
    for (let i = 0; i < 4; i++) {
      bag.push(ch);
    }
  }
  return bag;
}

export function drawTiles(bag: string[], count: number): { drawn: string[]; remaining: string[] } {
  const remaining = [...bag];
  const drawn: string[] = [];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const idx = Math.floor(Math.random() * remaining.length);
    drawn.push(remaining.splice(idx, 1)[0]);
  }
  return { drawn, remaining };
}
