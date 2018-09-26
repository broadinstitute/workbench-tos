'use strict';

const test = require('ava');
const sinon = require('sinon');
const requestPromiseErrors = require('request-promise-native/errors');
const GoogleOAuthAuthorizer = require('../authorization');
const { tosapi } = require('../index');

process.env.NODE_ENV = 'test';

class FailingMockAuthorizer extends GoogleOAuthAuthorizer {
    callTokenInfoApi(token) {
        // this is the error structure returned by request-promise-native/Google:
        const invalidTokenError = new requestPromiseErrors.StatusCodeError(
            400,
            {error_description: 'Invalid Value'},
            {}, // copy of the options used for the request; irrelevant for this test
            {} // full response for the request; irrelevant for this test
        );
        return Promise.reject(invalidTokenError);
    }
}

const dummyUserInfo = {
    user_id: 12321,
    email: 'fake@fakey.fake',
    verified_email: true,
    audience: 122333444455555,
    expires_in: 500,
};

class SuccessfulMockAuthorizer extends GoogleOAuthAuthorizer {
    constructor(configObj) {
        super({audiencePrefixes: [122333444455555]});
    }

    callTokenInfoApi(token) {
        return Promise.resolve(dummyUserInfo);
    }
}

class TokenValueTestingAuthorizer extends GoogleOAuthAuthorizer {
    constructor(configObj) {
        super({audiencePrefixes: [122333444455555]});
    }

    // if value of token is 'expected-token', succeed; otherwise fail
    callTokenInfoApi(token) {
        if (token === 'expected-token') {
            return Promise.resolve(dummyUserInfo);
        } else {
            const invalidTokenError = new requestPromiseErrors.StatusCodeError(
                400,
                {error_description: 'Unit test-thrown error! Expected the token value to be ' +
                    '[expected-token] but got [' + token + ']'},
                {}, // copy of the options used for the request; irrelevant for this test
                {} // full response for the request; irrelevant for this test
            );
            return Promise.reject(invalidTokenError);
        }
    }
}

const echoDatastore = {
    // this echos the userinfo returned by the authorizer.
    // we use this echo to test that the userinfo object is passed
    // correctly from the authorizer to the datastore client.
    createUserResponse: (userinfo, reqinfo) => {
        return Promise.resolve(userinfo);
    },
    getUserResponse: (userinfo, reqinfo) => {
        // we need to also include accepted:true so the datastore-related checks will pass.
        return Promise.resolve({
            accepted: true,
            userid: userinfo.user_id,
            email: userinfo.email,
        });
    },
};

function stubbedRes() {
    return {
        setHeader: sinon.stub(),
        send: sinon.stub(),
        json: sinon.stub(),
        status: sinon.stub().returnsThis(),
    };
}

test('authorization: should return error if authorizer returns an error', async t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake',
        },
        method: 'GET',
        query: {
            appid: 'FireCloud',
            tosversion: 20180815.1,
        },
    };
    const res = stubbedRes();

    const error = await t.throwsAsync(tosapi(req, res, new FailingMockAuthorizer(), echoDatastore));
    t.is(error.statusCode, 400);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: Invalid Value');
});

test('authorization: should pass userinfo onwards to datastore', async t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake',
        },
        method: 'GET',
        query: {
            appid: 'FireCloud',
            tosversion: 20180815.1,
        },
    };
    const res = stubbedRes();

    return tosapi(req, res, new SuccessfulMockAuthorizer(), echoDatastore)
        .then(datastoreResult => {
            t.is(datastoreResult.userid, dummyUserInfo.user_id);
            t.is(datastoreResult.email, dummyUserInfo.email);
            t.true(datastoreResult.accepted);
        });

});

test('authorization: should replace "Bearer " in the Authorization header', async t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'Bearer expected-token',
        },
        method: 'GET',
        query: {
            appid: 'FireCloud',
            tosversion: 20180815.1,
        },
    };
    const res = stubbedRes();

    return tosapi(req, res, new TokenValueTestingAuthorizer(), echoDatastore)
        .then(datastoreResult => {
            t.is(datastoreResult.userid, dummyUserInfo.user_id);
            t.is(datastoreResult.email, dummyUserInfo.email);
            t.true(datastoreResult.accepted);
        });
});

