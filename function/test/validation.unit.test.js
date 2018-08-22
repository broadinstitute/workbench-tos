const test = require('ava');
const sinon = require('sinon');

const tos = require('..').tos;

process.env.NODE_ENV = 'test';

function stubbedRes() {
    return {
        setHeader: sinon.stub(),
        send: sinon.stub(),
        status: sinon.stub().returnsThis()
    };
}

test('tos: should 404 on incorrect url path', t => {
    const req = {
        path: '/not/correct/user/response/path',
        headers: {
            origin: 'unittest'
        },
        method: 'GET',
        query: {}
    };
    const res = stubbedRes();

    // Call tested function
    tos(req, res);

    // Verify behavior of tested function
    t.true(res.send.calledOnce);
    t.true(res.status.calledOnce);
    t.deepEqual(res.status.firstCall.args, [404]);
});

test('tos: should 401 on correct path but without Authorization header', t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest'
        },
        method: 'GET',
        query: {}
    };
    const res = stubbedRes();

    // Call tested function
    tos(req, res);

    // Verify behavior of tested function
    t.true(res.send.calledOnce);
    t.true(res.status.calledOnce);
    t.deepEqual(res.status.firstCall.args, [401]);
});

test('tos: should 400 on GET correct path and Authorization header but without query params', t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake'
        },
        method: 'GET',
        query: {}
    };
    const res = stubbedRes();

    // Call tested function
    tos(req, res);

    // Verify behavior of tested function
    t.true(res.send.calledOnce);
    t.deepEqual(res.status.firstCall.args, [400]);
    t.deepEqual(res.send.firstCall.args, ['"appid must be a String. tosversion must be a Number."']);
});

test('tos: should 400 on GET correct path and Authorization header but missing tosversion from query params', t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake'
        },
        method: 'GET',
        query: {
            appid: 'FireCloud'
        }
    };
    const res = stubbedRes();

    // Call tested function
    tos(req, res);

    // Verify behavior of tested function
    t.true(res.send.calledOnce);
    t.deepEqual(res.status.firstCall.args, [400]);
    t.deepEqual(res.send.firstCall.args, ['"tosversion must be a Number."']);
});

test('tos: should 400 on GET correct path and Authorization header, but tosversion is non-numeric in query params', t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake'
        },
        method: 'GET',
        query: {
            appid: 'FireCloud',
            tosversion: 'this is supposed to be a number'
        }
    };
    const res = stubbedRes();

    // Call tested function
    tos(req, res);

    // Verify behavior of tested function
    t.true(res.send.calledOnce);
    t.deepEqual(res.status.firstCall.args, [400]);
    t.deepEqual(res.send.firstCall.args, ['"tosversion must be a Number."']);
});

test('tos: should 400 on GET correct path and Authorization header but missing appid from query params', t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake'
        },
        method: 'GET',
        query: {
            tosversion: 20180815.1
        }
    };
    const res = stubbedRes();

    // Call tested function
    tos(req, res);

    // Verify behavior of tested function
    t.true(res.send.calledOnce);
    t.deepEqual(res.status.firstCall.args, [400]);
    t.deepEqual(res.send.firstCall.args, ['"appid must be a String."']);
});

const invalidMethods = ['PUT','DELETE','HEAD','PATCH','TRACE','CONNECT'];
invalidMethods.forEach( method => {
    test('tos: should 405 on ' + method + ' verb', t => {
        const req = {
            path: '/v1/user/response',
            headers: {
                origin: 'unittest',
                authorization: 'fake'
            },
            method: method,
            query: {
                tosversion: 20180815.1,
                appid: 'FireCloud'
            }
        };
        const res = stubbedRes();
    
        // Call tested function
        tos(req, res);
    
        // Verify behavior of tested function
        t.true(res.send.calledOnce);
        t.deepEqual(res.status.firstCall.args, [405]);
    });
});

test('tos: should 415 on POST without a content-type', t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake'
        },
        method: 'POST'
    };
    const res = stubbedRes();

    // Call tested function
    tos(req, res);

    // Verify behavior of tested function
    t.true(res.send.calledOnce);
    t.deepEqual(res.status.firstCall.args, [415]);
});

