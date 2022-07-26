import { exec } from '@actions/exec'
import { setOutput, getInput, setFailed } from '@actions/core'
import { mkdirP } from '@actions/io'
import { download, getBinDir, getOsPlatform, getWorkspaceDir } from './index'
import { join } from 'path'
import type { ExecOptions } from '@actions/exec/lib/interfaces'

const paramsArgumentsMap: Record<string, string> = {
  ['insecure-registries']: 'insecure-registry',
  ['kube-context']: 'kubeconfig',
  ['skip-tests']: 'skip-tests',
  [`cache-file`]: 'cache-file',
  cache: 'cache-artifacts',
  concurrency: 'build-concurrency',
  filename: 'filename',
  output: 'output',
  image: 'build-image',
  interactive: 'interactive',
  kubeconfig: 'kubeconfig',
  namespace: 'namespace',
  profile: 'profile',
  push: 'push',
  repository: 'default-repo',
  tag: 'tag',
  verbosity: 'verbosity',
}

enum Binaries {
  SKAFFOLD = 'skaffold',
  KUBECTL = 'kubectl',
  CONTAINER_STRUCTURE_TEST = 'container-structure-test',
}

const workspaceDir = getWorkspaceDir()
const platform = getOsPlatform()
const extension = platform === 'windows' ? '.exe' : ''

const binDir = getBinDir(workspaceDir)
const skaffoldHomeDir = join(workspaceDir, '.skaffold')

/**
 * @param {string} name
 * @param {string} version
 */
function getBinaryUrl(name: Binaries, version: string): string {
  const url = `https://storage.googleapis.com/${name}/releases/v${version}/${name}-${platform}-amd64${extension}`
  setOutput(`Resolved ${name} url:`, url)
  return url
}

/**
 * @param {string} name
 * @param {string} version
 */
function getKubernetesBinaryUrl(name: string, version: string): string {
  const url = `https://dl.k8s.io/release/${version}/bin/${platform}/amd64/${name}${extension}`
  setOutput(`Resolved ${name} url:`, url)
  return url
}

/**
 * @return {string[]}
 */
function resolveArgsFromAction(): string[] {
  return getInput('command') === ''
    ? ['version']
    : getInput('command')
        .split(' ')
        .concat(
          Object.entries(paramsArgumentsMap)
            .map(([actionParam, skaffoldArg]) => {
              return getInput(actionParam) !== '' ? `--${skaffoldArg}=${getInput(actionParam)}` : ''
            })
            .filter((it) => it !== '')
        )
}

type ImageBuildOutput = {
  imageName: string
  tag: string
}

type BuildOutput = {
  builds: ImageBuildOutput[]
}

/**
 * Fix: https://github.com/hiberbee/github-action-skaffold/issues/14
 * @param {string[]} args
 */
function filterOutputSkitTests(args: string[]) {
  return getInput('output') || args.find((each) => each.startsWith('--output'))
    ? args.filter((arg) => !arg.startsWith('--skip-tests'))
    : args
}

async function downloadAndCheckBinaries() {
  const skaffoldTUrl = getBinaryUrl(Binaries.SKAFFOLD, getInput(`${Binaries.SKAFFOLD}-version`))
  const containerStructureTestUrl = getBinaryUrl(
    Binaries.CONTAINER_STRUCTURE_TEST,
    getInput(`${Binaries.CONTAINER_STRUCTURE_TEST}-version`)
  )
  const kubectlUrl = getKubernetesBinaryUrl(Binaries.KUBECTL, getInput(`${Binaries.KUBECTL}-version`))
  await download(skaffoldTUrl, join(binDir, Binaries.SKAFFOLD)).then(() => exec(Binaries.SKAFFOLD, ['version']))
  await download(containerStructureTestUrl, join(binDir, Binaries.CONTAINER_STRUCTURE_TEST)).then(() =>
    exec(Binaries.CONTAINER_STRUCTURE_TEST, ['version'])
  )
  await download(kubectlUrl, join(binDir, Binaries.KUBECTL)).then(() => exec(Binaries.KUBECTL, ['version']))
}

async function run(): Promise<void> {
  const options: ExecOptions = { cwd: getInput('working-directory') ?? workspaceDir }
  try {
    await mkdirP(skaffoldHomeDir).then(downloadAndCheckBinaries)
    const args = filterOutputSkitTests(resolveArgsFromAction())

    await exec(Binaries.SKAFFOLD, args, options).then(() =>
      exec(
        Binaries.SKAFFOLD,
        filterOutputSkitTests(['build'].concat(args.slice(1).concat(['--quiet', "--output='{{json .}}'"]))),
        {
          ...options,
          listeners: {
            stdout: (output) => {
              try {
                const data: BuildOutput = JSON.parse(output.toString('utf8').replace("'", ''))
                setOutput('builds', JSON.stringify(data.builds))
              } catch (e) {
                setOutput('error', e)
              }
            },
          },
        }
      )
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    setFailed(error.message)
  }
}

// noinspection JSIgnoredPromiseFromCall
run()
