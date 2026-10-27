# Hands-on Lab: CI/CD Pipeline with AWS CodePipeline and Elastic Beanstalk

**Course:** DevOps on AWS – Intermediate
**Duration:** about 75 minutes
**Goal:** Build a pipeline that takes code from GitHub, builds and tests it with CodeBuild, and deploys it automatically to a running application on AWS Elastic Beanstalk.

---

## What you will build

```
Developer push ──► GitHub ──► [Source stage] ──► [Build stage] ──► [Deploy stage]
                                  │                  │                  │
                             SourceArtifact      CodeBuild         Elastic Beanstalk
                                              (buildspec.yml)    (running Node.js app)
```

## Key concepts (quick reference)

| Term | Meaning |
|---|---|
| Pipeline | The complete release workflow |
| Stage | A logical group of actions (Source, Build, Deploy) |
| Action | A single task inside a stage (get source, run build, deploy) |
| Artifact | Files passed from one action to the next, stored in an S3 artifact bucket |
| Transition | The link between stages (can be disabled) |
| Execution | One run of the pipeline, started by a trigger |
| Service role | IAM role that lets CodePipeline call other AWS services |
| Elastic Beanstalk | A managed service that runs your web application (it creates and manages the servers for you) |
| Application / Environment | In Beanstalk, the application is the logical container; the environment is the running copy of it |

## Prerequisites

- Your **fork** of the course repository `AWS-DevOps` on GitHub, containing `app.js`, `app.test.js`, `package.json`, `package-lock.json` and `buildspec.yml` in the root (from the CodeBuild lab)
- The CodeBuild project `codebuild-demo` from the CodeBuild lab (the project name you used may differ; use yours consistently)
- AWS Console access with permission for CodePipeline, CodeBuild, Elastic Beanstalk, EC2, S3, IAM and CodeConnections
- The **AWS Connector for GitHub** app installed on your GitHub account with access to your fork (check at `github.com/settings/installations`)
- Same AWS region for all resources

---

## Step 1: Prepare the repository

### 1.1 Make the app work on Elastic Beanstalk

Beanstalk runs your app behind a proxy and tells it which port to use through the `PORT` environment variable. The sample app currently hardcodes port 3000, which would cause a **502 Bad Gateway** on Beanstalk.

In `app.js`, change the `.listen(...)` line from:

```javascript
.listen(3000, () => console.log('Listening on port 3000'));
```

to:

```javascript
.listen(process.env.PORT || 3000, () => console.log('Listening'));
```

This still runs on port 3000 locally. The unit tests are not affected.

### 1.2 Check the buildspec

Your `buildspec.yml` must put the files to deploy at the top level of the `dist` folder. Beanstalk expects `package.json` at the root of the deployed zip.

```yaml
version: 0.2

phases:
  install:
    runtime-versions:
      nodejs: 20
  pre_build:
    commands:
      - npm ci
  build:
    commands:
      - npm test
      - npm run build

artifacts:
  files:
    - '**/*'
  base-directory: dist
```

When CodeBuild runs inside a pipeline, CodePipeline controls where the artifact goes. The S3 artifact settings in the CodeBuild project are overridden, so no change is needed there.

### 1.3 Commit and push

```bash
git add app.js
git commit -m "Use PORT environment variable for Elastic Beanstalk"
git push origin main
```

**Checkpoint 1:** The updated `app.js` is on the `main` branch of your fork.

---

## Step 2: Create the Elastic Beanstalk application and environment

The pipeline deploys **into** an existing environment, so create it first. This takes about 5 minutes.

### 2.1 Create the application and environment

1. Open the **Elastic Beanstalk** console and choose **Create application**.
2. **Environment tier:** Web server environment
3. **Application name:** `codebuild-demo-app`
4. **Environment name:** `codebuild-demo-env`
5. **Platform:** Node.js (choose the current Amazon Linux 2023 platform and its recommended version)
6. **Application code:** **Sample application** (the pipeline will replace it later)
7. **Presets:** **Single instance** (cheaper, and enough for a lab)
8. Choose **Next**.

