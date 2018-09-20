// Create persistent/pipelined http client for outbound requests
const requestPromise = require('request-promise-native');
const persistentRequest = requestPromise.defaults({forever: true});
const _ = require('lodash');

const { rejection, ResponseError } = require('./responseError');

// fail-safe handling of potentially-missing require
let audiencePrefixes = [];
let emailSuffixes = [];
try {
    const oauthConfig = require('./config');
    audiencePrefixes = oauthConfig.audiencePrefixes;
    emailSuffixes = oauthConfig.emailSuffixes;
} catch (err) {
    console.warn('could not load OAuth config require. You can ignore this warning if you are running unit tests and have not rendered ctmpls.');
}

// for replacing the "Bearer " prefix case-insensitively in header values
const bearerPrefix = /^bearer /i;

// the object keys we expect to see in the OAuth token from Google
const userInfoKeys = ['email', 'verified_email', 'user_id', 'audience', 'expires_in'];

// define GoogleOAuthAuthorizer as a class for ease of unit testing - unit tests can mock out parts of these classes.
class GoogleOAuthAuthorizer {
    // TODO: move validation of Authorization request header into this class

    // class constructor accepts config overrides, so unit tests can have some control
    constructor(configObj) {
        const config = configObj || {};
        this.audiencePrefixes = config.audiencePrefixes || audiencePrefixes;
        this.emailSuffixes = config.emailSuffixes || audiencePrefixes;
    }

    callTokenInfoApi(token) {
        const reqUrl = 'https://www.googleapis.com/oauth2/v2/tokeninfo?access_token=' + token;
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

    validateAudienceOrEmail(audience, email) {
        // following two loops use for..in instead of Array.forEach to allow breaking out early
        // does the audience value start with one of our whitelisted prefixes?
        for (const i in this.audiencePrefixes) {
            const prefix = this.audiencePrefixes[i];
            if (audience.startsWith(prefix.toString())) {
                return true;
            }
        }
        // does the email value end with one of our whitelisted suffixes?
        for (const i in this.emailSuffixes) {
            const suffix = this.emailSuffixes[i];
            if (email.endsWith(suffix.toString())) {
                return true;
            }
        }

        return false;
    }

    validateUserInfo(userinfo) {
        // validate all fields exist
        userInfoKeys.forEach( (key) => {
            if (!userinfo.hasOwnProperty(key)) {
                throw new ResponseError(`OAuth token does not include ${key}`, 403);
            }
        })
        // validate verified_email is Boolean and true
        const verified = userinfo.verified_email;
        if (!_.isBoolean(verified)) {
            throw new ResponseError('OAuth token verified_email must be a Boolean.', 403);
        } else if (!verified) {
            throw new ResponseError('OAuth token verified_email must be true.', 403);
        }

        // validate expires_in is numeric and > 0
        const expires = _.toNumber(userinfo.expires_in);
        if (isNaN(expires)) {
            throw new ResponseError('OAuth token expires_in must be a number.', 403);
        } else if (expires <= 0) {
            throw new ResponseError(`OAuth token has expired (expires_in: ${expires})`, 403);
        }
        // validate audience/email
        if (!this.validateAudienceOrEmail(userinfo.audience.toString(), userinfo.email.toString())) {
            throw new ResponseError(`OAuth token has unacceptable audience (${userinfo.audience}) or email (${userinfo.email})`, 403);
        };
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
                    this.validateUserInfo(userinfo);
                    // TODO: validate audience and/or whitelisted email suffixes
                    return userinfo;
                })
                .catch((err) => {
                    const statusCode = err.statusCode || 400;
                    const requestError = err.error || {};
                    const message = requestError.error_description || err.message || JSON.stringify(err);
                    return rejection(statusCode, 'Error authorizing user: ' + message);
                });
        } else {
            return rejection(401);
        }
    }
}

module.exports = GoogleOAuthAuthorizer;
