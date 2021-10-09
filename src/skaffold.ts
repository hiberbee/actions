import { exec } from '@actions/exec'
import { getInput, setFailed } from '@actions/core'
import { mkdirP } from '@actions/io'
import { download, getBinDir, getOsPlatform, getWorkspaceDir } from './index'
import { join } from 'path'

const paramsArgumentsMap: Record<string, string> = {
  concurrency: 'build-concurrency',
  image: 'build-image',
  cache: 'cache-artifacts',
  [`cache-file`]: 'cache-file',
  repository: 'default-repo',
  tag: 'tag',
  filename: 'filename',
  ['kubeconfig']: 'kubeconfig',
  ['kube-context']: 'kubeconfig',
  ['namespace']: 'namespace',
  ['profile']: 'profile',
  ['push']: 'push',
  ['verbosity']: 'verbosity',
  ['interactive']: 'interactive',
  ['skip-tests']: 'skip-tests',
}

const workspaceDir = getWorkspaceDir()
const binDir = getBinDir(workspaceDir)
const skaffoldHomeDir = join(workspaceDir, '.skaffold')

function resolveArgsFromAction(): string[] {
  return getInput('command') === ''
    ? ['version']
    : getInput('command')
        .split(' ')
        .concat(
          Object.entries(paramsArgumentsMap)
            .map(([actionParam, skaffoldArg]) =>
              getInput(actionParam) !== '' ? `--${skaffoldArg}=${getInput(actionParam)}` : '',
            )
            .filter((it) => it !== ''),
        )
}

async function run(): Promise<void> {
  const platform = getOsPlatform()
  const suffix = platform === 'windows' ? '.exe' : ''

  const skaffoldVersion = getInput('skaffold-version')
  const containerStructureTestVersion = getInput('container-structure-test-version')
  const skaffoldTUrl = `https://github.com/GoogleContainerTools/skaffold/releases/download/v${skaffoldVersion}/skaffold-${platform}-amd64${suffix}`
  const containerStructureTestUrl = `https://storage.googleapis.com/container-structure-test/v${containerStructureTestVersion}/container-structure-test-${platform}-amd64`

  try {
    await mkdirP(skaffoldHomeDir)
    await download(skaffoldTUrl, join(binDir, 'skaffold'))
    if (!Boolean(getInput('skip-tests'))) {
      await download(containerStructureTestUrl, join(binDir, 'container-structure-test'))
    }
    await exec('skaffold', resolveArgsFromAction(), { cwd: getInput('working-directory') ?? workspaceDir })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    setFailed(error.message)
  }
}

// noinspection JSIgnoredPromiseFromCall
run()
