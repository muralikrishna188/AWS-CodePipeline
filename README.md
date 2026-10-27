# AWS DevOps Labs

Hands-on labs for the **DevOps on AWS – Intermediate** course. This repository holds the lab guides and a small Node.js sample application that is built, tested and deployed through AWS developer tools.

## Labs

| Lab | Guide | What you do |
|---|---|---|
| CloudFormation | [CloudFormation_Hands-on_Lab.md](CloudFormation_Hands-on_Lab.md) | Provision AWS resources from a template |
| Day 3: CodeBuild | [Day3_CodeBuild_Hands-on_Lab.md](Day3_CodeBuild_Hands-on_Lab.md) | Build and test the sample app, and store the artifact in S3 |
| CodePipeline | [CodePipeline_Hands-on_Lab.md](CodePipeline_Hands-on_Lab.md) | Build a CI/CD pipeline that deploys the app to Elastic Beanstalk |

Do the CodeBuild lab before the CodePipeline lab. The pipeline reuses the same repository and CodeBuild project.

## Repository contents

| File | Purpose |
|---|---|
| `app.js` | Sample Node.js app with `add` and `greet` functions and a small HTTP server |
| `app.test.js` | Unit tests (Node's built-in test runner), run during every build |
| `package.json` | Scripts: `start`, `test`, `build` |
| `package-lock.json` | Locked dependency list, required by `npm ci` in the build |
| `buildspec.yml` | The CodeBuild recipe: install, test, package, upload artifact |
| `*.md` | Lab guides |

## Getting started

1. **Fork this repository** to your own GitHub account (Fork button, top right). CodeBuild and CodePipeline can only connect to a repository you own.
2. Open the lab guide you are working on and follow it using **your fork**.

You do not need to write the application yourself.

### Optional: run it locally

Requires Git and Node.js 18 or later.

```bash
git clone https://github.com/<your-username>/AWS-DevOps.git
cd AWS-DevOps
npm ci
npm test          # both tests should pass
npm run build     # creates dist/ with app.js and package.json
npm start         # http://localhost:3000
```

## How the build works

```
Your fork on GitHub ──► CodeBuild ──► install → test → build ──► dist/ artifact
                                                                    │
                                          S3 (CodeBuild lab)  or  Elastic Beanstalk (CodePipeline lab)
```

A failing test fails the build, so a broken change never reaches deployment.

## Before you start

- An AWS account with permission to use CodeBuild, CodePipeline, Elastic Beanstalk, S3, IAM and CloudWatch Logs
- A GitHub account with the **AWS Connector for GitHub** app installed and given access to your fork (check at `github.com/settings/installations`)
- Use one AWS region for all resources in a lab

## Cost and cleanup

Most resources in these labs cost little or nothing for a short session, but the **Elastic Beanstalk environment keeps an EC2 instance running** until you terminate it. Follow the **Cleanup** section at the end of each lab guide when you finish.