test('authorization: should replace "bEArEr " in the Authorization header', async t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'bEArEr expected-token',
        },
        method: 'GET',
        query: {
            appid: 'FireCloud',
            tosversion: 20180815.1,
        },
    };
    const res = stubbedRes();

    return tosapi(req, res, new TokenValueTestingAuthorizer(), echoDatastore)
        .then(datastoreResult => {
            t.is(datastoreResult.userid, dummyUserInfo.user_id);
            t.is(datastoreResult.email, dummyUserInfo.email);
            t.true(datastoreResult.accepted);
        });
});

test('authorization: should not replace "Bear er " in the Authorization header', async t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'Bear er expected-token',
        },
        method: 'GET',
        query: {
            appid: 'FireCloud',
            tosversion: 20180815.1,
        },
    };
    const res = stubbedRes();

    const error = await t.throwsAsync(tosapi(req, res, new TokenValueTestingAuthorizer(), echoDatastore));
    t.is(error.statusCode, 400);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: Unit test-thrown error! Expected the token value to be ' +
        '[expected-token] but got [Bear er expected-token]');
});

test('authorization: should not replace "bearer " in the middle of the Authorization header', async t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'does not start with Bearer !!!',
        },
        method: 'GET',
        query: {
            appid: 'FireCloud',
            tosversion: 20180815.1,
        },
    };
    const res = stubbedRes();

    const error = await t.throwsAsync(tosapi(req, res, new TokenValueTestingAuthorizer(), echoDatastore));
    t.is(error.statusCode, 400);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: Unit test-thrown error! Expected the token value to be ' +
        '[expected-token] but got [does not start with Bearer !!!]');
});


// shared classes/variables for use in the next set of tests

class ArbitraryUserInfoMockAuthorizer extends GoogleOAuthAuthorizer {
    constructor(testUserInfo) {
        super({
            audiencePrefixes: [123, 778899],
            emailSuffixes: ['.unit.test', '.unittest.email.suffix.two'],
        });
        this.testUserInfo = testUserInfo;
    }

    callTokenInfoApi(token) {
        return Promise.resolve(this.testUserInfo);
    }
}

const validReq = {
    path: '/v1/user/response',
    headers: {
        origin: 'unittest',
        authorization: 'Bearer something',
    },
    method: 'GET',
    query: {
        appid: 'FireCloud',
        tosversion: 20180815.1,
    },
};


test('authorization: should reject if email key is missing from OAuth userinfo', async t => {
    const userinfo = {
        // email: 'email@unit.test',
        verified_email: true,
        expires_in: 500,
        audience: '123-somestuff',
        user_id: 456,
    };

    const error = await t.throwsAsync(tosapi(validReq, stubbedRes(),
        new ArbitraryUserInfoMockAuthorizer(userinfo), echoDatastore));
    t.is(error.statusCode, 401);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: OAuth token does not include email');
});

test('authorization: should reject if verified_email key is missing from OAuth userinfo', async t => {
    const userinfo = {
        email: 'email@unit.test',
        // verified_email: true,
        expires_in: 500,
        audience: '123-somestuff',
        user_id: 456,
    };

    const error = await t.throwsAsync(tosapi(validReq, stubbedRes(),
        new ArbitraryUserInfoMockAuthorizer(userinfo), echoDatastore));
    t.is(error.statusCode, 401);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: OAuth token does not include verified_email');
});

test('authorization: should reject if user_id key is missing from OAuth userinfo', async t => {
    const userinfo = {
        email: 'email@unit.test',
        verified_email: true,
        expires_in: 500,
        audience: '123-somestuff',
        // user_id: 456
    };

    const error = await t.throwsAsync(tosapi(validReq, stubbedRes(),
        new ArbitraryUserInfoMockAuthorizer(userinfo), echoDatastore));
    t.is(error.statusCode, 401);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: OAuth token does not include user_id');
});

