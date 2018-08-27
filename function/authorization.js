// Create persistent/pipelined http client for outbound requests
const requestPromise = require('request-promise-native');
const persistentRequest = requestPromise.defaults({
  forever: true
});

// for replacing the "Bearer " prefix case-insensitively in header values
const bearerPrefix = /^bearer /i;

class Authorizer {
    authorize() {
        throw new Error('subclasses must implement');
    }
}

class GoogleOAuthAuthorizer extends Authorizer {
    // TODO: move validation of Authorization request header into this class

    // Google REST API for tokeninfo
    tokenInfoUrl(token) {
        return 'https://www.googleapis.com/oauth2/v2/tokeninfo?access_token=' + token;
    }

    callTokenInfoApi(token) {
        const reqUrl = this.tokenInfoUrl(token);
        const reqOptions = {
            method: 'POST',
            uri: reqUrl,
            auth: {
            bearer: token
            },
            json: true
        };
        return persistentRequest.post(reqOptions)
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
    authorize(authHeader) {
        if (authHeader) {
            const token = authHeader.replace(bearerPrefix,'');
            return this.callTokenInfoApi(token)
                .then((userinfo) => {
                    // TODO: validate audience and/or whitelisted email suffixes
                    return userinfo;
                })
                .catch((err) => {
                    const statusCode = err.statusCode || 400;
                    const requestError = err.error || {};
                    const message = requestError.error_description || err.message || JSON.stringify(err);
                    return Promise.reject({statusCode: statusCode, message: message});
                });
        } else {
            return Promise.reject({statusCode: 401});
        }
    }
}

function getAuthorizer() {
    return new GoogleOAuthAuthorizer();
}

module.exports.getAuthorizer = getAuthorizer;
module.exports.GoogleOAuthAuthorizer = GoogleOAuthAuthorizer;
