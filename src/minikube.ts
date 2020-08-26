import { getInput, setFailed, exportVariable, setOutput, error } from '@actions/core'
import { exec, ExecOptions } from '@actions/exec'
import { cacheDir } from '@actions/tool-cache'
import { join } from 'path'
import { download, getBinDir, getHomeDir, getOsPlatform } from './index'

// noinspection JSUnusedGlobalSymbols
enum MinikubeArgs {
  WAIT = '--wait',
  AUTO_UPDATE_DRIVERS = '--auto-update-drivers',
  INTERACTIVE = '--interactive',
  DELETE_ON_FAILURE = '--delete-on-failure',
  CPUS = '--cpus',
  MEMORY = '--memory',
  NODES = '--nodes',
  NETWORK_PLUGIN = '--network-plugin',
  KUBERNETES_VERSION = '--kubernetes-version',
}

const homeDir = getHomeDir()
const binDir = getBinDir()
const minikubeHomeDir = join(homeDir, '.minikube')
const platform = getOsPlatform()
const suffix = platform === 'win32' ? '.exe' : ''

function getArgsFromInput(): string[] {
  return ['start', '--embed-certs']
    .concat(
      Object.values(MinikubeArgs)
        .filter(key => getInput(key) !== '')
        .map(key => `--${key}=${getInput(key)}`),
    )
    .concat(getInput('addons').split(','))
    .map(key => `--addons=${key}`)
}

async function run(): Promise<void> {
  const minikubeVersion = getInput('minikube-version') ?? '1.12.3'
  const kubernetesVersion = getInput('kubernetes-version') ?? '1.18.8'
  const minikubeUrl = `https://github.com/kubernetes/minikube/releases/download/v${minikubeVersion}/minikube-${platform}-amd64${suffix}`
  const kubectlUrl = `https://storage.googleapis.com/kubernetes-release/release/v${kubernetesVersion}/bin/${platform}/amd64/kubectl${suffix}`
  const options: ExecOptions = {}
  const profile = getInput('profile')

  try {
    exportVariable('MINIKUBE_PROFILE_NAME', profile)
    exportVariable('MINIKUBE_HOME', minikubeHomeDir)
    options.listeners = {
      stdout: data => {
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
  } catch (error) {
    setFailed(error.message)
  }
}

// noinspection JSIgnoredPromiseFromCall
run()
