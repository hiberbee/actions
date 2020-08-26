import { exportVariable, getInput, setFailed } from '@actions/core'
import { exec } from '@actions/exec'
import { join } from 'path'
import { download, getBinDir, getOsPlatform } from './index'

// noinspection JSUnusedGlobalSymbols
enum KopsArgs {
  KUBECONFIG = 'kubeconfig',
}

const binDir = getBinDir()
const platform = getOsPlatform()
/**
 * @return arguments
 */
function getArgsFromInput(): string[] {
  return getInput('command')
    .split(' ')
    .concat(
      Object.values(KopsArgs)
        .filter(key => getInput(key) !== '')
        .map(key => `--${key}=${getInput(key)}`),
    )
}

export async function run(): Promise<void> {
  const kopsVersion = getInput('kops-version') ? `${getInput('kops-version')}` : '1.18.0'
  const kopsUrl = `https://github.com/kubernetes/kops/releases/download/v${kopsVersion}/kops-${platform}-amd64`

  try {
    exportVariable('KOPS_CLUSTER_NAME', getInput('cluster-name'))
    exportVariable('KOPS_STATE_STORE', getInput('state-store'))
    await download(kopsUrl, join(binDir, 'kops'))
    await exec('kops', ['export', 'kubecfg'])
    await exec('kops', getArgsFromInput())
  } catch (error) {
    setFailed(error.message)
  }
}

// noinspection JSIgnoredPromiseFromCall
run()
