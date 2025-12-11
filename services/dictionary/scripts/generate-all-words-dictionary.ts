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
  minLength: number;
  maxLength?: number;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rawWords = options.inputPath
    ? await loadFromDisk(options.inputPath)
    : await downloadWordList(DEFAULT_WORDLIST_URL);

  const filtered = filterValidWords(rawWords, options.minLength, options.maxLength);
  if (filtered.length === 0) {
    throw new Error(`No valid alphabetic words found matching criteria (min: ${options.minLength}${options.maxLength ? `, max: ${options.maxLength}` : ''}).`);
  }

  filtered.sort();
  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify({ words: filtered }, null, 2) + '\n',
    'utf-8'
  );

  console.log('✅ Comprehensive dictionary generated');
  console.log(`   Total words: ${filtered.length.toLocaleString()}`);
  console.log(`   Min length: ${options.minLength}`);
  if (options.maxLength) {
    console.log(`   Max length: ${options.maxLength}`);
  }
  console.log(`   Output file: ${OUTPUT_FILE}`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { minLength: 1 };
  for (const arg of argv) {
    if (arg.startsWith('--input=')) {
      options.inputPath = path.resolve(process.cwd(), arg.split('=')[1]);
    } else if (arg.startsWith('--min-length=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isNaN(value) && value >= 1) {
        options.minLength = value;
      }
    } else if (arg.startsWith('--max-length=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isNaN(value) && value >= 1) {
        options.maxLength = value;
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

/**
 * Filter words by length and validity
 * Accepts all valid alphabetic words within the specified length range
 * @param words Raw word list from source
 * @param minLength Minimum word length (default 1)
 * @param maxLength Optional maximum word length
 * @returns Filtered and deduplicated words
 */
function filterValidWords(
  words: string[],
  minLength: number = 1,
  maxLength?: number
): string[] {
  const pattern = /^[a-z]+$/i;
  const seen = new Set<string>();

  for (const word of words) {
    const trimmed = word.trim().toLowerCase();

    // Check if word matches pattern and length constraints
    if (!pattern.test(trimmed)) {
      continue;
    }

    if (trimmed.length < minLength) {
      continue;
    }

    if (maxLength && trimmed.length > maxLength) {
      continue;
    }

    seen.add(trimmed);
  }

  return Array.from(seen);
}

main().catch(error => {
  console.error('❌ Failed to generate dictionary');
  console.error(error);
  process.exitCode = 1;
});
