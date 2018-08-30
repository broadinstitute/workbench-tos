const test = require('ava');
const sinon = require('sinon');
const requestPromiseErrors = require('request-promise-native/errors');
const GoogleOAuthAuthorizer = require('../authorization').GoogleOAuthAuthorizer

const tosapi = require('..').tosapi;

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

const dummyUserInfo = {user_id: 12321, email: 'fake@fakey.fake'};

class SuccessfulMockAuthorizer extends GoogleOAuthAuthorizer {
    callTokenInfoApi(token) {
        return Promise.resolve(dummyUserInfo);
    }
}

class TokenValueTestingAuthorizer extends GoogleOAuthAuthorizer {
    // if value of token is 'expected-token', succeed; otherwise fail
    callTokenInfoApi(token) {
        if (token === 'expected-token') {
            return Promise.resolve(dummyUserInfo);
        } else {
            const invalidTokenError = new requestPromiseErrors.StatusCodeError(
                400,
                {error_description: 'Unit test-thrown error! Expected the token value to be [expected-token] but got [' + token + ']'},
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
    insertUserResponse: (userinfo, reqinfo) => {
        return Promise.resolve(userinfo);
    },
    getUserResponse: (userinfo, reqinfo) => {
        // we need to also include accepted:true so the datastore-related checks will pass.
        return Promise.resolve({
            accepted: true,
            userid: userinfo.user_id,
            email: userinfo.email
        });
    }
}

function stubbedRes() {
    return {
        setHeader: sinon.stub(),
        send: sinon.stub(),
        json: sinon.stub(),
        status: sinon.stub().returnsThis()
    };
}

test('authorization: should return error if authorizer returns an error', async t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake'
        },
        method: 'GET',
        query: {
            appid: 'FireCloud',
            tosversion: 20180815.1
        }
    };
    const res = stubbedRes();
    
	const error = await t.throwsAsync( tosapi(req, res, new FailingMockAuthorizer(), echoDatastore) );
    t.is(error.statusCode, 4000000000000); // should be 400
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: Invalid Value');
});

test('authorization: should pass userinfo onwards to datastore', async t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake'
        },
        method: 'GET',
        query: {
            appid: 'FireCloud',
            tosversion: 20180815.1
        }
    };
    const res = stubbedRes();
    
    return tosapi(req, res, new SuccessfulMockAuthorizer(), echoDatastore)
        .then( datastoreResult => {
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
            authorization: 'Bearer expected-token'
        },
        method: 'GET',
        query: {
            appid: 'FireCloud',
            tosversion: 20180815.1
        }
    };
    const res = stubbedRes();

    return tosapi(req, res, new TokenValueTestingAuthorizer(), echoDatastore)
        .then( datastoreResult => {
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
            authorization: 'bEArEr expected-token'
        },
        method: 'GET',
        query: {
            appid: 'FireCloud',
            tosversion: 20180815.1
        }
    };
    const res = stubbedRes();

    return tosapi(req, res, new TokenValueTestingAuthorizer(), echoDatastore)
        .then( datastoreResult => {
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
            authorization: 'Bear er expected-token'
        },
        method: 'GET',
        query: {
            appid: 'FireCloud',
            tosversion: 20180815.1
        }
    };
    const res = stubbedRes();

    const error = await t.throwsAsync( tosapi(req, res, new TokenValueTestingAuthorizer(), echoDatastore) );
    t.is(error.statusCode, 400);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: Unit test-thrown error! Expected the token value to be [expected-token] but got [Bear er expected-token]');
});

test('authorization: should not replace "bearer " in the middle of the Authorization header', async t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'does not start with Bearer !!!'
        },
        method: 'GET',
        query: {
            appid: 'FireCloud',
            tosversion: 20180815.1
        }
    };
    const res = stubbedRes();

    const error = await t.throwsAsync( tosapi(req, res, new TokenValueTestingAuthorizer(), echoDatastore) );
    t.is(error.statusCode, 400);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: Unit test-thrown error! Expected the token value to be [expected-token] but got [does not start with Bearer !!!]');
});
