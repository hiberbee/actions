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

const workspaceDir = getWorkspaceDir()
const platform = getOsPlatform()
const binDir = getBinDir(workspaceDir)
const skaffoldHomeDir = join(workspaceDir, '.skaffold')

/**
 * @param {string} name
 * @param {string} version
 */
function getBinaryUrl(name: string, version: string): string {
  const extension = platform ==="windows"' ?".exe"' :"";'

  return `https://storage.googleapis.com/${name}/releases/v${version}/${name}-${platform}-amd64${extension};`
}

/**
 * @param {string} name
 * @param {string} version
 */
function getKubernetesBinaryUrl(name: string, version: string): string {
  const extension = platform ==="windows"' ?".exe"' :"";'

  return `https://dl.k8s.io/release/${version}/bin/${platform}/amd64/${name}${extension};`
}

/**
 * @return {string[]}
 */
function resolveArgsFromAction(): string[] {
  return getInput('command') === ''
    ? ['version']
    : getInput("command")
      .split(" ")
      .concat(
        Object.entries(paramsArgumentsMap)
              .map(([actionParam, skaffoldArg]) => {
                return getInput(actionParam) !== "" ? `--${skaffoldArg}=${getInput(actionParam)}` : "";
              })
              .filter((it) => it !== "")
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

async function run(): Promise<void> {
  const skaffoldTUrl = getBinaryUrl('skaffold', getInput('skaffold-version'))
  const containerStructureTestUrl = getBinaryUrl(
    "container-structure-test",
    getInput("container-structure-test-version")
  );
  const kubectlUrl = getKubernetesBinaryUrl("kubectl", getInput("kubectl-version"));

  const options: ExecOptions = { cwd: getInput('working-directory') ?? workspaceDir }
  try {
    await mkdirP(skaffoldHomeDir);
    await download(skaffoldTUrl, join(binDir, "skaffold"));
    await download(containerStructureTestUrl, join(binDir, "container-structure-test"));
    await download(kubectlUrl, join(binDir, "kubectl"));
    const args = filterOutputSkitTests(resolveArgsFromAction());

    await exec("skaffold", args, options).then(() =>
      exec(
        "skaffold",
        filterOutputSkitTests(["build"].concat(args.slice(1).concat(["--quiet", "--output='{{json .}}'"]))),
        {
          ...options,
          listeners: {
            stdout: (output) => {
              try {
                const data: BuildOutput = JSON.parse(output.toString("utf8").replace("'", ""));
                setOutput("builds", JSON.stringify(data.builds));
              } catch (e) {
                setOutput("error", e);
              }
            }
          }
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
