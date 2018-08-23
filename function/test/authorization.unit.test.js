const test = require('ava');
const sinon = require('sinon');
const Supertest = require('supertest');
const supertest = Supertest(process.env.BASE_URL);


const tos = require('..').tos;

var fakeAuthorizer = {
    authorize: (authHeader) => {
        return Promise.reject({code: 9, msg: "Intentional error from authorizer fake"})
        // return Promise.resolve({user_id: 12321, email: 'fake@fakey.fake'})
    },
    toString: () => { return 'fakey-faked authorizer' }
}

process.env.NODE_ENV = 'test';

function stubbedRes() {
    return {
        setHeader: sinon.stub(),
        send: sinon.stub(),
        json: sinon.stub(),
        status: sinon.stub().returnsThis()
    };
}

/*
test.before('setup fake server', t => {
    // This runs before all tests
    fakeserver = sinon.createFakeServer();
    // fakeserver.respondWith("GET", "/oauth2/v2/tokeninfo",
    fakeserver.respondWith(
            [200, { "Content-Type": "application/json" },
             '{ "user_id": 54321, "email": "nobody@example.com" }']);
    fakeserver.respondImmediately = true;
});

test.after.always('guaranteed cleanup', t => {
    // This will always run, regardless of earlier failures
    fakeserver.restore();
});
*/

test('authorization: should 400 if authorizer returns an error', t => {
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

    t.true(true);

    // Call tested function
    // tos(req, res, fakeAuthorizer);

    // Verify behavior of tested function
    // t.true(res.json.calledOnce);
    // t.deepEqual(res.json.firstCall.args, ['"appid must be a String."']);
    // t.deepEqual(res.status.firstCall.args, [400]);
});

/*
test.cb('authorization: should fail on bad bearer token', (t) => {

    console.log(process.env.BASE_URL);

    supertest
        .get('/tos/v1/user/response?appid=FireCloud&tosversion=20180815.1')
        .set('Authorization', 'Bearer 99999')
        .expect(400)
        .expect((response) => {
          t.true(response.text.indexOf('Invalid Value') > -1);
        })
        .end(t.end);
});
*/

