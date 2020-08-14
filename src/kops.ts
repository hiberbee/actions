import { addPath, exportVariable, getInput, setFailed } from '@actions/core'
import { exec } from '@actions/exec'
import { mv, mkdirP } from '@actions/io'
import { downloadTool } from '@actions/tool-cache'
import path from 'path'
import os from 'os'

const osPlat = os.platform()
const platform = osPlat === 'win32' ? 'windows' : osPlat
const suffix = osPlat === 'win32' ? '.exe' : ''

const kopsVersion = getInput('kops-version') ? `v${getInput('kops-version')}` : 'latest'
const kopsUrl = `https://github.com/kubernetes/kops/releases/download/${kopsVersion}/kops-${platform}-amd64${suffix}`

enum KopsArgs {
  KUBECONFIG = 'kubeconfig',
}

async function download(url: string, destination: string): Promise<string> {
  const downloadPath = await downloadTool(url)
  const destinationDir = path.dirname(destination)
  await mkdirP(destinationDir)
  if (url.endsWith('tar.gz') || url.endsWith('tar') || url.endsWith('tgz')) {
    await exec('tar', ['-xzf', downloadPath, `--strip=1`])
    await mv(path.basename(destination), destinationDir)
  } else {
    await mv(downloadPath, destination)
  }
  await exec('chmod', ['+x', destination])
  addPath(destinationDir)
  return downloadPath
}

function getArgsFromInput(): string[] {
  return getInput('command')
    .split(' ')
    .concat(
      Object.values(KopsArgs)
        .filter(key => getInput(key) !== '')
        .map(key => `--${key}=${getInput(key)}`),
    )
}

async function run(args: string[]): Promise<void> {
  exportVariable('KOPS_CLUSTER_NAME', getInput('cluster-name'))
  exportVariable('KOPS_STATE_STORE', getInput('state-store'))
  try {
    await exec('kops', args)
  } catch (error) {
    setFailed(error.message)
  }
}

download(kopsUrl, `${process.env.HOME}/bin/kops`)
  .then(() => run(['export', 'kubecfg']))
  .then(() => run(getArgsFromInput()))
