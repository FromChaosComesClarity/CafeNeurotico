#!/usr/bin/env node
'use strict';
/*
 * Fetches the prebuilt Linux helper binaries (ffmpeg, ffprobe, yt-dlp, gogdl,
 * legendary, comet) that the suite needs at runtime but that are too large to
 * keep in git. They live as a single checksum-pinned tarball on a GitHub
 * Release of this repo.
 *
 * Idempotent: if all binaries are already present it does nothing, so local
 * builds never re-download. Runs from `postinstall` and before `dist`.
 *
 * Linux-only by design (the suite ships a Linux AppImage); relies on `curl`
 * and `tar`, which are present on any Linux dev box.
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN_DIR   = join(__dirname, '..', 'assets', 'bin', 'linux');

const REQUIRED = ['ffmpeg', 'ffprobe', 'yt-dlp', 'gogdl', 'legendary', 'comet'];

// Pinned release asset + its SHA256. Bump the tag and hash together when the
// binary set changes.
const URL    = 'https://github.com/shampoo-is-a-lie/CafeNeurotico/releases/download/binaries-v1/cafeneurotico-binaries-v1.tar.gz';
const SHA256 = '15b7eb24f906339bd002e864b35426b7a6bfe966cc8226456553f517f3df39b2';

function allPresent() {
    return REQUIRED.every(name => existsSync(join(BIN_DIR, name)));
}

function sha256(file) {
    return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function main() {
    if (allPresent()) {
        console.log('• helper binaries already present — skipping fetch');
        return;
    }

    console.log('• fetching helper binaries from release …');
    mkdirSync(BIN_DIR, { recursive: true });
    const tmp = join(tmpdir(), 'cafeneurotico-binaries.tar.gz');

    try {
        execFileSync('curl', ['-fL', '--retry', '3', '-o', tmp, URL], { stdio: 'inherit' });
    } catch {
        console.error(`\n✗ download failed: ${URL}\n  Check the release exists, then re-run \`npm run fetch-bin\`.`);
        process.exit(1);
    }

    const got = sha256(tmp);
    if (got !== SHA256) {
        rmSync(tmp, { force: true });
        console.error(`\n✗ checksum mismatch\n  expected ${SHA256}\n  got      ${got}`);
        process.exit(1);
    }

    execFileSync('tar', ['-xzf', tmp, '-C', BIN_DIR], { stdio: 'inherit' });
    execFileSync('chmod', ['+x', ...REQUIRED.map(n => join(BIN_DIR, n))]);
    rmSync(tmp, { force: true });

    if (!allPresent()) {
        console.error('\n✗ extraction completed but some binaries are still missing');
        process.exit(1);
    }
    console.log('• helper binaries ready');
}

main();