test('tos: should 415 on POST with the wrong content-type', t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake',
            'content-type': 'application/xml'
        },
        method: 'POST'
    };
    const res = stubbedRes();

    // Call tested function
    tos(req, res);

    // Verify behavior of tested function
    t.true(res.send.calledOnce);
    t.deepEqual(res.status.firstCall.args, [415]);
});

test('tos: should 400 on POST with the right content-type but no body', t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake',
            'content-type': 'application/json'
        },
        method: 'POST'
    };
    const res = stubbedRes();

    // Call tested function
    tos(req, res);

    // Verify behavior of tested function
    t.true(res.send.calledOnce);
    t.deepEqual(res.status.firstCall.args, [400]);
    t.deepEqual(res.send.firstCall.args, ['"Request body must be valid JSON."']);
});

test('tos: should 400 on POST with the right content-type but empty body', t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake',
            'content-type': 'application/json'
        },
        body: {},
        method: 'POST'
    };
    const res = stubbedRes();

    // Call tested function
    tos(req, res);

    // Verify behavior of tested function
    t.true(res.send.calledOnce);
    t.deepEqual(res.status.firstCall.args, [400]);
    t.deepEqual(res.send.firstCall.args, ['"accepted must be a Boolean. appid must be a String. tosversion must be a Number."']);
});

test('tos: should 400 on POST when missing accepted from body', t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake',
            'content-type': 'application/json'
        },
        body: {
            appid: 'FireCloud',
            tosversion: 20180815.1
        },
        method: 'POST'
    };
    const res = stubbedRes();

    // Call tested function
    tos(req, res);

    // Verify behavior of tested function
    t.true(res.send.calledOnce);
    t.deepEqual(res.status.firstCall.args, [400]);
    t.deepEqual(res.send.firstCall.args, ['"accepted must be a Boolean."']);
});

test('tos: should 400 on POST when accepted is non-Boolean in body', t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake',
            'content-type': 'application/json'
        },
        body: {
            appid: 'FireCloud',
            tosversion: 20180815.1,
            accepted: 'this should be a Boolean. Does truthiness bite us?'
        },
        method: 'POST'
    };
    const res = stubbedRes();

    // Call tested function
    tos(req, res);

    // Verify behavior of tested function
    t.true(res.send.calledOnce);
    t.deepEqual(res.status.firstCall.args, [400]);
    t.deepEqual(res.send.firstCall.args, ['"accepted must be a Boolean."']);
});

test('tos: should 400 on POST when missing appid from body', t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake',
            'content-type': 'application/json'
        },
        body: {
            accepted: true,
            tosversion: 20180815.1
        },
        method: 'POST'
    };
    const res = stubbedRes();

    // Call tested function
    tos(req, res);

    // Verify behavior of tested function
    t.true(res.send.calledOnce);
    t.deepEqual(res.status.firstCall.args, [400]);
    t.deepEqual(res.send.firstCall.args, ['"appid must be a String."']);
});

test('tos: should 400 on POST when missing tosversion from body', t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake',
            'content-type': 'application/json'
        },
        body: {
            accepted: true,
            appid: 'FireCloud',
        },
        method: 'POST'
    };
    const res = stubbedRes();

    // Call tested function
    tos(req, res);

    // Verify behavior of tested function
    t.true(res.send.calledOnce);
    t.deepEqual(res.status.firstCall.args, [400]);
    t.deepEqual(res.send.firstCall.args, ['"tosversion must be a Number."']);
});

test('tos: should 400 on POST when tosversion is non-numeric in body', t => {
    const req = {
        path: '/v1/user/response',
        headers: {
            origin: 'unittest',
            authorization: 'fake',
            'content-type': 'application/json'
        },
        body: {
            accepted: true,
            appid: 'FireCloud',
            tosversion: 'this is supposed to be a number'
        },
        method: 'POST'
    };
    const res = stubbedRes();

    // Call tested function
    tos(req, res);

    // Verify behavior of tested function
    t.true(res.send.calledOnce);
    t.deepEqual(res.status.firstCall.args, [400]);
    t.deepEqual(res.send.firstCall.args, ['"tosversion must be a Number."']);
});
