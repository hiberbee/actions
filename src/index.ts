import { basename, dirname, join } from 'path'
import { platform } from 'os'
import { downloadTool } from '@actions/tool-cache'
import { mkdirP, mv } from '@actions/io'
import { exec } from '@actions/exec'
import { addPath } from '@actions/core'

export function getBinDir(rootDir: string): string {
  return join(rootDir, 'bin')
}

export function getOsPlatform(): string {
  return platform() === 'win32' ? 'windows' : platform().toLowerCase()
}

export function getWorkspaceDir(): string {
  return process.env.GITHUB_WORKSPACE ?? join(__dirname, '..')
}

export async function download(url: string, destination: string): Promise<string> {
  const downloadPath = await downloadTool(url)
  const destinationDir = dirname(destination)
  await mkdirP(destinationDir)
  if (url.endsWith('tar.gz') || url.endsWith('tar') || url.endsWith('tgz')) {
    await exec('tar', ['-xzf', downloadPath, `--strip=1`])
    await mv(basename(destination), destinationDir)
  } else {
    await mv(downloadPath, destination)
  }
  await exec('chmod', ['+x', destination])
  addPath(destinationDir)
  return downloadPath
}
