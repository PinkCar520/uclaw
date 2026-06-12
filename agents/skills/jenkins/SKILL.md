---
name: jenkins
description: "与 Jenkins CI/CD 服务器交互。触发条件：用户需要触发构建、检查构建状态、查看控制台输出、管理 Job、监控 Jenkins 队列和节点时使用。支持部署到不同 Jenkins 实例。"
allowed-tools:
  - jenkins__listJobs
  - jenkins__getJobInfo
  - jenkins__getBuildStatus
  - jenkins__triggerBuild
  - jenkins__getBuildLog
  - jenkins__approveDeployment
  - runLocalCommand
requires-approval:
  - jenkins__triggerBuild
  - jenkins__approveDeployment
compatibility: "需要设置 JENKINS_URL, JENKINS_USER, JENKINS_API_TOKEN 环境变量"
locales:
  zh:
    displayName: "Jenkins CI/CD 管理"
    description: "管理 Jenkins 流水线：触发构建、查看状态、监控队列"
  en:
    displayName: "Jenkins CI/CD Management"
    description: "Manage Jenkins pipelines: trigger builds, check status, monitor queue"
---

# Jenkins

Interact with Jenkins CI/CD server through REST API.

## Required environment variables

- `JENKINS_URL` (example: `https://jenkins.example.com`)
- `JENKINS_USER` (your Jenkins username)
- `JENKINS_API_TOKEN` (API token from Jenkins user settings)

## List jobs

```bash
node {baseDir}/scripts/jenkins.mjs jobs
node {baseDir}/scripts/jenkins.mjs jobs --pattern "deploy-*"
```

## Trigger build

```bash
node {baseDir}/scripts/jenkins.mjs build --job "my-job"
node {baseDir}/scripts/jenkins.mjs build --job "my-job" --params '{"BRANCH":"main","ENV":"dev"}'
```

## Check build status

```bash
node {baseDir}/scripts/jenkins.mjs status --job "my-job"
node {baseDir}/scripts/jenkins.mjs status --job "my-job" --build 123
node {baseDir}/scripts/jenkins.mjs status --job "my-job" --last
```

## View console output

```bash
node {baseDir}/scripts/jenkins.mjs console --job "my-job" --build 123
node {baseDir}/scripts/jenkins.mjs console --job "my-job" --last --tail 50
```

## Stop build

```bash
node {baseDir}/scripts/jenkins.mjs stop --job "my-job" --build 123
```

## View queue

```bash
node {baseDir}/scripts/jenkins.mjs queue
```

## View nodes

```bash
node {baseDir}/scripts/jenkins.mjs nodes
```

## Notes

- URL and credentials are variables by design for cross-environment deployment.
- API responses are output as JSON.
- For parameterized builds, use `--params` with JSON string.
