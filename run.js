const core = require('@actions/core');
const github = require('@actions/github');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { globSync } = require('glob');

async function run() {
    try {
        const applySafe = core.getInput('apply-safe-fixes') === 'true';
        const failOnInferred = core.getInput('fail-on-inferred') === 'true';
        const failOnLint = core.getInput('fail-on-lint') === 'true';
        const dryRun = core.getInput('dry-run') === 'true';
        const maxFiles = parseInt(core.getInput('max-files') || '50', 10);
        const skipPathsStr = core.getInput('skip-paths') || '';
        const skipPathsArr = skipPathsStr.split(',').map(s => s.trim()).filter(Boolean);
        const token = core.getInput('github-token');

        const context = github.context;
        const octokit = github.getOctokit(token);

        // 1. Find Markdown files (strictly ignoring dependencies)
        const ignorePatterns = [
            '**/node_modules/**',
            '**/venv/**',
            '**/cli/node_modules/**',
            '**/github-action/**',
            ...skipPathsArr
        ];

        const files = globSync('**/*.{md,mdx}', { ignore: ignorePatterns });

        console.log(`DeMarkX: Found ${files.length} Markdown files for processing.`);

        if (files.length > maxFiles) {
            core.warning(`DeMarkX: Found ${files.length} files, but max-files is set to ${maxFiles}. Only the first ${maxFiles} will be processed.`);
        }

        const filesToProcess = files.slice(0, maxFiles);
        filesToProcess.forEach(f => console.log(`  - Processing: ${f}`));

        let allSafeFixes = [];
        let allInferredFixes = [];
        let allLintIssues = [];
        let filesWithIssues = [];

        const cliPath = path.resolve(__dirname, '../cli/index.js');

        for (const file of filesToProcess) {
            const args = ['fix', file, '--json'];

            // Run CLI
            const result = spawnSync('node', [cliPath, ...args], { encoding: 'utf-8' });

            if (result.status !== 0 && result.status !== 1) {
                console.error(`Error processing ${file}: ${result.stderr}`);
                continue;
            }

            try {
                const report = JSON.parse(result.stdout);
                const { fixReport, fixedMarkdown } = report;

                const hasInferred = fixReport.inferredFixes.length > 0;
                const hasLint = fixReport.lintIssues.length > 0;
                const hasSafe = fixReport.safeFixes.length > 0;

                if (hasSafe || hasInferred || hasLint) {
                    filesWithIssues.push({
                        file,
                        ...fixReport
                    });

                    allSafeFixes.push(...fixReport.safeFixes);
                    allInferredFixes.push(...fixReport.inferredFixes);
                    allLintIssues.push(...fixReport.lintIssues);

                    // Auto-apply safe fixes if enabled
                    if (applySafe && hasSafe) {
                        if (dryRun) {
                            console.log(`[DRY RUN] Would apply safe fixes to ${file}`);
                        } else {
                            fs.writeFileSync(file, fixedMarkdown);
                            console.log(`Applied safe fixes to ${file}`);
                        }
                    }
                }
            } catch (e) {
                console.error(`Failed to parse report for ${file}: ${e.message}`);
            }
        }

        // 2. Handle PR Comment
        if (context.payload.pull_request && filesWithIssues.length > 0) {
            const comment = formatComment(allSafeFixes, allInferredFixes, allLintIssues);

            await octokit.rest.issues.createComment({
                ...context.repo,
                issue_number: context.payload.pull_request.number,
                body: comment
            });
        }

        // 3. Set Status
        if ((failOnInferred && allInferredFixes.length > 0) || (failOnLint && allLintIssues.length > 0)) {
            core.setFailed('DeMarkX found issues that require attention.');
        } else {
            console.log('DeMarkX: No critical issues found.');
        }

    } catch (error) {
        core.setFailed(error.message);
    }
}

function formatComment(safe, inferred, lint) {
    let body = `### DeMarkX Report:\n`;
    body += `✓ ${safe.length} safe fixes applied\n`;
    body += `⚠ ${inferred.length} inferred fix${inferred.length === 1 ? '' : 'es'} require${inferred.length === 1 ? 's' : ''} approval\n`;
    body += `✗ ${lint.length} lint issue${lint.length === 1 ? '' : 's'} must be fixed manually\n\n`;

    body += `#### Details:\n`;
    const all = [...safe, ...inferred, ...lint];
    all.slice(0, 15).forEach(issue => {
        body += `- ${issue.message}\n`;
    });

    if (all.length > 15) {
        body += `\n*...and ${all.length - 15} more issues.*`;
    }

    body += `\n\n> [!TIP]\n> Run \`demarkx fix <file> -v\` locally to see a detailed report.`;

    return body;
}

run();
