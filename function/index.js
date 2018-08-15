/**
 * Responds to any HTTP request.
 *
 * @param {!Object} req HTTP request context.
 * @param {!Object} res HTTP response context.
 */
exports.tos = (req, res) => {

  /*
    TODO:
    - if GET request:
      - grab access token from Authorization header
      - call tokeninfo to verify access token validity
      - grab subject id from tokeninfo response
      - grab tosversion and appid from request params (default to appid=FireCloud)
      - query datastore for TOSRESPONSE where:
        - ancestor = TOS(appid, tosversion)
        - userid = subjectid
        - order by timestamp desc
      - verify datastore response
        - record exists?
        - accepted = true?
      - respond 200 OK if accepted
      - respond 40x if not accepted (403 if declined, 404 if not responded?)
    - if POST request:
      - grab access token from Authorization header
      - call tokeninfo to verify access token validity
      - grab subject id from tokeninfo response
      - grab tosversion, appid, accepted from request params (default to appid=FireCloud)
      - verify tosversion exists (what do if it doesn't?)
      - insert/create TOSRESPONSE(subjectid, timestamp, accepted) with ancestor TOS(appid, tosversion)
  */


  let message = req.query.message || req.body.message || 'Hello World!';
  res.status(200).send(message);
};
