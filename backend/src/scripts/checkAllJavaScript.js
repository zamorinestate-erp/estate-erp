'use strict';

const fs = require('fs');
const path = require('path');
const {
  spawnSync,
} = require('child_process');

const SOURCE_DIRECTORY = path.resolve(
  __dirname,
  '..'
);

function findJavaScriptFiles(directory) {
  const entries = fs.readdirSync(
    directory,
    {
      withFileTypes: true,
    }
  );

  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(
      directory,
      entry.name
    );

    if (entry.isDirectory()) {
      files.push(
        ...findJavaScriptFiles(entryPath)
      );

      continue;
    }

    if (
      entry.isFile() &&
      entry.name.endsWith('.js')
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

function checkFile(filePath) {
  const result = spawnSync(
    process.execPath,
    [
      '--check',
      filePath,
    ],
    {
      encoding: 'utf8',
    }
  );

  return {
    filePath,
    success: result.status === 0,
    output:
      result.stderr ||
      result.stdout ||
      '',
  };
}

function runChecks() {
  const files =
    findJavaScriptFiles(
      SOURCE_DIRECTORY
    );

  const failures = [];

  for (const filePath of files) {
    const result =
      checkFile(filePath);

    const relativePath =
      path.relative(
        process.cwd(),
        filePath
      );

    if (result.success) {
      console.log(
        `PASS ${relativePath}`
      );
    } else {
      failures.push(result);

      console.error(
        `FAIL ${relativePath}`
      );

      console.error(
        result.output.trim()
      );
    }
  }

  console.log('');

  console.log(
    `Checked ${files.length} JavaScript files.`
  );

  if (failures.length > 0) {
    console.error(
      `${failures.length} file(s) failed syntax validation.`
    );

    process.exitCode = 1;

    return;
  }

  console.log(
    'All backend JavaScript files passed syntax validation.'
  );
}

runChecks();