### 2.2 Configure service access

1. **Service role:** choose **Create and use new service role**, or select `aws-elasticbeanstalk-service-role` if it exists.
2. **EC2 instance profile:** select `aws-elasticbeanstalk-ec2-role`.
   - If it does not exist, create it in **IAM**: Roles, **Create role**, trusted entity **AWS service**, use case **EC2**, then attach the policies `AWSElasticBeanstalkWebTier`, `AWSElasticBeanstalkWorkerTier` and `AWSElasticBeanstalkMulticontainerDocker`. Name it `aws-elasticbeanstalk-ec2-role`, then refresh the Beanstalk page and select it.
3. **EC2 key pair:** leave empty (not needed).
4. Choose **Next**, keep the defaults on the networking, database and traffic pages, and continue to **Review**.
5. Choose **Submit**.

### 2.3 Wait for the environment

Wait until the environment health shows **Ok** (green). Then open the **Domain** link at the top of the environment page. You should see the AWS sample application page.

**Checkpoint 2:** The environment is healthy and the sample application page opens.

---

## Step 3: Start creating the pipeline

1. Open the **CodePipeline** console and choose **Create pipeline**.
2. Choose **Build custom pipeline**, then **Next**.
3. **Pipeline settings**
   - Pipeline name: `codebuild-demo-pipeline` (the name cannot be changed later)
   - Pipeline type: **V2**
   - Execution mode: **Queued** (either Queued or Superseded works for this lab)
   - Service role: **New service role** (accept the suggested name)
4. Choose **Next**.

### Pipeline settings: execution mode

The execution mode decides what happens when a new pipeline run starts while an earlier run is still in progress (for example, when you push two commits within a minute).

| Mode | Behavior | Best for |
|---|---|---|
| **Superseded** | A newer run overtakes older ones. Waiting runs are dropped, so only the latest commit continues. | Typical CI/CD where only the newest code matters |
| **Queued** | Runs go through in the order they were triggered, one after another, and none are skipped. | When every commit must be built and deployed in order |
| **Parallel** | Runs start independently and at the same time, with no ordering. | Independent builds or tests where order doesn't matter |

---

## Step 4: Add the source stage (with commit trigger)

1. **Source provider:** **GitHub (via GitHub App)**
2. **Connection:** choose **Connect to GitHub**, name it `github-demo-connection`, install or authorize the AWS Connector for GitHub app, and give it access to your fork.
3. Back in the wizard, select the connection.
4. **Repository name:** `<your-username>/AWS-DevOps`
5. **Default branch:** `main`
6. **Output artifact format:** **CodePipeline default**
7. **Trigger:** keep **Start the pipeline on source code change** selected.
8. Choose **Next**.

> If the connection shows **Pending**, finish the authorization in the connection settings first. A pending connection, or a GitHub app that is not installed on your fork, is the most common reason a Source stage fails.

---

## Step 5: Add the build stage

1. **Build provider:** **Other build providers**, then **AWS CodeBuild**
2. **Project name:** `codebuild-demo`
3. **Build type:** **Single build**
4. Choose **Next**.
5. **Test stage:** choose **Skip test stage** (tests already run inside the buildspec).

---

## Step 6: Add the deploy stage (Elastic Beanstalk)

1. **Deploy provider:** **AWS Elastic Beanstalk**
2. **Region:** your region
3. **Application name:** `codebuild-demo-app`
4. **Environment name:** `codebuild-demo-env`
5. Choose **Next**.
6. Review the settings and choose **Create pipeline**.

> Beanstalk needs the artifact as a zip, which is what CodePipeline provides. Do not look for an "Extract file before deploy" option here; that option belongs to the S3 deploy provider.

The pipeline starts running immediately.

---

## Step 7: Watch the first run