test('authorization: should reject if audience key is missing from OAuth userinfo', async t => {
    const userinfo = {
        email: 'email@unit.test',
        verified_email: true,
        expires_in: 500,
        // audience: '123-somestuff',
        user_id: 456,
    };

    const error = await t.throwsAsync(tosapi(validReq, stubbedRes(),
        new ArbitraryUserInfoMockAuthorizer(userinfo), echoDatastore));
    t.is(error.statusCode, 401);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: OAuth token does not include audience');
});

test('authorization: should reject if expires_in key is missing from OAuth userinfo', async t => {
    const userinfo = {
        email: 'email@unit.test',
        verified_email: true,
        // expires_in: 500,
        audience: '123-somestuff',
        user_id: 456,
    };

    const error = await t.throwsAsync(tosapi(validReq, stubbedRes(),
        new ArbitraryUserInfoMockAuthorizer(userinfo), echoDatastore));
    t.is(error.statusCode, 401);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: OAuth token does not include expires_in');
});


test('authorization: should reject if verified_email is false in OAuth userinfo', async t => {
    const userinfo = {
        email: 'email@unit.test',
        verified_email: false,
        expires_in: 500,
        audience: '123-somestuff',
        user_id: 456,
    };

    const error = await t.throwsAsync(tosapi(validReq, stubbedRes(),
        new ArbitraryUserInfoMockAuthorizer(userinfo), echoDatastore));
    t.is(error.statusCode, 401);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: OAuth token verified_email must be true.');
});

test('authorization: should reject if verified_email is not a boolean in OAuth userinfo', async t => {
    const userinfo = {
        email: 'email@unit.test',
        verified_email: 'sure, why not',
        expires_in: 500,
        audience: '123-somestuff',
        user_id: 456,
    };

    const error = await t.throwsAsync(tosapi(validReq, stubbedRes(),
        new ArbitraryUserInfoMockAuthorizer(userinfo), echoDatastore));
    t.is(error.statusCode, 401);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: OAuth token verified_email must be a Boolean.');
});


test('authorization: should reject if expires_in is 0 in OAuth userinfo', async t => {
    const userinfo = {
        email: 'email@unit.test',
        verified_email: true,
        expires_in: 0,
        audience: '123-somestuff',
        user_id: 456,
    };

    const error = await t.throwsAsync(tosapi(validReq, stubbedRes(),
        new ArbitraryUserInfoMockAuthorizer(userinfo), echoDatastore));
    t.is(error.statusCode, 401);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: OAuth token has expired (expires_in: 0)');
});

test('authorization: should reject if expires_in is negative in OAuth userinfo', async t => {
    const userinfo = {
        email: 'email@unit.test',
        verified_email: true,
        expires_in: -444,
        audience: '123-somestuff',
        user_id: 456,
    };

    const error = await t.throwsAsync(tosapi(validReq, stubbedRes(),
        new ArbitraryUserInfoMockAuthorizer(userinfo), echoDatastore));
    t.is(error.statusCode, 401);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: OAuth token has expired (expires_in: -444)');
});

test('authorization: should reject if expires_in is not a number in OAuth userinfo', async t => {
    const userinfo = {
        email: 'email@unit.test',
        verified_email: true,
        expires_in: 'never',
        audience: '123-somestuff',
        user_id: 456,
    };

    const error = await t.throwsAsync(tosapi(validReq, stubbedRes(),
        new ArbitraryUserInfoMockAuthorizer(userinfo), echoDatastore));
    t.is(error.statusCode, 401);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: OAuth token expires_in must be a number.');
});


test('authorization: should reject if neither audience nor email matches whitelists', async t => {
    const userinfo = {
        email: 'email@unknown.suffix', // compare to ArbitraryUserInfoMockAuthorizer above
        verified_email: true,
        expires_in: 500,
        audience: '10101-somestuff', // compare to ArbitraryUserInfoMockAuthorizer above
        user_id: 456,
    };

    const error = await t.throwsAsync(tosapi(validReq, stubbedRes(),
        new ArbitraryUserInfoMockAuthorizer(userinfo), echoDatastore));
    t.is(error.statusCode, 401);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: OAuth token must have an acceptable audience ' +
        `(${userinfo.audience}) or email (${userinfo.email})`);
});

