// Read the project ID from environment
const projectId = process.env.GCP_PROJECT;
// Create datastore client
const Datastore = require('@google-cloud/datastore');
const datastore = new Datastore({ projectId});

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

const generateTosKey = function(appId, tosVersion) {
    return generateKey(tosKeyArrayParts(appId, tosVersion));
}

const rejection = function(error, message) {
    return Promise.reject(new Error({
      error: error,
      message: message
    }));
  }

const tosKeyArrayParts = function(appId, tosVersion) {
    return [kindApplication, appId, kindTos, tosVersion.toString()];
}

const generateUserResponseKey = function(appId, tosVersion) {
    let userResponseParts = tosKeyArrayParts(appId, tosVersion);
    userResponseParts.push(kindUserResponse);
    return generateKey(userResponseParts);
}

const getTOS = function(appid, tosversion) {
    const query = datastore
        .createQuery(appNamespace, kindTos)
        .filter('__key__', generateTosKey(appid, tosversion));

    return datastore
        .runQuery(query)
        .then(results => {
            // results object is an array that contains [0]: array of rows returned; [1]: metadata about the results
            const hits = results[0];
            if (hits.length == 1) {
                return hits[0];
            } else {
                return rejection(400, 'TermsOfService ' + appid + '/' + tosversion + ' does not exist.');
            }
        })
        .catch(err => {
            if (err.statusCode) {
                return rejection(err.statusCode, err);
            } else {
                return rejection(500, err);
            }
        });
}

// define datastore clients as classes for ease of unit testing - unit tests can mock out parts of these classes.
class GoogleDatastoreClient {

    insertUserResponse(userinfo, reqinfo) {
        // extract vars we need from the userinfo/reqinfo
        const userid = userinfo.user_id;
        const email = userinfo.email;
        const appid = reqinfo.appid;
        const tosversion = reqinfo.tosversion;
        const accepted = reqinfo.accepted;

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

        // verify Application and TermsOfService ancestors exist before inserting
        return getTOS(appid, tosversion).then(() => {
            return datastore
                .save(userResponseEntity)
                .then(saved => {
                    return saved;
                })
                .catch(err => {
                    return rejection(500, err);
                });
        })
            .catch(err => {
                if (err.statusCode) {
                    return rejection(err.statusCode, err);
                } else {
                    return rejection(500, err);
                }
            });
    }


    getUserResponse(userinfo, reqinfo) {

        const { user_id: userid } = userinfo;
        const { tosversion, appid } = reqinfo;

        const query = datastore
            .createQuery(appNamespace, kindUserResponse)
            .hasAncestor(generateTosKey(appid, tosversion))
            .filter('userid', userid.toString())
            .order('timestamp', { descending: true })
            .limit(1);

        return datastore
            .runQuery(query)
            .then(results => {
                // results object is an array that contains [0]: array of rows returned; [1]: metadata about the results
                const hits = results[0];
                if (hits.length === 1) {
                    if (hits[0].accepted) {
                        return hits[0];
                    } else {
                        return rejection(403, 'user declined TOS');
                    }
                } else if (hits.length == 0) {
                    return rejection(404);
                } else {
                    // defensive! This should never happen since we set limit(1) above.
                    return rejection(500, 'unexpected: returned too many results');
                }
            })
            .catch(err => {
                if (err.statusCode) {
                    return rejection(err.statusCode, err);
                } else {
                    return rejection(500, err);
                }
            });
    }

}

const getDatastoreClient = function() {
    return new GoogleDatastoreClient();
}

module.exports = { getDatastoreClient };