On the pipeline page you will see three stages. Watch each one:

| Stage | What happens | Expected result |
|---|---|---|
| Source | CodePipeline downloads the code from GitHub | Succeeded |
| Build | CodeBuild installs, tests and packages | Succeeded |
| Deploy | Beanstalk receives the zip and updates the environment | Succeeded |

Choose **View details** on the Build action to open the CodeBuild logs.

**Checkpoint 3:** All three stages show **Succeeded**.

Open the Beanstalk environment **Domain** link again. The AWS sample page is replaced by your app, which shows:

```
Hello, CodeBuild!
```

If you see **502 Bad Gateway**, check Step 1.1 (the `PORT` change) and see the troubleshooting table.

---

## Step 8: Trigger the pipeline with a commit

1. In `app.js`, change the argument in the server line (do not change the `greet` function itself):

```javascript
res.end(greet('CodeBuild Pipeline'));
```

2. Commit and push:

```bash
git add app.js
git commit -m "Change greeting"
git push origin main
```

3. Open the pipeline. A **new execution** starts within a few moments, without you clicking anything.
4. After the Deploy stage succeeds, refresh the Beanstalk environment URL. It now shows `Hello, CodeBuild Pipeline!`.

**Checkpoint 4:** A push to `main` automatically updated the running application.

---

## Step 9: Break the pipeline and fix it

### Experiment A: Failing test stops the pipeline

1. In `app.js`, change the text inside the `greet` function, for example:

```javascript
return `Hi there, ${name}!`;
```

2. Do **not** update `app.test.js`. Commit and push.
3. The **Build** stage fails and the **Deploy** stage does not run. The live site still shows the previous version.
4. Choose **View details** on the failed Build action, read the CodeBuild log, and find the failing assertion.
5. Undo the change (or update the test to match), push, and confirm a new execution succeeds.

> Key point: a failed stage blocks everything after it, so a broken build never reaches the running application.

### Experiment B: Permission error in the deploy stage (instructor demo or optional)

1. Open the pipeline service role in **IAM**.
2. Temporarily remove the Elastic Beanstalk permissions (or ask the instructor to demonstrate).
3. Run the pipeline with **Release change**. The Deploy stage fails with `AccessDenied`.
4. Restore the permission and use **Retry** on the failed stage.

---

## Step 10 (optional): Add a manual approval gate

This turns the pipeline from Continuous Integration plus automatic deployment into **Continuous Delivery**.

1. Open the pipeline and choose **Edit**.
2. Between Build and Deploy, choose **Add stage**, name it `Approval`.
3. **Add action group**: action name `ManualApproval`, provider **Manual approval**.
4. Choose **Done**, then **Save**.
5. Release a change. The pipeline pauses at Approval until someone chooses **Review**, then **Approve**. Only then does the Deploy stage update the application.

---

## Troubleshooting guide

| Symptom | Likely cause | Fix |
|---|---|---|
| Pipeline does not start on push | Connection pending or not authorized, wrong branch, trigger disabled | Check the connection status, branch name and trigger settings |
| Source stage fails | GitHub connection or repository access problem | Re-authorize the connection, and confirm **AWS Connector for GitHub** has access to your fork |
| Build stage fails | Failing test or buildspec error | Open **View details**, then read the CodeBuild logs |
| Build cannot find artifact files | Wrong `base-directory` or the folder was not created | Confirm `npm run build` creates `dist/` |
| Deploy stage `AccessDenied` | Pipeline service role lacks Elastic Beanstalk permission | Add the needed Beanstalk, EC2, Auto Scaling, S3 and CloudFormation permissions to the pipeline role |
| Deploy succeeds but the site shows **502 Bad Gateway** | App listens on a hardcoded port | Use `process.env.PORT` in `app.js` (Step 1.1) |
| Site still shows the sample page | Deploy has not finished, or an older version is shown | Wait for the environment to return to **Ok**, then hard-refresh the page |
| Environment health is **Severe** or **Degraded** | App crashed on start | In Beanstalk open **Logs**, then **Request logs**, and read the `web.stdout.log` and `eb-engine.log` files |
| Beanstalk environment creation fails | Missing EC2 instance profile | Create `aws-elasticbeanstalk-ec2-role` with the three Beanstalk managed policies (Step 2.2) |
| Pipeline stuck waiting | Manual approval pending | Open the Approval action and approve or reject |
| Stage failed due to a temporary issue | Transient error | Use **Retry** on the failed stage |

