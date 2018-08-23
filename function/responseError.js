class ResponseError extends Error {
  constructor(message, statusCode, cause) {
    super(message);
    this.statusCode = statusCode || 500;
    this.cause = cause;
    this.name = 'ResponseError';
  }
}

module.exports = ResponseError;