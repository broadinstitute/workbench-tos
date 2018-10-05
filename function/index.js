'use strict';

const GoogleOAuthAuthorizer = require('./authorization');
const GoogleDatastoreClient = require('./datastore');
const toshandler = require('./toshandler.js');
const statushandler = require('./statushandler.js');
const {throwResponseError} = require('./validation.js');

// handle CORS requests via 'cors' library
const corsOptions = {
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'Origin', 'X-App-ID'],
};
const cors = require('cors')(corsOptions);

const respondWithError = function(res, error, prefix) {
    const code = error.statusCode || 500;
    const pre = prefix || '';
    const respBody = pre + (error.message || JSON.stringify(error));
    // suppress error logging for unit tests
    // TODO: we should only log true runtime errors as Errors, and log bad user inputs etc. as warnings.
    if (process.env.NODE_ENV !== 'test') {
        console.error(new Error('Error ' + code + ': ' + respBody));
    }
    res.status(code).json(respBody);
};

const routes = {
    '/v1/user/response': toshandler.handleRequest,
    '/user/response': toshandler.handleRequest,
    '/v1/status': statushandler.handleRequest,
    '/status': statushandler.handleRequest,
};

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
const tosapi = function(req, res, authClient, datastoreClient) {

    const requestHandler = routes[req.path];

    if (requestHandler) {
        // unit tests may override these. At runtime, when called as a live Cloud Function from tos(),
        // authClient and datastoreClient will be null.
        const authorizer = authClient || new GoogleOAuthAuthorizer();
        const datastore = datastoreClient || new GoogleDatastoreClient();

        return requestHandler(req, authorizer, datastore);
    } else {
        throwResponseError(404);
    }
};

const responseCode = function(payload) {
    return (payload instanceof statushandler.StatusCheckResponse && !payload.ok) ? 500 : 200;
};

/**
 * Main entry point for the Cloud Function.
 *
 * Due to Cloud Function signature requirements, this function writes to the result object
 * but does not return a result. Therefore it is hard to test; keep this function small
 * and make its implementation - tosapi() - the testable one.
 *
 */
const tos = function(req, res) {
    try {
        cors(req, res, () => {
            tosapi(req, res, null, null)
                .then(tosresult => {
                    res.status(responseCode(tosresult)).json(tosresult);
                })
                .catch(err => {
                    respondWithError(res, err);
                });
        });
    } catch (err) {
        respondWithError(res, err);
    }
};

module.exports = {tosapi, tos, responseCode};
