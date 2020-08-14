# Kops Github Action

Setup Kops and all required dependencies, env variables, Kubernetes context etc.

## Example

```yaml
name: Kops
on: push
jobs:
  export-kubeconfig:
    name: Validate cluster
    runs-on: ubuntu-20.04
    steps:
      - name: Setup Kops
        uses: hiberbee/github-action-kops@master
        with:
          command: validate cluster
          cluster-name: k8s.hiberbee.net
          state-store: s3://hiberbee-infrastructure-state
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: ${{ secrets.AWS_DEFAULT_REGION }}

```
