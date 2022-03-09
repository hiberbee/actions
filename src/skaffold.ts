import { exec } from "@actions/exec";
import { getInput, setFailed } from "@actions/core";
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
const binDir = getBinDir(workspaceDir);
const skaffoldHomeDir = join(workspaceDir, ".skaffold");

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

async function run(): Promise<void> {
  const platform = getOsPlatform();
  const suffix = platform === "windows" ? ".exe" : "";

  const skaffoldVersion = getInput("skaffold-version");
  const containerStructureTestVersion = getInput("container-structure-test-version");
  const skaffoldTUrl = `https://github.com/GoogleContainerTools/skaffold/releases/download/v${skaffoldVersion}/skaffold-${platform}-amd64${suffix}`;
  const containerStructureTestUrl = `https://storage.googleapis.com/container-structure-test/v${containerStructureTestVersion}/container-structure-test-${platform}-amd64`;

  try {
    await mkdirP(skaffoldHomeDir);
    await download(skaffoldTUrl, join(binDir, "skaffold"));
    if (!Boolean(getInput("skip-tests"))) {
      await download(containerStructureTestUrl, join(binDir, "container-structure-test"));
    }
    await exec("skaffold", resolveArgsFromAction(), { cwd: getInput("working-directory") ?? workspaceDir });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    setFailed(error.message);
  }
}

// noinspection JSIgnoredPromiseFromCall
run();
