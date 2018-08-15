
# Indexes
The [index.yaml](index.yaml) in this directory contains the indexes necessary to power the TOS-related queries. Since Datastore is shared for an entire Google project, please note that other applications may need other indexes; be wary of running `cleanup-indexes`.

# Data Structure
The TOS function expects two Datastore kinds: `tos` and `response`. These represent an application's Terms of Service and users' responses to that Terms of Service, respectively. Both kinds reside in a namespace named `tos` (so yes, we have a `tos.tos` kind).

All `response` entities must have a `tos` entity as their ancestor.

## tos
The `tos` kind expects the following properties:

* `appid`: String, ex. 'FireCloud'
* `version`: Float, ex. 20180815.1
* `timestamp`: Date/time, should be the datetime of insertion

The `tos` kind must have a user-supplied key of the form `${appid}-${version}`, ex. 'FireCloud-20180815.1'.

## response
The `response` kind expects the following properties:

* `userid`: String, ex. '123456'
* `accepted`: Boolean, whether or not the user accepted the terms of service
* `timestamp`: Date/time, should be the datetime of insertion

All `response` entities must have a `tos` entity as their ancestor.

The `response` kind uses Datastore-generated keys.

*Important:* `userid` is a String. In Workbench, users are typically identified by a numeric subjectId provided by Google. These numeric ids should be cast to a String, and the Cloud Function in this repo will perform this cast. We choose String here for forward compatibility with other applications that may identify users by e.g. email address.





