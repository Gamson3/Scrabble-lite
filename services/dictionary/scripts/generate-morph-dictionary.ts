import https from 'https';
import path from 'path';
import { promises as fs } from 'fs';

const DEFAULT_WORDLIST_URL =
  process.env.WORDLIST_URL ?? 'https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(PROJECT_ROOT, './src/data');
const OUTPUT_FILE = path.resolve(DATA_DIR, 'words.json');

interface CliOptions {
  inputPath?: string;
  minDegree: number;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rawWords = options.inputPath
    ? await loadFromDisk(options.inputPath)
    : await downloadWordList(DEFAULT_WORDLIST_URL);

  const filtered = filterFiveLetterWords(rawWords);
  if (filtered.length === 0) {
    throw new Error('No 5-letter alphabetic words found in source list.');
  }

  console.log(`Loaded ${filtered.length.toLocaleString()} 5-letter candidates.`);

  const adjacency = buildAdjacency(filtered);
  console.log('Built adjacency graph.');

  pruneSparseNodes(adjacency, options.minDegree);
  console.log(`After pruning, ${adjacency.size.toLocaleString()} highly-connected words remain.`);

  const component = largestConnectedComponent(adjacency);
  if (component.length === 0) {
    throw new Error('Largest component is empty. Try lowering the minimum degree.');
  }

  component.sort();
  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify({ words: component }, null, 2) + '\n',
    'utf-8'
  );

  console.log('✅ Morph-optimized dictionary generated');
  console.log(`   Words saved: ${component.length.toLocaleString()}`);
  console.log(`   Output file: ${OUTPUT_FILE}`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { minDegree: 2 };
  for (const arg of argv) {
    if (arg.startsWith('--input=')) {
      options.inputPath = path.resolve(process.cwd(), arg.split('=')[1]);
    } else if (arg.startsWith('--min-degree=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isNaN(value) && value >= 1) {
        options.minDegree = value;
      }
    }
  }
  return options;
}

async function loadFromDisk(filePath: string): Promise<string[]> {
  const contents = await fs.readFile(filePath, 'utf-8');
  return contents.split(/\r?\n/);
}

async function downloadWordList(url: string): Promise<string[]> {
  console.log(`Downloading word list from ${url} ...`);
  const data = await new Promise<string>((resolve, reject) => {
    https
      .get(url, response => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`Failed with status ${response.statusCode}`));
          return;
        }

        let raw = '';
        response.setEncoding('utf-8');
        response.on('data', chunk => {
          raw += chunk;
        });
        response.on('end', () => resolve(raw));
      })
      .on('error', reject);
  });

  return data.split(/\r?\n/);
}

function filterFiveLetterWords(words: string[]): string[] {
  const pattern = /^[a-z]{5}$/i;
  const seen = new Set<string>();
  for (const word of words) {
    const trimmed = word.trim();
    if (pattern.test(trimmed)) {
      seen.add(trimmed.toLowerCase());
    }
  }
  return Array.from(seen);
}

function buildAdjacency(words: string[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  const patternBuckets = new Map<string, string[]>();

  for (const word of words) {
    adjacency.set(word, new Set());
    for (let i = 0; i < word.length; i += 1) {
      const pattern = `${word.slice(0, i)}*${word.slice(i + 1)}`;
      const bucket = patternBuckets.get(pattern);
      if (bucket) {
        bucket.push(word);
      } else {
        patternBuckets.set(pattern, [word]);
      }
    }
  }

  for (const bucket of patternBuckets.values()) {
    if (bucket.length < 2) continue;
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const a = bucket[i];
        const b = bucket[j];
        adjacency.get(a)?.add(b);
        adjacency.get(b)?.add(a);
      }
    }
  }

  return adjacency;
}

function pruneSparseNodes(adjacency: Map<string, Set<string>>, minDegree: number) {
  if (minDegree <= 1) return;

  while (true) {
    const toRemove: string[] = [];

    for (const [word, neighbors] of adjacency.entries()) {
      for (const neighbor of neighbors) {
        if (!adjacency.has(neighbor)) {
          neighbors.delete(neighbor);
        }
      }

      if (neighbors.size < minDegree) {
        toRemove.push(word);
      }
    }

    if (toRemove.length === 0) {
      break;
    }

    for (const word of toRemove) {
      adjacency.delete(word);
    }
  }
}

function largestConnectedComponent(adjacency: Map<string, Set<string>>): string[] {
  const visited = new Set<string>();
  let largest: string[] = [];

  for (const word of adjacency.keys()) {
    if (visited.has(word)) continue;

    const queue = [word];
    const component: string[] = [];
    visited.add(word);

    while (queue.length) {
      const current = queue.shift()!;
      component.push(current);
      const neighbors = adjacency.get(current);
      if (!neighbors) continue;
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && adjacency.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (component.length > largest.length) {
      largest = component;
    }
  }

  return largest;
}

main().catch(error => {
  console.error('❌ Failed to generate dictionary');
  console.error(error);
  process.exitCode = 1;
});
