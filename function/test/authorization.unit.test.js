const test = require('ava');
const sinon = require('sinon');
const ResponseError = require('../responseError')

const tosapi = require('..').tosapi;

process.env.NODE_ENV = 'test';

// TODO: refactor authorizer so all we need to stub is the http request to google, not the whole authorize method
const failingAuthorizer = {
    authorize: (authHeader) => {
        return Promise.reject(new ResponseError('Intentional error from authorizer fake', 499));
    },
    toString: () => { return 'fakey-faked authorizer' }
}

const dummyUserInfo = {user_id: 12321, email: 'fake@fakey.fake'};

const successfulAuthorizer = {
    authorize: (authHeader) => {
        return Promise.resolve(dummyUserInfo)
    },
    toString: () => { return 'fakey-faked authorizer' }
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
    
	const error = await t.throwsAsync( tosapi(req, res, failingAuthorizer, echoDatastore) );
    t.is(error.statusCode, 499);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: Intentional error from authorizer fake');
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
    
    return tosapi(req, res, successfulAuthorizer, echoDatastore)
        .then( datastoreResult => {
            t.is(datastoreResult.userid, dummyUserInfo.user_id);
            t.is(datastoreResult.email, dummyUserInfo.email);
            t.true(datastoreResult.accepted);
        });
    
});
