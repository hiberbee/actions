# Github Action Kops

<p align="center">
  <img src="https://img.shields.io/github/license/hiberbee/github-action-kops?style=flat-square" alt="License">
  <img src="https://img.shields.io/github/workflow/status/hiberbee/github-action-kops/CI?label=github-actions&style=flat-square" alt="GitHub Action Status">
  <img src="https://img.shields.io/github/v/tag/hiberbee/github-action-kops?label=hiberbee%2Fgithub-action-kops&style=flat-square" alt="GitHub Workflow Version">
</p>

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
        uses: hiberbee/github-action-kops@latest
        with:
          command: validate cluster
          cluster-name: k8s.hiberbee.net
          state-store: s3://hiberbee-infrastructure-state
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: ${{ secrets.AWS_DEFAULT_REGION }}
```