### Useful AWS CLI commands

```bash
aws codepipeline list-pipeline-executions --pipeline-name codebuild-demo-pipeline

aws codepipeline get-pipeline-state --pipeline-name codebuild-demo-pipeline

aws codepipeline start-pipeline-execution --name codebuild-demo-pipeline

aws elasticbeanstalk describe-environment-health \
  --environment-name codebuild-demo-env --attribute-names All
```

---

## Review questions

1. What is the difference between Continuous Delivery and Continuous Deployment?
2. What is the relationship between a stage and an action?
3. How does the build stage receive the code fetched by the source stage?
4. A commit was pushed but the pipeline did not start. List three things you would check.
5. The Build stage fails. Where do you look first to find the cause?
6. How would you add a human approval before deployment?
7. Why did the app need to use `process.env.PORT` on Elastic Beanstalk?

<details>
<summary>Suggested answers</summary>

1. Delivery keeps every change release-ready but needs a manual decision to release; Deployment releases every passing change automatically.
2. A stage is a group of actions; actions are the individual tasks within it.
3. Through artifacts: the Source action outputs `SourceArtifact`, which is the input of the CodeBuild action, passed via the S3 artifact bucket.
4. The connection status, the branch name and trigger configuration, and whether the pipeline or trigger is enabled.
5. Choose **View details** on the failed action and read the CodeBuild logs.
6. Add a stage with a **Manual approval** action before the Deploy stage.
7. Beanstalk's proxy forwards requests to the port given in the `PORT` environment variable. If the app listens on a different port, the proxy cannot reach it and returns 502.

</details>

---

## Cleanup (avoid charges)

The Beanstalk environment runs an EC2 instance that keeps costing money until it is terminated, so do this first.

1. In **Elastic Beanstalk**, select `codebuild-demo-env`, then **Actions**, then **Terminate environment**. After it finishes, delete the application `codebuild-demo-app`.
2. Delete the pipeline `codebuild-demo-pipeline`.
3. Empty and delete the pipeline artifact bucket (named `codepipeline-<region>-...`) and any Beanstalk bucket (named `elasticbeanstalk-<region>-...`) you no longer need.
4. Delete the CodeBuild project and its CloudWatch log group.
5. Delete the GitHub connection under **Settings, Connections** in the Developer Tools console.
6. Delete the pipeline service role and, if you created them only for this lab, the Beanstalk roles in IAM.

## Lab completion checklist

- [ ] `app.js` updated to use `process.env.PORT` and pushed
- [ ] Beanstalk application and environment created and healthy
- [ ] Pipeline created with Source, Build and Deploy stages
- [ ] First execution succeeded in all stages
- [ ] Application page opens on the Beanstalk URL
- [ ] A push to `main` updated the running application automatically
- [ ] A failing build blocked deployment and was fixed from the logs
- [ ] (Optional) Manual approval stage added
- [ ] Beanstalk environment terminated during cleanup

## Key takeaways

- A pipeline is stages made of actions; artifacts connect the actions.
- The source stage trigger turns every commit into an automated run.
- A failure in any stage stops the pipeline, which protects the running application.
- **View details** on a failed action is the fastest route to the real error.
- Elastic Beanstalk runs the application for you; the pipeline only needs to hand it a build artifact.
- Add a manual approval to move from Continuous Deployment to Continuous Delivery.
