# workbench-tos
APIs - currently implemented as a Cloud Function - for users' responses to Terms of Service.

# Testing
1. Install the [Cloud Functions Node.js Emulator](https://cloud.google.com/functions/docs/emulator), including its dependencies such as Node.js >= 6.11.1.
2. `cd function` - make sure you're in the right directory. The root of this repostory is NOT the right directory!
3. `npm install` to get all the third-party dependencies
4. start the emulator with `functions-emulator start`
5. `npm test`

## Optimizing test runs
By default, `npm test` will redeploy the function code to the emulator every time it runs. This is slow. If you are not changing function code between test runs - for instance, you are writing new tests - you may want to disable auto-deploy. Do this by commenting out the single line of code in [updateFunction.sh](function/test/updateFunction.sh).



# Linting
1. `cd function` - make sure you're in the right directory. The root of this repostory is NOT the right directory!
2. `npm install` to get all the third-party dependencies
3. `npm run lint`

As of this writing, `npm run lint` has a lot of errors! Fixing these is an outstanding TODO.
