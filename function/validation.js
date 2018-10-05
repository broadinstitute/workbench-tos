'use strict';

const { ResponseError } = require('./responseError');

const throwResponseError = function(statusCode, message) {
    throw new ResponseError(message, statusCode);
};

const validateRequestMethod = function(req) {
    if (!['GET', 'POST', 'OPTIONS'].includes(req.method)) {
        throwResponseError(405);
    }
};

const requireAuthorizationHeader = function(req) {
    if (req.method === 'GET' || req.method === 'POST') {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            throwResponseError(401);
        } else {
            return authHeader;
        }
    }
};

const validateContentType = function(req) {
    if (req.method === 'POST') {
        const contentTypeHeader = req.headers['content-type'];
        if (!contentTypeHeader || contentTypeHeader.indexOf('application/json') !== 0) {
            throwResponseError(415);
        }
    }
};

const validateInputs = function(req) {
    let inputErrors = [];
    let appid, tosversion, accepted;

    if (req.method === 'GET') {
        appid = req.query['appid'];
        try {
            tosversion = parseFloat(req.query['tosversion']);
        } catch (parseError) {
            // swallow the error. Unparsable values will result in NaN, and the typecheck
            // further down in this method (isNaN / typeof != 'number') will handle this case.
            console.warn('error parsing tosversion value: ' + req.query['tosversion']);
        }
    } else if (req.method === 'POST') {
        if (req.body !== Object(req.body)) {
            throwResponseError(400, 'Request body must be valid JSON.');
        }
        appid = req.body['appid'];
        tosversion = req.body['tosversion'];
        accepted = req.body['accepted'];
        if (typeof accepted !== 'boolean') {
            inputErrors.push('accepted must be a Boolean.');
        }
    } else {
        // this should never happen, since validateRequestMethod is called before this method
        throwResponseError(405);
    }

    if (typeof appid !== 'string' && !(appid instanceof String)) {
        inputErrors.push('appid must be a String.');
    }
    if (isNaN(tosversion) || typeof tosversion !== 'number') {
        inputErrors.push('tosversion must be a Number.');
    }

    if (inputErrors.length > 0) {
        throwResponseError(400, inputErrors.join(' '));
    } else {
        let reqinfo = {
            appid: appid,
            tosversion: tosversion,
        };
        if (typeof accepted !== 'undefined') {
            reqinfo.accepted = !!accepted;
        }
        return reqinfo;
    }
};

module.exports = {throwResponseError, validateRequestMethod, requireAuthorizationHeader,
    validateContentType, validateInputs};
