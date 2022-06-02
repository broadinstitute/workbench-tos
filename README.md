# workbench-tos
THIS REPO HAS BEEN ARCHIVED

APIs - currently implemented as a Cloud Function - for users' responses to Terms of Service.

# Developer setup
## Prerequisites
This codebase requires *[npm](https://docs.npmjs.com/getting-started/what-is-npm)* and *[Node.js](https://nodejs.org/en/)*. Specifically, it wants Node.js version 14, or any specific minor/patch version Google documents at https://cloud.google.com/functions/docs/concepts/exec#runtimes.

If you already have a different version of Node on your system, you might be interested in *[nvm](https://github.com/creationix/nvm)*.

If you have a hard time finding Node 14 to install, you really might be interested in *[nvm](https://github.com/creationix/nvm)*. First, install *nvm* according to their instructions. Then, use *nvm* to install and use the appropriate version of Node, e.g. `nvm install v14`. *nvm* will automatically use the version of Node you just installed, but for good measure you can `nvm ls` to see installed versions, then `nvm use v14` to use that version if you aren't already using it.

To install third-party libraries, first `cd function`, then `npm install`. You will need to `npm install` any time [package.json](function/package.json) or [package-lock.json](function/package-lock.json) changes. Conversely, if those files have not changed since your last install, you should not have to run `npm install`.

## git-secrets
* If you have not done so already run `brew install git-secrets`
* To ensure git secrets is run please copy or link the *hooks* directory to .git/hooks/ locally.
* For more information (as a Broadie) see: https://broadinstitute.atlassian.net/wiki/spaces/GAWB/pages/136445956/Git+Secrets+SHHHHH

# Testing
1. `cd function` - make sure you're in the right directory. The root of this repostory is NOT the right directory!
2. `npm install` - get all the third-party dependencies, if you have not done so already. `npm i` is the shorthand.
3. `npm test`

# Linting
1. `cd function` - make sure you're in the right directory. The root of this repostory is NOT the right directory!
2. `npm install` - get all the third-party dependencies, if you have not done so already. `npm i` is the shorthand.
3. `npm run lint` - note you need the extra `run` command.

# Broad Internal
This section applies only to running the workbench-tos codebase within the Broad Institute.

## Deploying
To deploy the TOS API:
1. If you are deploying a new version of the codebase, create a tag or release within github for the commit you want to deploy. By convention, we only deploy tagged commits; we do not care about branches of this repo for deploys. If you simply need to deploy/redeploy a pre-existing tag/release, you can skip this step.
2. Navigate to the `workbench-tos-manual-deploy` Jenkins job in dev Jenkins, and choose "Build with Parameters". Specify appropriate parameters:
    * `BRANCH_OR_TAG`: specify the github release/tag you wish to deploy.
    * `TARGET`: specify the runtime environment to which you wish to deploy.
    * `SLACK_CHANNEL`: as desired, specify the Slack channel to be notified upon the deploy finishing.
3. Click the Build button.
4. Verify the deploy succeeded. This step is dependent on your reason for deploying - for instance, if you were deploying to add a feature/fix a bug, you can click through your use case to verify the feature/bugfix.

For deploys to prod, the process is exactly the same, except you will need to work in the prod Jenkins instance, not dev Jenkins.
