# workbench-tos
APIs - currently implemented as a Cloud Function - for users' responses to Terms of Service.

# Developer setup
This codebase requires *[npm](https://docs.npmjs.com/getting-started/what-is-npm)* and *[Node.js](https://nodejs.org/en/)*. Specifically, it wants Node.js version 6.14, or whatever minor/patch version Google documents at https://cloud.google.com/functions/docs/concepts/nodejs-6-runtime.

If you already have a different version of Node on your system, you might be interested in *[nvm](https://github.com/creationix/nvm)*.

If you have a hard time finding Node 6.14 to install, you really might be interested in *[nvm](https://github.com/creationix/nvm)*. First, install *nvm* according to their instructions. Then, use *nvm* to install and use the appropriate version of Node, e.g. `nvm install 6.14.4`. *nvm* will automatically use the version of Node you just installed, but for good measure you can `nvm ls` to see installed versions, then `nvm use 6.14.4` to use that version if you aren't already using it.

To install third-party libraries, first `cd function`, then `npm install`. You will need to `npm install` any time [package.json](function/package.json) or [package-lock.json](function/package-lock.json) changes. Conversely, if those files have not changed since your last install, you should not have to run `npm install`.

# Testing
1. `cd function` - make sure you're in the right directory. The root of this repostory is NOT the right directory!
2. `npm install` - get all the third-party dependencies, if you have not done so already. `npm i` is the shorthand.
3. `npm test`

# Linting
1. `cd function` - make sure you're in the right directory. The root of this repostory is NOT the right directory!
2. `npm install` - get all the third-party dependencies, if you have not done so already. `npm i` is the shorthand.
3. `npm run lint` - note you need the extra `run` command.

As of this writing, `npm run lint` has a lot of errors! Fixing these is an outstanding TODO.
