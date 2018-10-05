'use strict';

const test = require('ava');
const sinon = require('sinon');
const GoogleOAuthAuthorizer = require('../authorization');
const GoogleDatastoreClient = require('../datastore');
const { tosapi, responseCode } = require('../index');
const { StatusCheckResponse, SubsystemStatus } = require('../statushandler');

process.env.NODE_ENV = 'test';

// mock authorizer that always rejects. The status API should not attempt authorization;
// if we see this error then the status code path is faulty.
class ErroringMockAuthorizer extends GoogleOAuthAuthorizer {
    callTokenInfoApi(userinfoStr) {
        return Promise.reject(new Error('ErroringMockAuthorizer should never be called!'));
    }
}

// mock datastore client that returns healthy
class HealthyDatastoreClient extends GoogleDatastoreClient {
    healthCheckQuery() {
        return Promise.resolve([ [{}], {metadata: 'HealthyDatastoreClient'} ]);
    };
}

// mock datastore client that rejects
class RejectingDatastoreClient extends GoogleDatastoreClient {
    healthCheckQuery() {
        return Promise.reject(new Error('RejectingDatastoreClient says reject!'));
    };
}

// mock datastore client that errors
class ErroringDatastoreClient extends GoogleDatastoreClient {
    healthCheckQuery() {
        throw new Error('ErroringDatastoreClient says error!');
    };
}

// mock datastore client that succeeds but returns zero entities
class EmptyDatastoreClient extends GoogleDatastoreClient {
    healthCheckQuery() {
        return Promise.resolve([ [], {metadata: 'EmptyDatastoreClient'} ]);
    };
}

// mock datastore client that succeeds but returns more than one entity
class TwoEntityDatastoreClient extends GoogleDatastoreClient {
    healthCheckQuery() {
        return Promise.resolve([ [{}, {}], {metadata: 'TwoEntityDatastoreClient'} ]);
    };
}

// helpers to create request/response objects
const stubbedRes = function() {
    return {
        setHeader: sinon.stub(),
        send: sinon.stub(),
        json: sinon.stub(),
        status: sinon.stub().returnsThis(),
    };
};

const getRequest = function(versioned = false) {
    return {
        path: versioned ? '/v1/status' : '/status',
        method: 'GET',
        headers: {
            origin: 'unittest',
        },
    };
};

test('status: should return StatusCheckResponse if all went well', async t => {
    const req = getRequest();
    const res = stubbedRes();

    return tosapi(req, res, new ErroringMockAuthorizer(), new HealthyDatastoreClient())
        .then(statusResult => {
            t.true(statusResult.ok);
            t.is(Object.keys(statusResult.systems).length, 1);
            t.truthy(statusResult.systems.datastore);
            t.true(statusResult.systems.datastore.ok);
            t.is(statusResult.systems.datastore.messages, undefined);
        });
});

test('status: should return downed StatusCheckResponse if datastore rejected', async t => {
    const req = getRequest();
    const res = stubbedRes();

    return tosapi(req, res, new ErroringMockAuthorizer(), new RejectingDatastoreClient())
        .then(statusResult => {
            t.false(statusResult.ok);
            t.is(Object.keys(statusResult.systems).length, 1);
            t.truthy(statusResult.systems.datastore);
            t.false(statusResult.systems.datastore.ok);
            t.is(statusResult.systems.datastore.messages.length, 1);
            t.is(statusResult.systems.datastore.messages.pop(), 'RejectingDatastoreClient says reject!');
        });
});

test('status: should return downed StatusCheckResponse if datastore throws error', async t => {
    const req = getRequest();
    const res = stubbedRes();

    return tosapi(req, res, new ErroringMockAuthorizer(), new ErroringDatastoreClient())
        .then(statusResult => {
            t.false(statusResult.ok);
            t.is(Object.keys(statusResult.systems).length, 1);
            t.truthy(statusResult.systems.datastore);
            t.false(statusResult.systems.datastore.ok);
            t.is(statusResult.systems.datastore.messages.length, 1);
            t.is(statusResult.systems.datastore.messages.pop(), 'ErroringDatastoreClient says error!');
        });
});

