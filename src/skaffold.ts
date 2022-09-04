import { exec } from '@actions/exec'
import { info, getInput, setFailed, setOutput } from '@actions/core'
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
  [`file-output`]: 'file-output',
  output: 'output',
  image: 'build-image',
  images: 'images',
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
const architecture = 'amd64' as const
const extension = platform === 'windows' ? '.exe' : ''

const binDir = getBinDir(workspaceDir)
const skaffoldHomeDir = join(workspaceDir, '.skaffold')

/**
 * @param {string} name
 */
function getBinaryUrl(name: Binaries): string {
  return `https://storage.googleapis.com/${name}/releases/v${getInput(
    `${name}-version`
  )}/${name}-${platform}-${architecture}${extension}`
}
/**
 * @param {string} name
 */
function getContainerStructureTestBinaryUrl(name: Binaries): string {
  return `https://storage.googleapis.com/${name}/v${getInput(
    `${name}-version`
  )}/${name}-${platform}-${architecture}${extension}`
}
/**
 * @param {string} name
 */
function getKubernetesBinaryUrl(name: string): string {
  return `https://storage.googleapis.com/kubernetes-release/release/v${getInput(
    `${name}-version`
  )}/bin/${platform}/${architecture}/${name}${extension}`
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
              if (actionParam === 'cache-file') return `--${skaffoldArg}=${workspaceDir}/${getInput(actionParam)}`
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
  const skaffoldTUrl = getBinaryUrl(Binaries.SKAFFOLD)
  const containerStructureTestUrl = getContainerStructureTestBinaryUrl(Binaries.CONTAINER_STRUCTURE_TEST)
  const kubectlUrl = getKubernetesBinaryUrl(Binaries.KUBECTL)
  await download(skaffoldTUrl, join(binDir, Binaries.SKAFFOLD)).then(() => exec(Binaries.SKAFFOLD, ['version']))
  await download(containerStructureTestUrl, join(binDir, Binaries.CONTAINER_STRUCTURE_TEST)).then(() =>
    exec(Binaries.CONTAINER_STRUCTURE_TEST, ['version'])
  )
  await download(kubectlUrl, join(binDir, Binaries.KUBECTL)).then(() =>
    exec(Binaries.KUBECTL, ['version', '--client=true'])
  )
}

async function run(): Promise<void> {
  const options: ExecOptions = { cwd: getInput('working-directory') ?? workspaceDir }
  try {
    await mkdirP(skaffoldHomeDir).then(downloadAndCheckBinaries)
    const args = filterOutputSkitTests(resolveArgsFromAction())

    await exec(Binaries.SKAFFOLD, args, options)
    await exec(
      Binaries.SKAFFOLD,
      filterOutputSkitTests(
        ['build'].concat(
          args
            .slice(1)
            .filter((it) => !it.startsWith('--output') || !it.startsWith('--quiet'))
            .concat(['--quiet', "--output='{{json .}}'"])
        )
      ),
      {
        ...options,
        listeners: {
          stdout: (output) => {
            try {
              const data: BuildOutput = JSON.parse(output.toString('utf8').replace("'", ''))
              info(JSON.stringify(data))
              setOutput('output', data)
            } catch (e) {
              setOutput('error', e)
            }
          },
        },
      }
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    setFailed(error.message)
  }
}

// noinspection JSIgnoredPromiseFromCall
run()