test('authorization: should validate if audience matches whitelist but email does not', async t => {
    const userinfo = {
        email: 'email@unknown.suffix', // compare to ArbitraryUserInfoMockAuthorizer above
        verified_email: true,
        expires_in: 500,
        audience: '778899000000-somestuff', // compare to ArbitraryUserInfoMockAuthorizer above
        user_id: 456,
    };

    return tosapi(validReq, stubbedRes(), new ArbitraryUserInfoMockAuthorizer(userinfo), echoDatastore)
        .then(datastoreResult => {
            t.is(datastoreResult.userid, userinfo.user_id);
            t.is(datastoreResult.email, userinfo.email);
            t.true(datastoreResult.accepted);
        });
});

test('authorization: should validate if email matches whitelist but audience does not', async t => {
    const userinfo = {
        email: 'email@somewhere.unittest.email.suffix.two', // compare w/ArbitraryUserInfoMockAuthorizer
        verified_email: true,
        expires_in: 500,
        audience: '10101-somestuff', // compare to ArbitraryUserInfoMockAuthorizer above
        user_id: 456,
    };

    return tosapi(validReq, stubbedRes(), new ArbitraryUserInfoMockAuthorizer(userinfo), echoDatastore)
        .then(datastoreResult => {
            t.is(datastoreResult.userid, userinfo.user_id);
            t.is(datastoreResult.email, userinfo.email);
            t.true(datastoreResult.accepted);
        });
});

test('authorization: should validate if both email and audience match whitelist', async t => {
    const userinfo = {
        email: 'email@somewhere.unittest.email.suffix.two', // compare w/ArbitraryUserInfoMockAuthorizer
        verified_email: true,
        expires_in: 500,
        audience: '778899000000-somestuff', // compare w/ArbitraryUserInfoMockAuthorizer
        user_id: 456,
    };

    return tosapi(validReq, stubbedRes(), new ArbitraryUserInfoMockAuthorizer(userinfo), echoDatastore)
        .then(datastoreResult => {
            t.is(datastoreResult.userid, userinfo.user_id);
            t.is(datastoreResult.email, userinfo.email);
            t.true(datastoreResult.accepted);
        });
});

test('authorization: should validate if expires_in is a stringified number in OAuth userinfo', async t => {
    const userinfo = {
        email: 'email@somewhere.unittest.email.suffix.two', // compare w/ArbitraryUserInfoMockAuthorizer
        verified_email: true,
        expires_in: '777',
        audience: '778899000000-somestuff', // compare w/ArbitraryUserInfoMockAuthorizer
        user_id: 456,
    };

    return tosapi(validReq, stubbedRes(), new ArbitraryUserInfoMockAuthorizer(userinfo), echoDatastore)
        .then(datastoreResult => {
            t.is(datastoreResult.userid, userinfo.user_id);
            t.is(datastoreResult.email, userinfo.email);
            t.true(datastoreResult.accepted);
        });
});

test('authorization: should validate if userinfo contains extra fields', async t => {
    const userinfo = {
        email: 'email@somewhere.unittest.email.suffix.two', // compare w/ArbitraryUserInfoMockAuthorizer
        verified_email: true,
        expires_in: 500,
        audience: '778899000000-somestuff', // compare w/ArbitraryUserInfoMockAuthorizer
        user_id: 456,
        hey: 'there',
        these: 'are',
        some: 'extra',
        fields: 'okay?',
    };

    return tosapi(validReq, stubbedRes(), new ArbitraryUserInfoMockAuthorizer(userinfo), echoDatastore)
        .then(datastoreResult => {
            t.is(datastoreResult.userid, userinfo.user_id);
            t.is(datastoreResult.email, userinfo.email);
            t.true(datastoreResult.accepted);
        });
});
