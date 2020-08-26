import { exportVariable, getInput, setFailed } from '@actions/core'
import { exec } from '@actions/exec'
import { download, getOsPlatform, getHomeDir, getBinDir, getWorkspaceDir } from './index'
import { mkdirP } from '@actions/io'
import { exists } from '@actions/io/lib/io-util'
import { join } from 'path'

// noinspection JSUnusedGlobalSymbols
enum HelmfileArgs {
  ENVIRONMENT = 'environment',
  INTERACTIVE = 'interactive',
  KUBE_CONTEXT = 'kube-context',
  LOG_LEVEL = 'log-level',
}

function getHelmfileArgsFromInput(): string[] {
  return Object.values(HelmfileArgs)
    .filter(key => getInput(key) !== '')
    .map(key => `--${key}=${getInput(key)}`)
}

const homeDir = getHomeDir()
const binDir = getBinDir()
const workspaceDir = getWorkspaceDir()
const cacheDir = join(homeDir, '.cache')
const helmCacheDir = join(cacheDir, 'helm')
const platform = getOsPlatform()

async function run(): Promise<void> {
  const helmVersion = getInput('helm-version')
  const helmfileVersion = getInput('helmfile-version')
  const repositoryConfig = getInput('repository-config')
  const helmfileConfig = getInput('helmfile-config')
  const helmUrl = `https://get.helm.sh/helm-v${helmVersion}-${platform}-amd64.tar.gz`
  const helmfileUrl = `https://github.com/roboll/helmfile/releases/download/v${helmfileVersion}/helmfile_${platform}_amd64`
  const repositoryConfigPath = join(workspaceDir, repositoryConfig)
  const helmfileConfigPath = join(workspaceDir, helmfileConfig)

  try {
    exportVariable('XDG_CACHE_HOME', cacheDir)
    const repositoryArgs = (await exists(repositoryConfigPath)) ? ['--repository-config', repositoryConfigPath] : []
    await mkdirP(helmCacheDir)
    await download(helmUrl, join(binDir, 'helm'))
    await download(helmfileUrl, join(binDir, 'helmfile'))
    if (repositoryArgs.length > 0) {
      await exec('helm', ['repo', 'update'].concat(repositoryArgs))
    }
    if (getInput('helmfile-command') !== '') {
      const globalArgs = getHelmfileArgsFromInput().concat(
        (await exists(helmfileConfigPath)) ? ['--file', helmfileConfigPath] : [],
      )
      await exec('helmfile', globalArgs.concat(getInput('helmfile-command').split(' ')))
    } else if (getInput('helm-command') !== '') {
      await exec('helm', getInput('helm-command').split(' ').concat(repositoryArgs))
    }
  } catch (error) {
    setFailed(error.message)
  }
}

// noinspection JSIgnoredPromiseFromCall
run()
