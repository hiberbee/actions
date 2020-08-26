import { cacheDir, cacheFile } from '@actions/tool-cache'
import { exec } from '@actions/exec'
import { getInput, setFailed } from '@actions/core'
import { mkdirP } from '@actions/io'
import { download, getBinDir, getHomeDir, getOsPlatform } from './index'
import { join } from 'path'

// noinspection JSUnusedGlobalSymbols
enum SkaffoldArgs {
  BUILD_IMAGE = 'build-image',
  CACHE_ARTIFACTS = 'cache-artifacts',
  DEFAULT_REPO = 'default-repo',
  FILENAME = 'filename',
  INSECURE_REGISTRIES = 'insecure-registries',
  KUBE_CONTEXT = 'kube-context',
  KUBECONFIG = 'kubeconfig',
  NAMESPACE = 'namespace',
  PROFILE = 'profile',
  SKIP_TESTS = 'skip-tests',
  TAG = 'tag',
}

const homeDir = getHomeDir()
const binDir = getBinDir()
const skaffoldHomeDir = join(homeDir, '.skaffold')
const skaffoldCacheFile = join(skaffoldHomeDir, 'cache')

function getArgsFromInput(): string[] {
  return getInput('command')
    .split(' ')
    .concat(`--cache-file=${skaffoldCacheFile}`)
    .concat(
      Object.values(SkaffoldArgs)
        .filter(key => getInput(key) !== '')
        .map(key => `--${key}=${getInput(key)}`),
    )
}

async function run(): Promise<void> {
  const platform = getOsPlatform()
  const suffix = platform === 'windows' ? '.exe' : ''

  const skaffoldVersion = getInput('skaffold-version')
  const containerStructureTestVersion = getInput('container-structure-test-version')
  const skaffoldTestUrl = `https://github.com/GoogleContainerTools/skaffold/releases/download/v${skaffoldVersion}/skaffold-${platform}-amd64${suffix}`
  const containerStructureTestUrl = `https://storage.googleapis.com/container-structure-test/v${containerStructureTestVersion}/container-structure-test-${platform}-amd64`

  try {
    await mkdirP(skaffoldHomeDir)
    await download(skaffoldTestUrl, join(binDir, 'skaffold'))
    if (getInput('skip-tests') === 'false') {
      await download(containerStructureTestUrl, join(binDir, 'container-structure-test'))
    }
    await exec('skaffold', getArgsFromInput())
    await cacheDir(skaffoldHomeDir, 'skaffold', skaffoldVersion)
  } catch (error) {
    setFailed(error.message)
  }
}

// noinspection JSIgnoredPromiseFromCall
run()
