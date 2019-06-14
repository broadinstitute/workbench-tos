'use strict';

class SubsystemStatus {
    /**
     *
     * @param {*} ok Boolean: is the subsystem healthy or not?
     * @param {*} messages an array of error messages from this subsystem.
     */
    constructor(ok, messages) {
        this.ok = !!ok;
        this.messages = messages;
    }
}

class StatusCheckResponse {
    /**
     *
     * @param {*} ok Boolean: is the TOS API healthy or not?
     * @param {*} systems Object; keys are subsytem name (String) and values are SubsystemStatus objects
     */
    constructor(ok, systems) {
        this.ok = !!ok;
        this.systems = systems;
    }
}

// an in-memory "cache" to retain status responses.
// we may eventually move to something more elegant.
// this "cache" is only valid per cloud function instance, and Google will spin
// up many instances to meet demand.
let cache = null;

const cacheGet = function() {
    const curTime = Date.now();
    const cachedData = cache || {};
    const cacheTime = cachedData.timestamp || 0;
    if (curTime - cacheTime < 60000) { // 60000 millis == 1 minute
        return cachedData.status;
    } else {
        return null;
    }
};

const cachePut = function(status) {
    cache = {
        timestamp: Date.now(),
        status: status,
    };
    return cacheGet();
};

const checkDatastoreStatus = function(datastore) {
    return datastore.healthCheckQuery()
        .then(results => {
            // results object is an array that contains:
            // [0]: array of rows returned
            // [1]: metadata about the results
            const hits = results[0];
            if (hits.length === 1) {
                return new SubsystemStatus(true);
            } else {
                return new SubsystemStatus(false, [hits.length + ' entities returned from Datastore.']);
            }
        })
        .catch(err => {
            return new SubsystemStatus(false, [err.message]);
        });
};

const handleRequest = function(req, authorizer, datastore) {

    // should we validate GET? without validation we allow any method, which could be fine

    let status = new StatusCheckResponse(false, {});

    return Promise.resolve()
        .then(() => {
            try {
                const cachedLookup = cacheGet();
                if (cachedLookup) {
                    console.info('returning cached status check.');
                    status = cachedLookup;
                    return status;
                } else {
                    // rewrite this if we ever have more than one subsystem to check
                    return checkDatastoreStatus(datastore)
                        .then(datastoreStatus => {
                            status.systems.datastore = datastoreStatus;
                            status.ok = datastoreStatus.ok;
                            cachePut(status);
                            return status;
                        })
                        .catch(err => {
                            status.ok = false;
                            status.systems.datastore = new SubsystemStatus(false, [err.message]);
                            return status;
                        });
                }
            } catch (err) {
                status.ok = false;
                status.systems.datastore = new SubsystemStatus(false, [err.message]);
                return status;
            }
        })
        .catch(err => {
            return new SubsystemStatus(false, [err.message]);
        });
};

module.exports = { handleRequest, StatusCheckResponse, SubsystemStatus };
