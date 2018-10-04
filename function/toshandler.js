'use strict';

const validation = require('./validation.js');
const { prefixedRejection } = require('./responseError');

const handleRequest = function(req, authorizer, datastore) {
    validation.validateRequestUrl(req);
    validation.validateRequestMethod(req);
    validation.validateContentType(req);
    const authHeader = validation.requireAuthorizationHeader(req);
    const reqinfo = validation.validateInputs(req);

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