test('status: should return downed StatusCheckResponse if datastore returns zero entities', async t => {
    const req = getRequest();
    const res = stubbedRes();

    return tosapi(req, res, new ErroringMockAuthorizer(), new EmptyDatastoreClient())
        .then(statusResult => {
            t.false(statusResult.ok);
            t.is(Object.keys(statusResult.systems).length, 1);
            t.truthy(statusResult.systems.datastore);
            t.false(statusResult.systems.datastore.ok);
            t.is(statusResult.systems.datastore.messages.length, 1);
            t.is(statusResult.systems.datastore.messages.pop(), '0 entities returned from Datastore.');
        });
});

test('status: should return downed StatusCheckResponse if datastore returns >1 entities', async t => {
    const req = getRequest();
    const res = stubbedRes();

    return tosapi(req, res, new ErroringMockAuthorizer(), new TwoEntityDatastoreClient())
        .then(statusResult => {
            t.false(statusResult.ok);
            t.is(Object.keys(statusResult.systems).length, 1);
            t.truthy(statusResult.systems.datastore);
            t.false(statusResult.systems.datastore.ok);
            t.is(statusResult.systems.datastore.messages.length, 1);
            t.is(statusResult.systems.datastore.messages.pop(), '2 entities returned from Datastore.');
        });
});

// the versioned status endpoint uses the same codepath as the non-versioned one, so we only smoke
// test it here.
test('status: should return StatusCheckResponse if all went well on the versioned endpoint', async t => {
    const req = getRequest(true);
    const res = stubbedRes();

    return tosapi(req, res, new ErroringMockAuthorizer(), new HealthyDatastoreClient())
        .then(statusResult => {
            t.true(statusResult.ok);
            t.is(Object.keys(statusResult.systems).length, 1);
            t.truthy(statusResult.systems.datastore);
            t.true(statusResult.systems.datastore.ok);
            t.is(statusResult.systems.datastore.messages, undefined);
        });
});


test('status: should return downed StatusCheckResponse if datastore rejected' +
        ' on the versioned endpoint', async t => {
    const req = getRequest(true);
    const res = stubbedRes();

    return tosapi(req, res, new ErroringMockAuthorizer(), new RejectingDatastoreClient())
        .then(statusResult => {
            t.false(statusResult.ok);
            t.is(Object.keys(statusResult.systems).length, 1);
            t.truthy(statusResult.systems.datastore);
            t.false(statusResult.systems.datastore.ok);
            t.is(statusResult.systems.datastore.messages.length, 1);
            t.is(statusResult.systems.datastore.messages.pop(), 'RejectingDatastoreClient says reject!');
        });
});


test('responseCode function: should use http 200 for up StatusCheckResponse', t => {
    const status = new StatusCheckResponse(true, {});
    t.is(responseCode(status), 200);
});

test('responseCode function: should use http 200 for up StatusCheckResponse even with subsystem fails', t => {
    const subsys = new SubsystemStatus(false, ['failed subsystem']);
    const status = new StatusCheckResponse(true, {
        datastore: subsys,
    });
    t.is(responseCode(status), 200);
});

test('responseCode function: should use http 500 for down StatusCheckResponse', t => {
    const status = new StatusCheckResponse(false, {});
    t.is(responseCode(status), 500);
});

test('responseCode function: should use http 500 for down StatusCheckResponse with subsystem success', t => {
    const subsys = new SubsystemStatus(true, []);
    const status = new StatusCheckResponse(false, {
        datastore: subsys,
    });
    t.is(responseCode(status), 500);
});

test('responseCode function: should use http 200 for non-StatusCheckResponse payload', t => {
    const payload = [[{}], {metadata: 'foo'}];
    t.is(responseCode(payload), 200);
});

test('responseCode function: should use http 200 for non-StatusCheckResponse payload with ok field', t => {
    const payload = {ok: false};
    t.is(responseCode(payload), 200);
});
