'use strict';

const GoogleOAuthAuthorizer = require('./authorization');
const GoogleDatastoreClient = require('./datastore');
const toshandler = require('./toshandler.js');

// handle CORS requests via 'cors' library
const corsOptions = {
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'Origin', 'X-App-ID'],
};
const cors = require('cors')(corsOptions);

function respondWithError(res, error, prefix) {
    const code = error.statusCode || 500;
    const pre = prefix || '';
    const respBody = pre + (error.message || JSON.stringify(error));
    // suppress error logging for unit tests
    // TODO: we should only log true runtime errors as Errors, and log bad user inputs etc. as warnings.
    if (process.env.NODE_ENV !== 'test') {
        console.error(new Error('Error ' + code + ': ' + respBody));
    }
    res.status(code).json(respBody);
}

/**
 * Implementation of the TOS APIs. This tosapi() function should always either:
 *  - throw an error
 *  - return a resolved Promise containing the retrieved or inserted datastore values
 *  - return a rejected Promise containing a relevant error
 *
 * As compared to the tos(req, res) function below this - which is the entry point for
 * the Cloud Function - this tosapi() function should be unit-testable.
 *
 * @param {*} req The user's request object
 * @param {*} res The user's response object. This is needed by the cors third-party library
 * @param {*} authClient The authorizer class used to auth the user. This exists as an argument
 *  so tests can override it.
 * @param {*} datastoreClient The datastore client class used to read/write persistent data.
 *  This exists as an argument so tests can override it.
 */
function tosapi(req, res, authClient, datastoreClient) {
    // unit tests may override these. At runtime, when called as a live Cloud Function from tos(),
    // authClient and datastoreClient will be null.
    const authorizer = authClient || new GoogleOAuthAuthorizer();
    const datastore = datastoreClient || new GoogleDatastoreClient();

    // TODO: route to different handlers for userRequest vs. status
    return toshandler.handleRequest(req, authorizer, datastore);
}

/**
 * Main entry point for the Cloud Function.
 *
 * Due to Cloud Function signature requirements, this function writes to the result object
 * but does not return a result. Therefore it is hard to test; keep this function small
 * and make its implementation - tosapi() - the testable one.
 *
 */
function tos(req, res) {
    try {
        cors(req, res, () => {
            tosapi(req, res, null, null)
                .then(tosresult => {
                    res.status(200).json(tosresult);
                })
                .catch(err => {
                    respondWithError(res, err);
                });
        });
    } catch (err) {
        respondWithError(res, err);
    }
}

exports.tosapi = tosapi;
exports.tos = tos;
