// Create persistent/pipelined http client for outbound requests
const requestPromise = require('request-promise-native');
const persistentRequest = requestPromise.defaults({
  forever: true
});

// Google REST API for tokeninfo
const tokenInfoUrl = 'https://www.googleapis.com/oauth2/v2/tokeninfo';

// handle CORS requests via 'cors' library
const corsOptions = {
  methods: ['GET', 'POST'],
  allowedHeaders: ['Authorization','Content-Type','Accept','Origin','X-App-ID']
}
const cors = require('cors')(corsOptions);

// Read the project ID from environment
const projectId = process.env.GCP_PROJECT;
// Create datastore client
const Datastore = require('@google-cloud/datastore');
const datastore = new Datastore({
  projectId: projectId,
});

// Datastore namespace and kinds
const appNamespace = 'app';
const kindApplication = 'Application';
const kindTos = 'TermsOfService';
const kindUserResponse = 'TOSResponse';

function tosKeyArrayParts(appId, tosVersion) {
  return [kindApplication, appId, kindTos, tosVersion.toString()];
}

function generateKey(keyparts) {
  return datastore.key({
    namespace: appNamespace,
    path: keyparts
  });
}

function generateTosKey(appId, tosVersion) {
  return generateKey(tosKeyArrayParts(appId, tosVersion));
}

function generateUserResponseKey(appId, tosVersion) {
  let userResponseParts = tosKeyArrayParts(appId, tosVersion);
  userResponseParts.push(kindUserResponse);
  return generateKey(userResponseParts);
}

/**
 * Extracts an Authorization header from the request, then queries
 * Google for token information using that auth header.
 * 
 * Returns a Promise that contains Google's tokeninfo response,
 * or rejects with an http status code and error.
 *  
 * @param {*} req the original request
 */
function authorize(authHeader) {
  if (authHeader) {
    const token = authHeader.replace('Bearer ','');
    const reqUrl = tokenInfoUrl + '?access_token=' + token;
    const reqOptions = {
      method: 'GET',
      uri: reqUrl,
      auth: {
        bearer: token
      },
      json: true
    };
    return persistentRequest(reqOptions)
      .then((userinfo) => {
        // TODO: validate audience and/or whitelisted email suffixes
        return userinfo;
      })
      .catch((err) => {
        if (err.hasOwnProperty('statusCode') && err.hasOwnProperty('message')) {
          throwResponseError(err.statusCode, err.message);
        } else {
          throwResponseError(500, err);
        }
      });
  } else {
    throwResponseError(401);
  }
}

function insertUserResponse(userinfo, reqinfo) {
  // extract vars we need from the userinfo/reqinfo
  const userid = userinfo.user_id;
  const email = userinfo.email;
  const appid = reqinfo.appid;
  const tosversion = reqinfo.tosversion;
  const accepted = reqinfo.accepted;

  const userResponseEntity = {
    key: generateUserResponseKey(appid, tosversion),
    data: [
      {
        name: 'userid',
        value: userid
      },
      {
        name: 'email',
        value: email
      },
      {
        name: 'timestamp',
        value: new Date().toJSON()
      },
      {
        name: 'accepted',
        value: accepted
      },
    ]
  };

  // TODO: verify Application and TermsOfService ancestors exist before inserting (what do if they don't?)

  return datastore
    .save(userResponseEntity)
    .then( saved => {
      console.log('Task ${userResponseKey.id} created successfully.');
      return saved;
    })
    .catch(err => {
      throwResponseError(500, err);
    });
}

function getUserResponse(userinfo, reqinfo) {  
  const userid = userinfo.user_id;
  const tosversion = reqinfo.tosversion;
  const appid = reqinfo.appid;

  const query = datastore
    .createQuery(appNamespace, kindUserResponse)
    .hasAncestor(generateTosKey(appid, tosversion))
    .filter('userid', userid.toString())
    .order('timestamp', {descending: true})
    .limit(1);
  
  return datastore
    .runQuery(query)
    .then(results => {
      // results object is an array that contains [0]: array of rows returned; [1]: metadata about the results
      const hits = results[0];
      if (hits.length == 1) {
        if (hits[0].accepted) {
          return Promise.resolve(hits[0]);
        } else {
          throwResponseError(403,'user declined TOS');
        }
      } else if (hits.length > 1) {
        throwResponseError(500,'unexpected: returned too many results');
      } else {
        throwResponseError(404);
      }
    })
    .catch(err => {
      if (err.statusCode) {
        throwResponseError(err.statusCode, err);
      } else {
        throwResponseError(500, err);
      }
    });
}

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
  res.status(code).send(respBody);
}

  /*
    TODO:
    - disable CORS and pass through from orch?
    - move supporting functions to separate file(s)
    - unit tests / shims
    - if POST request:
      - verify Application and TermsOfService ancestors exist before inserting (what do if they don't?)
  */
/**
 * Main function. Validates incoming requests, reads or writes to Datastore (GET or POST, respectively),
 * responds with successes or errors.
 * 
 * @param {!Object} req HTTP request context.
 * @param {!Object} res HTTP response context.
 */
exports.tos = (req, res) => {
  try {
    validateRequestUrl(req);
    validateRequestMethod(req);
    validateContentType(req);
    cors(req, res, () => {
      const authHeader = requireAuthorizationHeader(req);
      const reqinfo = validateInputs(req);
      authorize(authHeader)
        .then( userinfo => {
          if (req.method == 'GET') {
            getUserResponse(userinfo, reqinfo)
              .then( userResponse => {
                res.status(200).json(userResponse);
              })
              .catch( err => {
                respondWithError(res, err, 'Error querying for user response: ');
              });
          } else if (req.method == 'POST') {
            insertUserResponse(userinfo, reqinfo)
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
