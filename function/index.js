const auth = require('./authorization');
const ds = require('./datastore');

// handle CORS requests via 'cors' library
const corsOptions = {
  methods: ['GET', 'POST'],
  allowedHeaders: ['Authorization','Content-Type','Accept','Origin','X-App-ID']
}
const cors = require('cors')(corsOptions);

function validateRequestUrl(req) {
  if (req.path != '/v1/user/response' && req.path != '/user/response') {
    throwResponseError(404);
  }
}

function validateRequestMethod(req) {
  if (!['GET', 'POST', 'OPTIONS'].includes(req.method)) {
    throwResponseError(405)
  }
}

function requireAuthorizationHeader(req) {
  if (req.method == 'GET' || req.method == 'POST') {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throwResponseError(401);
    } else {
      return authHeader;
    }
  }
}

function validateContentType(req) {
  if (req.method == 'POST') {
    const contentTypeHeader = req.headers['content-type'];
    if (!contentTypeHeader || contentTypeHeader.indexOf('application/json') !== 0) {
      throwResponseError(415);
    }
  }
}

function validateInputs(req) {
  let inputErrors = [];
  let appid, tosversion, accepted;

  if (req.method == 'GET') {
    appid = req.query['appid'];
    try {
      tosversion = parseFloat(req.query['tosversion']);
    } catch (parseError) {
      // swallow the error. Unparsable values will result in NaN, and the typecheck
      // further down in this method (isNaN / typeof != 'number') will handle this case.
      console.warn('error parsing tosversion value: ' + req.query['tosversion']);
    }
  } else if (req.method == 'POST') {
    if (req.body != Object(req.body)) {
      throwResponseError(400, 'Request body must be valid JSON.')
    }
    appid = req.body['appid'];
    tosversion = req.body['tosversion'];
    accepted = req.body['accepted'];
    if (typeof accepted != 'boolean') {
      inputErrors.push('accepted must be a Boolean.');
    }
  } else {
    // this should never happen, since validateRequestMethod is called before this method
    throwResponseError(405);
  }

  if (typeof appid != 'string' && !(appid instanceof String)) {
    inputErrors.push('appid must be a String.');
  }
  if (isNaN(tosversion) || typeof tosversion != 'number') {
    inputErrors.push('tosversion must be a Number.');
  }

  if (inputErrors.length > 0) {
    throwResponseError(400, inputErrors.join(' '));
  } else {
    let reqinfo = {
      appid: appid,
      tosversion: tosversion
    };
    if (typeof accepted != 'undefined') {
      reqinfo.accepted = !!accepted;
    }
    return reqinfo;
  }
}

function throwResponseError(statusCode, message) {
  const msg = JSON.stringify(message || statusCode);
  throw {
    statusCode: statusCode,
    message: msg
  };
}

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

  /*
    TODO:
    - disable CORS and pass through from orch?
    - move supporting functions to separate file(s)
    - unit tests / shims
    - if POST request:
      - verify Application and TermsOfService ancestors exist before inserting (what do if they don't?)
  */

exports.tos = (req, res, authClient, datastoreClient) => {
  try {
    // unit tests may override these. At runtime, when called as a live Cloud Function from tos(),
    // authClient and datastoreClient will be null.
    const authorizer = authClient || auth.getAuthorizer();
    const datastore = datastoreClient || ds.getDatastoreClient();

    validateRequestUrl(req);
    validateRequestMethod(req);
    validateContentType(req);
    cors(req, res, () => {
      const authHeader = requireAuthorizationHeader(req);
      const reqinfo = validateInputs(req);

      console.log('using authorizer: ' + authorizer.toString());
      authorizer.authorize(authHeader)
        .then( userinfo => {
          if (req.method == 'GET') {
            datastore.getUserResponse(userinfo, reqinfo)
              .then( userResponse => {
                res.status(200).json(userResponse);
              })
              .catch( err => {
                respondWithError(res, err, 'Error querying for user response: ');
              });
          } else if (req.method == 'POST') {
            datastore.insertUserResponse(userinfo, reqinfo)
              .then( userResponse => {
                res.status(200).json(userResponse);
              })
              .catch( err => {
                respondWithError(res, err, 'Error writing user response: ');
              });
          } else {
            // this should never happen, given the validateRequestMethod call above
            res.status(405).send();
          }
        })
        .catch( err => {
          respondWithError(res, err, 'Error authorizing user: ');
        });
      });
  } catch (err) {
    respondWithError(res, err);
  }
};

/**
 * Main entry point for the Cloud Function.
 * 
 * Due to Cloud Function signature requirements, this function writes to the result object
 * but does not return a result. Therefore it is hard to test; keep this function small
 * and make its implementation - tosapi() - the testable one.
 * 
 */
exports.tosshell = (req, res) => {
  try {
    tosapi(req)
      .then( (tosresult) => {
        res.status(200).json(tosresult);
      })
      .catch( (err) => {
        respondWithError(res, err);
      })
  } catch (err) {
    respondWithError(res, err);
  }
}
