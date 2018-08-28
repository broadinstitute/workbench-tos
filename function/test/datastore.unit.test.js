const test = require('ava');
const sinon = require('sinon');
const GoogleOAuthAuthorizer = require('../authorization').GoogleOAuthAuthorizer
const GoogleDatastoreClient = require('../datastore').GoogleDatastoreClient;

const tosapi = require('..').tosapi;

process.env.NODE_ENV = 'test';

// mock authorizer that always returns successfully. Normally the authorizer requires an auth token, but this mock
// expects a userinfo object, and echoes that userinfo object back. We do this so different unit tests can specify
// different users, which is important for the datastore mocks below.
class SuccessfulMockAuthorizer extends GoogleOAuthAuthorizer {
    callTokenInfoApi(userinfoStr) {
        // example userinfo: {user_id: 12321, email: 'fake@fakey.fake'}
        return Promise.resolve(JSON.parse(userinfoStr));
    }
}

// "mock database" - here are the values that we'll be working with in these tests
const applications = {
    FireCloud: {}
}

const toses = {
    20180815.1: {}
}

const userresponses = {
    111: {accepted: true, email: 'one@example.com', userid: 111, timestamp: new Date()},
    222: {accepted: false, email: 'two@example.com', userid: 222, timestamp: new Date()},
    333: {email: 'three@example.com', userid: 333, timestamp: new Date()}
}

// mock datastore client that works with the data above
class UnitTestDatastoreClient extends GoogleDatastoreClient {
    
    insertUserResponse(userinfo, reqinfo) {
        return Promise.reject(new Error('Unit test mock not implemented yet'));
    }

    queryUserResponse(userid, appid, tosversion) {
        const userresponse = userresponses[userid];
        // results object is an array that contains [0]: array of rows returned; [1]: metadata about the results
        // we ignore the metadata at runtime, so this mock returns a junk object for metadata.
        // if we have TOSResponse in the userresponses map for the user, we return it, otherwise we return []
        let hitsArray = [];
        if (userresponse) {
            hitsArray = [userresponse];
        }
        return Promise.resolve(
            [
                hitsArray,
                {metadata: 'foo'}
            ]
        );
    }
}

const stubbedRes = function() {
    return {
        setHeader: sinon.stub(),
        send: sinon.stub(),
        json: sinon.stub(),
        status: sinon.stub().returnsThis()
    };
}

const getRequest = function(userid) {
    return {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: `{"user_id": ${userid}, "email": "fake@fakey.fake"}`
        },
        method: 'GET',
        query: {
            appid: 'FireCloud',
            tosversion: 20180815.1
        }
    };
} 

test("datastore: should reject with a 404 if user's TOSResponse doesn't exist", async t => {
    const req = getRequest(999);
    const res = stubbedRes();
        
	const error = await t.throwsAsync( tosapi(req, res, new SuccessfulMockAuthorizer(), new UnitTestDatastoreClient()) );
    t.is(error.statusCode, 404);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: Error reading user response: 404');
});

test("datastore: should reject with a 403 and 'user declined TOS' if user's TOSResponse has accepted: false", async t => {
    const req = getRequest(222);
    const res = stubbedRes();
        
	const error = await t.throwsAsync( tosapi(req, res, new SuccessfulMockAuthorizer(), new UnitTestDatastoreClient()) );
    t.is(error.statusCode, 403);
    t.is(error.name, 'ResponseError');
    t.is(error.message, 'Error authorizing user: Error reading user response: user declined TOS');
});

test("datastore: should reject with a 403 and '???' if user's TOSResponse is missing an accepted value", async t => {
    const req = getRequest(333);
    const res = stubbedRes();
        
	const error = await t.throwsAsync( tosapi(req, res, new SuccessfulMockAuthorizer(), new UnitTestDatastoreClient()) );
    t.is(error.statusCode, 403);
    t.is(error.name, 'ResponseError');
    // TODO: is this the correct error message?
    t.is(error.message, 'Error authorizing user: Error reading user response: user declined TOS');
});

test("datastore: should return TOSResponse object/success if user has exactly 1 TOSresponse and it has accepted:true", async t => {
    const req = getRequest(111);
    const res = stubbedRes();

    return tosapi(req, res, new SuccessfulMockAuthorizer(), new UnitTestDatastoreClient())
        .then( datastoreResult => {
            t.is(datastoreResult.userid, 111);
            t.true(datastoreResult.accepted);
        });
});


    // TODO: eliminate the `Error authorizing user: ` prefix on datastore errors

    // ========== GET ==========
    // TODO: rejection if parent Application doesn't exist
    // TODO: rejection if parent TermsOfService doesn't exist
    // TODO: rejection if TOSResponse query somehow returns > 1 record
    // TODO: rejection if datastore throws an error in querying

    // ========== POST ==========
    // TODO: rejection if not application/json content type
    // TODO: rejection if invalid json payload
    // TODO: rejection if parent Application doesn't exist
    // TODO: rejection if parent TermsOfService doesn't exist
    // ??? what happens if user-supplied values are incomplete?
    // TODO: rejection if TOSResponse insert result somehow returns > 1 record
    // TODO: rejection if TOSResponse insert result returns 0 records
    // TODO: rejection if datastore throws an error in insert
    // TODO: rejection if user successfully inserted 1 TOSresponse and it has accepted:false
    // TODO: TOSResponse object/success if user successfully inserted 1 TOSresponse and it has accepted:true

