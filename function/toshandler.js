'use strict';

const {validateRequestUrl, validateRequestMethod, validateContentType,
    requireAuthorizationHeader, validateInputs} = require('./validation.js');
const { prefixedRejection } = require('./responseError');

const handleRequest = function(req, authorizer, datastore) {
    validateRequestUrl(req);
    validateRequestMethod(req);
    validateContentType(req);
    const authHeader = requireAuthorizationHeader(req);
    const reqinfo = validateInputs(req);

    return authorizer.authorize(authHeader)
        .then(userinfo => {
            if (req.method === 'GET') {
                try {
                    return datastore.getUserResponse(userinfo, reqinfo)
                        .catch(err => {
                            return prefixedRejection(err, 'Error reading user response');
                        });
                } catch (err) {
                    return prefixedRejection(err, 'Error reading user response');
                }
            } else if (req.method === 'POST') {
                try {
                    return datastore.createUserResponse(userinfo, reqinfo)
                        .catch(err => {
                            return prefixedRejection(err, 'Error writing user response');
                        });
                } catch (err) {
                    return prefixedRejection(err, 'Error writing user response');
                }
            } else {
                return Promise.reject({statusCode: 405});
            }
        });
};

module.exports.handleRequest = handleRequest;
