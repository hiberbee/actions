import { getInput, setFailed, exportVariable, setOutput, error } from '@actions/core'
import { exec, ExecOptions } from '@actions/exec'
import { cacheDir } from '@actions/tool-cache'
import { join } from 'path'
import { download, getBinDir, getOsPlatform, getWorkspaceDir } from './index'

// noinspection JSUnusedGlobalSymbols
enum MinikubeArgs {
  WAIT = 'wait',
  AUTO_UPDATE_DRIVERS = 'auto-update-drivers',
  INTERACTIVE = 'interactive',
  DELETE_ON_FAILURE = 'delete-on-failure',
  CPUS = 'cpus',
  NODES = 'nodes',
  NETWORK_PLUGIN = 'network-plugin',
  KUBERNETES_VERSION = 'kubernetes-version',
}

const homeDir = getWorkspaceDir()
const binDir = getBinDir(homeDir)
const minikubeHomeDir = join(homeDir, '.minikube')
const platform = getOsPlatform()
const suffix = platform === 'win32' ? '.exe' : ''

function getArgsFromInput(): string[] {
  const addons = getInput('addons')
    .split(',')
    .filter((item) => item !== '')
  return ['start', '--embed-certs']
    .concat(
      Object.values(MinikubeArgs)
        .filter((key) => getInput(key) !== '')
        .map((key) => `--${key}=${getInput(key)}`),
    )
    .concat(addons.length > 0 ? addons.map((key) => `--addons=${key}`) : '')
}

async function run(): Promise<void> {
  const minikubeVersion = getInput('minikube-version')
  const kubernetesVersion = getInput('kubernetes-version')
  const minikubeUrl = `https://github.com/kubernetes/minikube/releases/download/v${minikubeVersion}/minikube-${platform}-amd64${suffix}`
  const kubectlUrl = `https://storage.googleapis.com/kubernetes-release/release/v${kubernetesVersion}/bin/${platform}/amd64/kubectl${suffix}`
  const options: ExecOptions = {}
  const profile = getInput('profile')

  try {
    exportVariable('MINIKUBE_PROFILE_NAME', profile)
    exportVariable('MINIKUBE_HOME', minikubeHomeDir)
    options.listeners = {
      stdout: (data) => {
        const ip = data.toString().trim()
        exportVariable('DOCKER_HOST', `tcp://${ip}:2376`)
        exportVariable('DOCKER_TLS_VERIFY', '1')
        exportVariable('DOCKER_CERT_PATH', join(minikubeHomeDir, 'certs'))
        exportVariable('MINIKUBE_ACTIVE_DOCKERD', profile)
        setOutput('ip', ip)
      },
      stderr: (data: Buffer) => {
        error(data.toString())
      },
    }
    await download(minikubeUrl, join(binDir, 'minikube'))
    await download(kubectlUrl, join(binDir, 'kubectl'))
    await exec('minikube', getArgsFromInput()).then(() => exec('minikube', ['ip'], options))
    await cacheDir(join(minikubeHomeDir, 'cache'), 'minikube', minikubeVersion)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    setFailed(error.message)
  }
}

// noinspection JSIgnoredPromiseFromCall
run()
