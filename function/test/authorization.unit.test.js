const test = require('ava');
const sinon = require('sinon');
const Supertest = require('supertest');
const supertest = Supertest(process.env.BASE_URL);

const tos = require('..').tos;

// process.env.NODE_ENV = 'test';

/*
function stubbedRes() {
    return {
        setHeader: sinon.stub(),
        send: sinon.stub(),
        json: sinon.stub(),
        status: sinon.stub().returnsThis()
    };
}

let fakeserver;
*/

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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

