
# Indexes
The [index.yaml](index.yaml) in this directory contains the indexes necessary to power the TOS-related queries. Since Datastore is shared for an entire Google project, please note that other applications may need other indexes; be wary of running `cleanup-indexes`.

# Data Structure
The TOS function expects three Datastore kinds: `Application`, `TermsOfService`, and `TOSResponse`. These represent an application (ex. FireCloud), a Terms of Service for that application and a user's response to that Terms of Service, respectively. All three kinds reside in a namespace named `app`.

All `TOSResponse` entities must have a `TermsOfService` entity as their ancestor, and all `TermsOfService` entities must have an `Application` entity as their ancestor.

## Application
The `Application` kind does not expect any additional properties. You may add some; this code does not care.

The `Application` kind **must** have a user-supplied key that represents the name of the application, ex. 'FireCloud'.

## TermsOfService
The `TermsOfService` kind expects the following properties:

* `timestamp`: Date/time, should be the datetime of insertion

The `TermsOfService` kind **must** have a user-supplied key that represents the version of the TOS, ex. '20180815.1'.

All `TermsOfService` entities must have an `Application` entity as their ancestor.

## TOSResponse
The `TOSResponse` kind expects the following properties:

* `userid`: String, ex. '123456'
* `email`: String, ex. help@example.com
* `accepted`: Boolean, whether or not the user accepted the terms of service
* `timestamp`: Date/time, should be the datetime of insertion

All `TOSResponse` entities must have a `TermsOfService` entity as their ancestor.

The `TOSResponse` kind uses Datastore-generated keys.

*Important:* `userid` is a String. In Workbench, users are typically identified by a numeric subjectId provided by Google. These numeric ids should be cast to a String, and the Cloud Function in this repo will perform this cast. We choose String here for forward compatibility with other applications that may identify users by e.g. email address.





