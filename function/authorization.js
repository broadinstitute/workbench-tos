'use strict';

// Create persistent/pipelined http client for outbound requests
const requestPromise = require('request-promise-native');
const persistentRequest = requestPromise.defaults({forever: true});
const _ = require('lodash');

const { rejection, ResponseError } = require('./responseError');

// fail-safe handling of potentially-missing require. In live deploys, this require
// will exist because our deploy process will render it based on config.js.ctmpl.
// if you have simply checked out the codebase and are running unit tests - without
// rendering .ctmpls - the require will not exist. We want to allow this.
//
// Unit tests override the audiencePrefixes and emailSuffixes values.
// In a live deploy, if the config is missing, we default to [], which equates to an
// empty whitelist.
let audiencePrefixes = [];
let emailSuffixes = [];
try {
    const oauthConfig = require('./config');
    audiencePrefixes = oauthConfig.audiencePrefixes;
    emailSuffixes = oauthConfig.emailSuffixes;
} catch (err) {
    console.warn('could not load OAuth config require. You can ignore this warning if you are running ' +
        'unit tests and have not rendered ctmpls.');
}

// for replacing the "Bearer " prefix case-insensitively in header values
const bearerPrefix = /^bearer /i;

// the object keys we expect to see in the OAuth token from Google
const userInfoKeys = ['email', 'verified_email', 'user_id', 'audience', 'expires_in'];

// define GoogleOAuthAuthorizer as a class for ease of unit testing;
// unit tests can mock out parts of these classes.
class GoogleOAuthAuthorizer {
    // TODO: move validation of Authorization request header into this class

    // class constructor accepts config overrides, so unit tests can have some control
    constructor(configObj) {
        const config = configObj || {};
        this.audiencePrefixes = config.audiencePrefixes || audiencePrefixes;
        this.emailSuffixes = config.emailSuffixes || emailSuffixes;
    }

    callTokenInfoApi(token) {
        const reqUrl = 'https://www.googleapis.com/oauth2/v2/tokeninfo?access_token=' + token;
        const reqOptions = {
            method: 'POST',
            uri: reqUrl,
            auth: {
                bearer: token,
            },
            json: true,
        };
        return persistentRequest.post(reqOptions);
    }

    validateAudienceOrEmail(audience, email) {
        let valid = false;
        // following two loops use for..in instead of Array.forEach to allow breaking out early

        // does the audience value start with one of our whitelisted prefixes?
        for (const i in this.audiencePrefixes) {
            const prefix = this.audiencePrefixes[i];
            if (audience.startsWith(prefix)) {
                valid = true;
                break;
            }
        }
        // if we haven't matched an audience,
        // does the email value end with one of our whitelisted suffixes?
        if (!valid) {
            for (const i in this.emailSuffixes) {
                const suffix = this.emailSuffixes[i];
                if (email.endsWith(suffix)) {
                    valid = true;
                    break;
                }
            }
        }

        return valid;
    }

    validateUserInfo(userinfo) {
        if (_.isNull(userinfo)) {
            throw new ResponseError('OAuth response is null', 401);
        };

        if (!_.isObject(userinfo)) {
            throw new ResponseError(`OAuth response is not an object: ${typeof userinfo}`, 401);
        };

        // validate all fields exist
        userInfoKeys.forEach((key) => {
            if (!userinfo.hasOwnProperty(key)) {
                throw new ResponseError(`OAuth token does not include ${key}`, 401);
            }
        });
        // validate verified_email is Boolean and true
        const verified = userinfo.verified_email;
        if (!_.isBoolean(verified)) {
            throw new ResponseError('OAuth token verified_email must be a Boolean.', 401);
        } else if (!verified) {
            throw new ResponseError('OAuth token verified_email must be true.', 401);
        }

        // validate expires_in is numeric and > 0
        const expires = _.toNumber(userinfo.expires_in);
        if (isNaN(expires)) {
            throw new ResponseError('OAuth token expires_in must be a number.', 401);
        } else if (expires <= 0) {
            throw new ResponseError(`OAuth token has expired (expires_in: ${expires})`, 401);
        }
        // validate audience/email
        if (!this.validateAudienceOrEmail(userinfo.audience.toString(), userinfo.email.toString())) {
            throw new ResponseError(`OAuth token must have an acceptable audience (${userinfo.audience}) ` +
                `or email (${userinfo.email})`, 401);
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
            const token = authHeader.replace(bearerPrefix, '');
            return this.callTokenInfoApi(token)
                .then((userinfo) => {
                    this.validateUserInfo(userinfo);
                    return userinfo;
                })
                .catch((err) => {
                    if (err.statusCode && process.env.NODE_ENV !== 'test') {
                        console.error(`Tokeninfo API responded with error: ${JSON.stringify(err)}`);
                    }
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
