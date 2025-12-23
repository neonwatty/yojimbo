#!/usr/bin/env npx tsx
/**
 * E2E Test Coverage Summary
 *
 * Generates a simple report of test counts per feature/page.
 * Run with: npx tsx e2e/coverage-summary.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FeatureCoverage {
  file: string;
  feature: string;
  testCount: number;
  tests: string[];
}

function extractTests(filePath: string): FeatureCoverage[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath, '.spec.ts');
  const results: FeatureCoverage[] = [];

  // Match describe blocks and their tests
  const describeRegex = /test\.describe\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\(\s*\)\s*=>\s*\{/g;
  const testRegex = /test\s*\(\s*['"`]([^'"`]+)['"`]/g;

  // Find all describe blocks with their positions
  const describes: { name: string; start: number; end: number }[] = [];
  let match;

  while ((match = describeRegex.exec(content)) !== null) {
    const start = match.index;
    // Find matching closing brace (simplified - counts braces)
    let braceCount = 0;
    let end = start;
    let inBlock = false;

    for (let i = start; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        inBlock = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (inBlock && braceCount === 0) {
          end = i;
          break;
        }
      }
    }

    describes.push({ name: match[1], start, end });
  }

  // If no describe blocks, treat whole file as one feature
  if (describes.length === 0) {
    const tests: string[] = [];
    while ((match = testRegex.exec(content)) !== null) {
      tests.push(match[1]);
    }
    if (tests.length > 0) {
      results.push({
        file: fileName,
        feature: fileName,
        testCount: tests.length,
        tests,
      });
    }
  } else {
    // Extract tests from each describe block
    for (const describe of describes) {
      const blockContent = content.substring(describe.start, describe.end);
      const tests: string[] = [];

      const blockTestRegex = /test\s*\(\s*['"`]([^'"`]+)['"`]/g;
      while ((match = blockTestRegex.exec(blockContent)) !== null) {
        tests.push(match[1]);
      }

      results.push({
        file: fileName,
        feature: describe.name,
        testCount: tests.length,
        tests,
      });
    }
  }

  return results;
}

function generateReport(): void {
  const specsDir = path.join(__dirname, 'specs');
  const specFiles = fs.readdirSync(specsDir).filter(f => f.endsWith('.spec.ts'));

  const allCoverage: FeatureCoverage[] = [];

  for (const file of specFiles) {
    const filePath = path.join(specsDir, file);
    const coverage = extractTests(filePath);
    allCoverage.push(...coverage);
  }

  // Sort by feature name
  allCoverage.sort((a, b) => a.feature.localeCompare(b.feature));

  // Calculate totals
  const totalTests = allCoverage.reduce((sum, f) => sum + f.testCount, 0);
  const totalFeatures = allCoverage.length;

  // Print report
  console.log('\n' + '═'.repeat(70));
  console.log('  E2E TEST COVERAGE SUMMARY');
  console.log('═'.repeat(70) + '\n');

  // Feature table
  const maxFeatureLen = Math.max(...allCoverage.map(f => f.feature.length), 20);
  const maxFileLen = Math.max(...allCoverage.map(f => f.file.length), 10);

  console.log(
    '  ' +
    'Feature'.padEnd(maxFeatureLen) + '  ' +
    'File'.padEnd(maxFileLen) + '  ' +
    'Tests'
  );
  console.log('  ' + '─'.repeat(maxFeatureLen + maxFileLen + 10));

  for (const coverage of allCoverage) {
    console.log(
      '  ' +
      coverage.feature.padEnd(maxFeatureLen) + '  ' +
      coverage.file.padEnd(maxFileLen) + '  ' +
      String(coverage.testCount).padStart(3)
    );
  }

  console.log('  ' + '─'.repeat(maxFeatureLen + maxFileLen + 10));
  console.log(
    '  ' +
    'TOTAL'.padEnd(maxFeatureLen) + '  ' +
    `${totalFeatures} features`.padEnd(maxFileLen) + '  ' +
    String(totalTests).padStart(3)
  );

  console.log('\n' + '═'.repeat(70));

  // Detailed test list (optional)
  if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
    console.log('\n  DETAILED TEST LIST\n');
    for (const coverage of allCoverage) {
      console.log(`  ${coverage.feature} (${coverage.file}.spec.ts)`);
      for (const test of coverage.tests) {
        console.log(`    • ${test}`);
      }
      console.log('');
    }
  } else {
    console.log('\n  Run with --verbose to see individual test names\n');
  }
}

generateReport();
