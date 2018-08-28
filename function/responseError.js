const _ = require('lodash/core');

class ResponseError extends Error {
  constructor(message, statusCode, cause) {
    super(message || statusCode || 'ResponseError');
    this.statusCode = statusCode || 500;
    this.cause = cause;
    this.name = 'ResponseError';
  }
}

/**
 * Returns a Promise.reject() wrapping a ResponseError.
 *
 * @param {*} errorCode HTTP status code to use for the wrapped ResponseError
 * @param {*} errorOrMessage can be either an Error object (preferably a ResponseError) whose message and cause will be reused, 
 *    or a message to marshal into a ResponseError.
 */
const rejection = function(errorCode, errorOrMessage) {

  const statusCode = errorCode || 500;
  let message, cause;
  if (_.isObject(errorOrMessage)) {
    message = errorOrMessage.message;
    cause = errorOrMessage.cause
  } else {
    message = errorOrMessage;
    cause = undefined;
  }

  return Promise.reject(new ResponseError(message, statusCode, cause));
}

/**
 * Accepts a ResponseError and prefixes the specified value onto that ResponseError's message.
 * @param {*} error the error to prefix
 * @param {*} prefix the prefix to prepend
 */
const prefixedRejection = function(error, prefix) {
  return Promise.reject(new ResponseError(`${prefix}: ${error.message}`, error.statusCode, error.cause));
}

module.exports = {rejection, prefixedRejection, ResponseError};
