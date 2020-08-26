import { cacheDir } from '@actions/tool-cache'
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
const skaffoldHomeDir = join(homeDir, '.skaffold')
const skaffoldCacheDir = join(skaffoldHomeDir, 'cache')
const binDir = getBinDir()

function getArgsFromInput(): string[] {
  return getInput('command')
    .split(' ')
    .concat(`--cache-file=${skaffoldCacheDir}`)
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
    await mkdirP(skaffoldCacheDir)
    await download(skaffoldTestUrl, join(binDir, 'skaffold'))
    if (getInput('skip-tests') === 'false') {
      await download(containerStructureTestUrl, join(binDir, 'container-structure-test'))
    }
    await cacheDir(skaffoldCacheDir, 'skaffold', skaffoldVersion)
    await exec('skaffold', getArgsFromInput())
  } catch (error) {
    setFailed(error.message)
  }
}

// noinspection JSIgnoredPromiseFromCall
run()
