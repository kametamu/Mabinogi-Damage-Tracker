import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverSkillFile = path.resolve(__dirname, '../../Mabinogi_Damage_Tracker.Server/skill_ids.cs');
const outputDir = path.resolve(__dirname, '../src/localization/skills');

const source = fs.readFileSync(serverSkillFile, 'utf8');
const enumBlockMatch = source.match(/enum\s+SkillId\s*:\s*ushort\s*\{([\s\S]*?)\n\s*\}/m);

if (!enumBlockMatch) {
  throw new Error('Could not find `enum SkillId : ushort` block in skill_ids.cs');
}

const enumBlock = enumBlockMatch[1]
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

const entryRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(0x[0-9A-Fa-f]+|\d+)\s*,?/g;

const toLabel = (identifier) => identifier
  .replace(/_/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  .trim();

const en = {};
for (const match of enumBlock.matchAll(entryRegex)) {
  const name = match[1];
  const rawValue = match[2];
  const numericValue = rawValue.startsWith('0x')
    ? Number.parseInt(rawValue, 16)
    : Number.parseInt(rawValue, 10);

  if (!Number.isFinite(numericValue)) {
    continue;
  }

  en[String(numericValue)] = toLabel(name);
}

const ja = { ...en };

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'en.json'), `${JSON.stringify(en, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'ja.json'), `${JSON.stringify(ja, null, 2)}\n`);

console.log(`Generated ${Object.keys(en).length} skill mappings from ${path.relative(process.cwd(), serverSkillFile)}`);
