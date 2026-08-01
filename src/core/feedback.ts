import type { ToolResult } from '../types';

export interface TestFailure {
  testName: string;
  error: string;
  expected?: string;
  actual?: string;
}

export interface Feedback {
  verdict: 'pass' | 'fail' | 'neutral';
  shouldStop: boolean;
  summary: string;
  failures?: TestFailure[];
}

export function validateFeedback(result: ToolResult): Feedback {
  if (result.tool !== 'run_test') {
    return { verdict: 'neutral', shouldStop: false, summary: `Executed ${result.tool}: ${result.success ? 'success' : 'failed'}` };
  }

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';

  if (!stdout.trim() && !stderr.trim()) {
    return { verdict: 'neutral', shouldStop: false, summary: 'No test output produced' };
  }

  const failures = parseTestFailures(stdout + '\n' + stderr);

  if (result.exitCode === 0 && failures.length === 0) {
    const passedMatch = stdout.match(/(\d+)\s+passed/);
    const passed = passedMatch ? parseInt(passedMatch[1], 10) : 'all';
    return { verdict: 'pass', shouldStop: true, summary: `${passed} tests passed` };
  }

  return { verdict: 'fail', shouldStop: false, summary: `${failures.length} test(s) failed`, failures };
}

function parseTestFailures(output: string): TestFailure[] {
  const failures: TestFailure[] = [];
  const lines = output.split('\n');
  let currentFailure: Partial<TestFailure> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const jestFailMatch = line.match(/^\s*[xX]\s+(.+)$/);
    const mochaFailMatch = line.match(/^\d+\)\s+(.+):$/);
    const vitestFailMatch = line.match(/^\s*FAIL\s+(.+)\s+>\s+(.+)$/);

    if (jestFailMatch) {
      if (currentFailure && currentFailure.testName) failures.push(currentFailure as TestFailure);
      currentFailure = { testName: jestFailMatch[1].trim() };
    } else if (mochaFailMatch) {
      if (currentFailure && currentFailure.testName) failures.push(currentFailure as TestFailure);
      currentFailure = { testName: mochaFailMatch[1].trim() };
    } else if (vitestFailMatch) {
      if (currentFailure && currentFailure.testName) failures.push(currentFailure as TestFailure);
      currentFailure = { testName: `${vitestFailMatch[1]} > ${vitestFailMatch[2]}`.trim() };
    } else if (currentFailure && line.startsWith('Expected:')) {
      currentFailure.expected = line.replace('Expected:', '').trim();
    } else if (currentFailure && line.startsWith('Received:')) {
      currentFailure.actual = line.replace('Received:', '').trim();
    } else if (currentFailure && line && !line.startsWith('PASS') && !line.startsWith('Tests:')) {
      if (!currentFailure.error) {
        currentFailure.error = line;
      } else if (currentFailure.error.length < 500) {
        currentFailure.error += '\n' + line;
      }
    }
  }

  if (currentFailure && currentFailure.testName) {
    failures.push(currentFailure as TestFailure);
  }

  if (failures.length === 0 && output.match(/\d+\s+fail/) && !output.match(/\d+\s+passed/)) {
    failures.push({ testName: 'unknown', error: output.slice(0, 500) });
  }

  return failures;
}