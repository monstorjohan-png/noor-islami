/**
 * إصلاح سطر يحمل محارف دخيلة في ملف.
 * يُستدعى: node scripts/fix-garbled.mjs <file> <lineNumber> <jsonString>
 * سبب وجوده: الطرفية تشوّه العربية عند التحرير المباشر، فنمرّر النص كـ JSON.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [file, lineNo, jsonText] = process.argv.slice(2);
if (!file || !lineNo || jsonText === undefined) {
  console.error('usage: node scripts/fix-garbled.mjs <file> <line> <jsonString>');
  process.exit(1);
}
const lines = readFileSync(file, 'utf8').split(/\r?\n/);
const idx = Number(lineNo) - 1;
lines[idx] = JSON.parse(jsonText);
writeFileSync(file, lines.join('\n'), 'utf8');
console.log(`line ${lineNo} replaced`);
