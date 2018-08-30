const { rejection } = require('./responseError');

// Read the project ID from environment
const projectId = process.env.GCP_PROJECT;
// Create datastore client
const Datastore = require('@google-cloud/datastore');
const datastore = new Datastore({ projectId });

// Datastore namespace and kinds
const appNamespace = 'app';
const kindApplication = 'Application';
const kindTos = 'TermsOfService';
const kindUserResponse = 'TOSResponse';

const generateKey = function(keyparts) {
    return datastore.key({
        namespace: appNamespace,
        path: keyparts
    });
}

const generateAppKey = function(appId) {
    return generateKey([kindApplication, appId]);
}

const generateTosKey = function(appId, tosVersion) {
    return generateKey(tosKeyArrayParts(appId, tosVersion));
}

const tosKeyArrayParts = function(appId, tosVersion) {
    return [kindApplication, appId, kindTos, tosVersion.toString()];
}

const generateUserResponseKey = function(appId, tosVersion) {
    let userResponseParts = tosKeyArrayParts(appId, tosVersion);
    userResponseParts.push(kindUserResponse);
    return generateKey(userResponseParts);
}

// define datastore clients as classes for ease of unit testing - unit tests can mock out parts of these classes.
class GoogleDatastoreClient {

    // ================================
    // SUPPORT
    // ================================

    /**
     * Generic query handler.
     *
     * Accepts error messages with the following keys:
     *  'none': if the query found no results
     *  'many': if the query found > 1 result
     *
     * Error message values are of the form {statusCode: 123, message: 'string or undefined'}
     *
     * @param {*} queryPromise Promise that contains datastore results
     * @param {*} errorMessages map of error messages to handle
     */
    resultHandler(queryPromise, errorMessages) {
        return queryPromise
            .then( results => {
                // results object is an array that contains [0]: array of rows returned; [1]: metadata about the results
                const hits = results[0];
                if (hits.length === 1) {
                    return hits[0];
                } else if (hits.length == 0) {
                    return rejection(errorMessages.none.statusCode, errorMessages.none.message);
                } else {
                    // defensive! This should never happen since all known code either sets limit(1) in its query
                    // or is querying for a specific record id.
                    return rejection(errorMessages.many.statusCode, errorMessages.many.message);
                }
            })
    }


    // ================================
    // APPLICATION RECORDS
    // ================================

    // perform the query to datastore. this function is likely to be mocked by tests.
    selectApp(appid) {
        const query = datastore
        .createQuery(appNamespace, kindApplication)
        .filter('__key__', generateAppKey(appid));

        return datastore.runQuery(query);
    }

    // handle the datastore query results.
    getApp(appid) {
        return this.resultHandler(
            this.selectApp(appid),
            {
                // see resultHandler comment for expected keys
                none: {statusCode: 400, message: `Application ${appid} does not exist.`},
                many: {statusCode: 500, message: 'unexpected: returned too many results'}
            }
        )
    }

    // handle the datastore query results.

    // ================================
    // TERMS OF SERVICE RECORDS
    // ================================

    // perform the query to datastore. this function is likely to be mocked by tests.
    selectTOS(appid, tosversion) {
        const query = datastore
        .createQuery(appNamespace, kindTos)
        .filter('__key__', generateTosKey(appid, tosversion));

        return datastore.runQuery(query);
    }

    // handle the datastore query results.
    getTOS(appid, tosversion) {
        return this.resultHandler(
            this.selectTOS(appid, tosversion),
            {
                // see resultHandler comment for expected keys
                none: {statusCode: 400, message: `TermsOfService ${appid}/${tosversion} does not exist.`},
                many: {statusCode: 500, message: 'unexpected: returned too many results'}
            }
        )
    }

    // ================================
    // USER RESPONSE RECORDS - READ
    // ================================

    // perform the query to datastore. this function is likely to be mocked by tests.
    selectUserResponse(userid, appid, tosversion) {
        const query = datastore
            .createQuery(appNamespace, kindUserResponse)
            .hasAncestor(generateTosKey(appid, tosversion))
            .filter('userid', userid.toString())
            .order('timestamp', { descending: true })
            .limit(1);

        return datastore.runQuery(query);
    }

    // handle the datastore query results.
    getUserResponse(userinfo, reqinfo) {

        const { user_id: userid } = userinfo;
        const { tosversion, appid } = reqinfo;

        // TODO: should we verify that application and TOS exist? Or is it safe enough to
        // rely on all inserts verifying this before creating user response records?

        return this.resultHandler(
            this.selectUserResponse(userid, appid, tosversion),
            {
                // see resultHandler comment for expected keys
                none: {statusCode: 404},
                many: {statusCode: 500, message: 'unexpected: returned too many results'}
            }
        ).then( rec => {
            // special handling for the user record. We can't rely just on presence/absence of a user response - we have
            // to also check whether or not the user accepted or declined.
            if (rec.accepted) {
                return rec;
            } else {
                return rejection(403, 'user declined TOS');
            }
        });
    }

    // ================================
    // USER RESPONSE RECORDS - WRITE
    // ================================

    insertUserResponse(userid, email, appid, tosversion, accepted) {
        const userResponseEntity = {
            key: generateUserResponseKey(appid, tosversion),
            data: [
                {
                    name: 'userid',
                    value: userid
                },
                {
                    name: 'email',
                    value: email
                },
                {
                    name: 'timestamp',
                    value: new Date().toJSON()
                },
                {
                    name: 'accepted',
                    value: accepted
                },
            ]
        };

        return datastore.save(userResponseEntity);
    }


    createUserResponse(userinfo, reqinfo) {
        // extract vars we need from the userinfo/reqinfo
        const userid = userinfo.user_id;
        const email = userinfo.email;
        const appid = reqinfo.appid;
        const tosversion = reqinfo.tosversion;
        const accepted = reqinfo.accepted;

        // verify Application and TermsOfService ancestors exist before inserting
        const appCheck = this.getApp(appid);
        const tosCheck = this.getTOS(appid, tosversion);

        return Promise.all([appCheck, tosCheck])
            .then(() => {
                return this.insertUserResponse(userid, email, appid, tosversion, accepted);
                    // TODO: do we want any validation of the response, or is it safe to rely on datastore
                    // throwing errors if the insert failed?
            })
    }

}

const getDatastoreClient = function() {
    return new GoogleDatastoreClient();
}

module.exports = GoogleDatastoreClient;