import { exec } from "@actions/exec";
import { setOutput, getInput, setFailed } from "@actions/core";
import { mkdirP } from "@actions/io";
import { download, getBinDir, getOsPlatform, getWorkspaceDir } from "./index";
import { join } from "path";

const paramsArgumentsMap: Record<string, string> = {
  ["insecure-registries"]: "insecure-registry",
  ["kube-context"]: "kubeconfig",
  ["skip-tests"]: "skip-tests",
  [`cache-file`]: "cache-file",
  cache: "cache-artifacts",
  concurrency: "build-concurrency",
  filename: "filename",
  output: "output",
  image: "build-image",
  interactive: "interactive",
  kubeconfig: "kubeconfig",
  namespace: "namespace",
  profile: "profile",
  push: "push",
  repository: "default-repo",
  tag: "tag",
  verbosity: "verbosity",
};

const workspaceDir = getWorkspaceDir();
const platform = getOsPlatform();

const binDir = getBinDir(workspaceDir);
const skaffoldHomeDir = join(workspaceDir, ".skaffold");

/**
 * @param {string} name
 * @param {string} version
 */
function getBinaryUrl(name: string, version: string): string {
  const extension = platform === "windows" ? ".exe" : "";

  return `https://storage.googleapis.com/${name}/releases/v${version}/${name}-${platform}-amd64${extension}`;
}

/**
 * @return {string[]}
 */
function resolveArgsFromAction(): string[] {
  return getInput("command") === ""
    ? ["version"]
    : getInput("command")
        .split(" ")
        .concat(
          Object.entries(paramsArgumentsMap)
            .map(([actionParam, skaffoldArg]) => {
              return getInput(actionParam) !== "" ? `--${skaffoldArg}=${getInput(actionParam)}` : "";
            })
            .filter((it) => it !== "")
        );
}

type ImageBuildOutput = {
  imageName: string;
  tag: string;
};

type BuildOutput = {
  builds: ImageBuildOutput[];
};

async function run(): Promise<void> {
  const skaffoldTUrl = getBinaryUrl("skaffold", getInput("skaffold-version"));
  const containerStructureTestUrl = getBinaryUrl(
    "container-structure-test",
    getInput("container-structure-test-version")
  );

  try {
    await mkdirP(skaffoldHomeDir);
    await download(skaffoldTUrl, join(binDir, "skaffold"));
    if (!Boolean(getInput("skip-tests"))) {
      await download(containerStructureTestUrl, join(binDir, "container-structure-test"));
    }
    let args = resolveArgsFromAction();
    // Fix: https://github.com/hiberbee/github-action-skaffold/issues/14
    if (getInput("output") || args.find((each) => each.startsWith("--output"))) {
      args = args.filter((arg) => !arg.startsWith("--skip-tests"));
    }

    await exec("skaffold", args, {
      cwd: getInput("working-directory") ?? workspaceDir,
    }).then(() =>
      exec("skaffold", args.concat(["--quiet", "--output='{{json .}}'"]), {
        listeners: {
          stdout: (output) => {
            const data: BuildOutput = JSON.parse(output.toString("utf8"));
            setOutput("builds", JSON.stringify(data.builds));
          },
        },
      })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    setFailed(error.message);
  }
}

// noinspection JSIgnoredPromiseFromCall
run();
