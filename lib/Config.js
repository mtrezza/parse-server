"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Config = void 0;

var _cache = _interopRequireDefault(require("./cache"));

var _SchemaCache = _interopRequireDefault(require("./Controllers/SchemaCache"));

var _DatabaseController = _interopRequireDefault(require("./Controllers/DatabaseController"));

var _net = _interopRequireDefault(require("net"));

var _Definitions = require("./Options/Definitions");

var _lodash = require("lodash");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// A Config object provides information about how a specific app is
// configured.
// mount is the URL for the root of the API; includes http, domain, etc.
function removeTrailingSlash(str) {
  if (!str) {
    return str;
  }

  if (str.endsWith('/')) {
    str = str.substr(0, str.length - 1);
  }

  return str;
}

class Config {
  static get(applicationId, mount) {
    const cacheInfo = _cache.default.get(applicationId);

    if (!cacheInfo) {
      return;
    }

    const config = new Config();
    config.applicationId = applicationId;
    Object.keys(cacheInfo).forEach(key => {
      if (key == 'databaseController') {
        const schemaCache = new _SchemaCache.default(cacheInfo.cacheController, cacheInfo.schemaCacheTTL, cacheInfo.enableSingleSchemaCache);
        config.database = new _DatabaseController.default(cacheInfo.databaseController.adapter, schemaCache);
      } else {
        config[key] = cacheInfo[key];
      }
    });
    config.mount = removeTrailingSlash(mount);
    config.generateSessionExpiresAt = config.generateSessionExpiresAt.bind(config);
    config.generateEmailVerifyTokenExpiresAt = config.generateEmailVerifyTokenExpiresAt.bind(config);
    return config;
  }

  static put(serverConfiguration) {
    Config.validate(serverConfiguration);

    _cache.default.put(serverConfiguration.appId, serverConfiguration);

    Config.setupPasswordValidator(serverConfiguration.passwordPolicy);
    return serverConfiguration;
  }

  static validate({
    verifyUserEmails,
    userController,
    appName,
    publicServerURL,
    revokeSessionOnPasswordReset,
    expireInactiveSessions,
    sessionLength,
    maxLimit,
    emailVerifyTokenValidityDuration,
    accountLockout,
    passwordPolicy,
    masterKeyIps,
    masterKey,
    readOnlyMasterKey,
    allowHeaders,
    idempotencyOptions,
    emailVerifyTokenReuseIfValid,
    fileUpload,
    pages
  }) {
    if (masterKey === readOnlyMasterKey) {
      throw new Error('masterKey and readOnlyMasterKey should be different');
    }

    const emailAdapter = userController.adapter;

    if (verifyUserEmails) {
      this.validateEmailConfiguration({
        emailAdapter,
        appName,
        publicServerURL,
        emailVerifyTokenValidityDuration,
        emailVerifyTokenReuseIfValid
      });
    }

    this.validateAccountLockoutPolicy(accountLockout);
    this.validatePasswordPolicy(passwordPolicy);
    this.validateFileUploadOptions(fileUpload);

    if (typeof revokeSessionOnPasswordReset !== 'boolean') {
      throw 'revokeSessionOnPasswordReset must be a boolean value';
    }

    if (publicServerURL) {
      if (!publicServerURL.startsWith('http://') && !publicServerURL.startsWith('https://')) {
        throw 'publicServerURL should be a valid HTTPS URL starting with https://';
      }
    }

    this.validateSessionConfiguration(sessionLength, expireInactiveSessions);
    this.validateMasterKeyIps(masterKeyIps);
    this.validateMaxLimit(maxLimit);
    this.validateAllowHeaders(allowHeaders);
    this.validateIdempotencyOptions(idempotencyOptions);
    this.validatePagesOptions(pages);
  }

  static validatePagesOptions(pages) {
    if (Object.prototype.toString.call(pages) !== '[object Object]') {
      throw 'Parse Server option pages must be an object.';
    }

    if (pages.enableRouter === undefined) {
      pages.enableRouter = _Definitions.PagesOptions.enableRouter.default;
    } else if (!(0, _lodash.isBoolean)(pages.enableRouter)) {
      throw 'Parse Server option pages.enableRouter must be a boolean.';
    }

    if (pages.enableLocalization === undefined) {
      pages.enableLocalization = _Definitions.PagesOptions.enableLocalization.default;
    } else if (!(0, _lodash.isBoolean)(pages.enableLocalization)) {
      throw 'Parse Server option pages.enableLocalization must be a boolean.';
    }

    if (pages.forceRedirect === undefined) {
      pages.forceRedirect = _Definitions.PagesOptions.forceRedirect.default;
    } else if (!(0, _lodash.isBoolean)(pages.forceRedirect)) {
      throw 'Parse Server option pages.forceRedirect must be a boolean.';
    }

    if (pages.pagesPath === undefined) {
      pages.pagesPath = _Definitions.PagesOptions.pagesPath.default;
    } else if (!(0, _lodash.isString)(pages.pagesPath)) {
      throw 'Parse Server option pages.pagesPath must be a string.';
    }

    if (pages.pagesEndpoint === undefined) {
      pages.pagesEndpoint = _Definitions.PagesOptions.pagesEndpoint.default;
    } else if (!(0, _lodash.isString)(pages.pagesEndpoint)) {
      throw 'Parse Server option pages.pagesEndpoint must be a string.';
    }

    if (pages.customUrls === undefined) {
      pages.customUrls = _Definitions.PagesOptions.customUrls.default;
    } else if (Object.prototype.toString.call(pages.customUrls) !== '[object Object]') {
      throw 'Parse Server option pages.customUrls must be an object.';
    }
  }

  static validateIdempotencyOptions(idempotencyOptions) {
    if (!idempotencyOptions) {
      return;
    }

    if (idempotencyOptions.ttl === undefined) {
      idempotencyOptions.ttl = _Definitions.IdempotencyOptions.ttl.default;
    } else if (!isNaN(idempotencyOptions.ttl) && idempotencyOptions.ttl <= 0) {
      throw 'idempotency TTL value must be greater than 0 seconds';
    } else if (isNaN(idempotencyOptions.ttl)) {
      throw 'idempotency TTL value must be a number';
    }

    if (!idempotencyOptions.paths) {
      idempotencyOptions.paths = _Definitions.IdempotencyOptions.paths.default;
    } else if (!(idempotencyOptions.paths instanceof Array)) {
      throw 'idempotency paths must be of an array of strings';
    }
  }

  static validateAccountLockoutPolicy(accountLockout) {
    if (accountLockout) {
      if (typeof accountLockout.duration !== 'number' || accountLockout.duration <= 0 || accountLockout.duration > 99999) {
        throw 'Account lockout duration should be greater than 0 and less than 100000';
      }

      if (!Number.isInteger(accountLockout.threshold) || accountLockout.threshold < 1 || accountLockout.threshold > 999) {
        throw 'Account lockout threshold should be an integer greater than 0 and less than 1000';
      }

      if (accountLockout.unlockOnPasswordReset === undefined) {
        accountLockout.unlockOnPasswordReset = _Definitions.AccountLockoutOptions.unlockOnPasswordReset.default;
      } else if (!(0, _lodash.isBoolean)(accountLockout.unlockOnPasswordReset)) {
        throw 'Parse Server option accountLockout.unlockOnPasswordReset must be a boolean.';
      }
    }
  }

  static validatePasswordPolicy(passwordPolicy) {
    if (passwordPolicy) {
      if (passwordPolicy.maxPasswordAge !== undefined && (typeof passwordPolicy.maxPasswordAge !== 'number' || passwordPolicy.maxPasswordAge < 0)) {
        throw 'passwordPolicy.maxPasswordAge must be a positive number';
      }

      if (passwordPolicy.resetTokenValidityDuration !== undefined && (typeof passwordPolicy.resetTokenValidityDuration !== 'number' || passwordPolicy.resetTokenValidityDuration <= 0)) {
        throw 'passwordPolicy.resetTokenValidityDuration must be a positive number';
      }

      if (passwordPolicy.validatorPattern) {
        if (typeof passwordPolicy.validatorPattern === 'string') {
          passwordPolicy.validatorPattern = new RegExp(passwordPolicy.validatorPattern);
        } else if (!(passwordPolicy.validatorPattern instanceof RegExp)) {
          throw 'passwordPolicy.validatorPattern must be a regex string or RegExp object.';
        }
      }

      if (passwordPolicy.validatorCallback && typeof passwordPolicy.validatorCallback !== 'function') {
        throw 'passwordPolicy.validatorCallback must be a function.';
      }

      if (passwordPolicy.doNotAllowUsername && typeof passwordPolicy.doNotAllowUsername !== 'boolean') {
        throw 'passwordPolicy.doNotAllowUsername must be a boolean value.';
      }

      if (passwordPolicy.maxPasswordHistory && (!Number.isInteger(passwordPolicy.maxPasswordHistory) || passwordPolicy.maxPasswordHistory <= 0 || passwordPolicy.maxPasswordHistory > 20)) {
        throw 'passwordPolicy.maxPasswordHistory must be an integer ranging 0 - 20';
      }

      if (passwordPolicy.resetTokenReuseIfValid && typeof passwordPolicy.resetTokenReuseIfValid !== 'boolean') {
        throw 'resetTokenReuseIfValid must be a boolean value';
      }

      if (passwordPolicy.resetTokenReuseIfValid && !passwordPolicy.resetTokenValidityDuration) {
        throw 'You cannot use resetTokenReuseIfValid without resetTokenValidityDuration';
      }
    }
  } // if the passwordPolicy.validatorPattern is configured then setup a callback to process the pattern


  static setupPasswordValidator(passwordPolicy) {
    if (passwordPolicy && passwordPolicy.validatorPattern) {
      passwordPolicy.patternValidator = value => {
        return passwordPolicy.validatorPattern.test(value);
      };
    }
  }

  static validateEmailConfiguration({
    emailAdapter,
    appName,
    publicServerURL,
    emailVerifyTokenValidityDuration,
    emailVerifyTokenReuseIfValid
  }) {
    if (!emailAdapter) {
      throw 'An emailAdapter is required for e-mail verification and password resets.';
    }

    if (typeof appName !== 'string') {
      throw 'An app name is required for e-mail verification and password resets.';
    }

    if (typeof publicServerURL !== 'string') {
      throw 'A public server url is required for e-mail verification and password resets.';
    }

    if (emailVerifyTokenValidityDuration) {
      if (isNaN(emailVerifyTokenValidityDuration)) {
        throw 'Email verify token validity duration must be a valid number.';
      } else if (emailVerifyTokenValidityDuration <= 0) {
        throw 'Email verify token validity duration must be a value greater than 0.';
      }
    }

    if (emailVerifyTokenReuseIfValid && typeof emailVerifyTokenReuseIfValid !== 'boolean') {
      throw 'emailVerifyTokenReuseIfValid must be a boolean value';
    }

    if (emailVerifyTokenReuseIfValid && !emailVerifyTokenValidityDuration) {
      throw 'You cannot use emailVerifyTokenReuseIfValid without emailVerifyTokenValidityDuration';
    }
  }

  static validateFileUploadOptions(fileUpload) {
    try {
      if (fileUpload == null || typeof fileUpload !== 'object' || fileUpload instanceof Array) {
        throw 'fileUpload must be an object value.';
      }
    } catch (e) {
      if (e instanceof ReferenceError) {
        return;
      }

      throw e;
    }

    if (fileUpload.enableForAnonymousUser === undefined) {
      fileUpload.enableForAnonymousUser = _Definitions.FileUploadOptions.enableForAnonymousUser.default;
    } else if (typeof fileUpload.enableForAnonymousUser !== 'boolean') {
      throw 'fileUpload.enableForAnonymousUser must be a boolean value.';
    }

    if (fileUpload.enableForPublic === undefined) {
      fileUpload.enableForPublic = _Definitions.FileUploadOptions.enableForPublic.default;
    } else if (typeof fileUpload.enableForPublic !== 'boolean') {
      throw 'fileUpload.enableForPublic must be a boolean value.';
    }

    if (fileUpload.enableForAuthenticatedUser === undefined) {
      fileUpload.enableForAuthenticatedUser = _Definitions.FileUploadOptions.enableForAuthenticatedUser.default;
    } else if (typeof fileUpload.enableForAuthenticatedUser !== 'boolean') {
      throw 'fileUpload.enableForAuthenticatedUser must be a boolean value.';
    }
  }

  static validateMasterKeyIps(masterKeyIps) {
    for (const ip of masterKeyIps) {
      if (!_net.default.isIP(ip)) {
        throw `Invalid ip in masterKeyIps: ${ip}`;
      }
    }
  }

  get mount() {
    var mount = this._mount;

    if (this.publicServerURL) {
      mount = this.publicServerURL;
    }

    return mount;
  }

  set mount(newValue) {
    this._mount = newValue;
  }

  static validateSessionConfiguration(sessionLength, expireInactiveSessions) {
    if (expireInactiveSessions) {
      if (isNaN(sessionLength)) {
        throw 'Session length must be a valid number.';
      } else if (sessionLength <= 0) {
        throw 'Session length must be a value greater than 0.';
      }
    }
  }

  static validateMaxLimit(maxLimit) {
    if (maxLimit <= 0) {
      throw 'Max limit must be a value greater than 0.';
    }
  }

  static validateAllowHeaders(allowHeaders) {
    if (![null, undefined].includes(allowHeaders)) {
      if (Array.isArray(allowHeaders)) {
        allowHeaders.forEach(header => {
          if (typeof header !== 'string') {
            throw 'Allow headers must only contain strings';
          } else if (!header.trim().length) {
            throw 'Allow headers must not contain empty strings';
          }
        });
      } else {
        throw 'Allow headers must be an array';
      }
    }
  }

  generateEmailVerifyTokenExpiresAt() {
    if (!this.verifyUserEmails || !this.emailVerifyTokenValidityDuration) {
      return undefined;
    }

    var now = new Date();
    return new Date(now.getTime() + this.emailVerifyTokenValidityDuration * 1000);
  }

  generatePasswordResetTokenExpiresAt() {
    if (!this.passwordPolicy || !this.passwordPolicy.resetTokenValidityDuration) {
      return undefined;
    }

    const now = new Date();
    return new Date(now.getTime() + this.passwordPolicy.resetTokenValidityDuration * 1000);
  }

  generateSessionExpiresAt() {
    if (!this.expireInactiveSessions) {
      return undefined;
    }

    var now = new Date();
    return new Date(now.getTime() + this.sessionLength * 1000);
  }

  get invalidLinkURL() {
    return this.customPages.invalidLink || `${this.publicServerURL}/apps/invalid_link.html`;
  }

  get invalidVerificationLinkURL() {
    return this.customPages.invalidVerificationLink || `${this.publicServerURL}/apps/invalid_verification_link.html`;
  }

  get linkSendSuccessURL() {
    return this.customPages.linkSendSuccess || `${this.publicServerURL}/apps/link_send_success.html`;
  }

  get linkSendFailURL() {
    return this.customPages.linkSendFail || `${this.publicServerURL}/apps/link_send_fail.html`;
  }

  get verifyEmailSuccessURL() {
    return this.customPages.verifyEmailSuccess || `${this.publicServerURL}/apps/verify_email_success.html`;
  }

  get choosePasswordURL() {
    return this.customPages.choosePassword || `${this.publicServerURL}/apps/choose_password`;
  }

  get requestResetPasswordURL() {
    return `${this.publicServerURL}/apps/${this.applicationId}/request_password_reset`;
  }

  get passwordResetSuccessURL() {
    return this.customPages.passwordResetSuccess || `${this.publicServerURL}/apps/password_reset_success.html`;
  }

  get parseFrameURL() {
    return this.customPages.parseFrameURL;
  }

  get verifyEmailURL() {
    return `${this.publicServerURL}/apps/${this.applicationId}/verify_email`;
  }

}

exports.Config = Config;
var _default = Config;
exports.default = _default;
module.exports = Config;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9Db25maWcuanMiXSwibmFtZXMiOlsicmVtb3ZlVHJhaWxpbmdTbGFzaCIsInN0ciIsImVuZHNXaXRoIiwic3Vic3RyIiwibGVuZ3RoIiwiQ29uZmlnIiwiZ2V0IiwiYXBwbGljYXRpb25JZCIsIm1vdW50IiwiY2FjaGVJbmZvIiwiQXBwQ2FjaGUiLCJjb25maWciLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsImtleSIsInNjaGVtYUNhY2hlIiwiU2NoZW1hQ2FjaGUiLCJjYWNoZUNvbnRyb2xsZXIiLCJzY2hlbWFDYWNoZVRUTCIsImVuYWJsZVNpbmdsZVNjaGVtYUNhY2hlIiwiZGF0YWJhc2UiLCJEYXRhYmFzZUNvbnRyb2xsZXIiLCJkYXRhYmFzZUNvbnRyb2xsZXIiLCJhZGFwdGVyIiwiZ2VuZXJhdGVTZXNzaW9uRXhwaXJlc0F0IiwiYmluZCIsImdlbmVyYXRlRW1haWxWZXJpZnlUb2tlbkV4cGlyZXNBdCIsInB1dCIsInNlcnZlckNvbmZpZ3VyYXRpb24iLCJ2YWxpZGF0ZSIsImFwcElkIiwic2V0dXBQYXNzd29yZFZhbGlkYXRvciIsInBhc3N3b3JkUG9saWN5IiwidmVyaWZ5VXNlckVtYWlscyIsInVzZXJDb250cm9sbGVyIiwiYXBwTmFtZSIsInB1YmxpY1NlcnZlclVSTCIsInJldm9rZVNlc3Npb25PblBhc3N3b3JkUmVzZXQiLCJleHBpcmVJbmFjdGl2ZVNlc3Npb25zIiwic2Vzc2lvbkxlbmd0aCIsIm1heExpbWl0IiwiZW1haWxWZXJpZnlUb2tlblZhbGlkaXR5RHVyYXRpb24iLCJhY2NvdW50TG9ja291dCIsIm1hc3RlcktleUlwcyIsIm1hc3RlcktleSIsInJlYWRPbmx5TWFzdGVyS2V5IiwiYWxsb3dIZWFkZXJzIiwiaWRlbXBvdGVuY3lPcHRpb25zIiwiZW1haWxWZXJpZnlUb2tlblJldXNlSWZWYWxpZCIsImZpbGVVcGxvYWQiLCJwYWdlcyIsIkVycm9yIiwiZW1haWxBZGFwdGVyIiwidmFsaWRhdGVFbWFpbENvbmZpZ3VyYXRpb24iLCJ2YWxpZGF0ZUFjY291bnRMb2Nrb3V0UG9saWN5IiwidmFsaWRhdGVQYXNzd29yZFBvbGljeSIsInZhbGlkYXRlRmlsZVVwbG9hZE9wdGlvbnMiLCJzdGFydHNXaXRoIiwidmFsaWRhdGVTZXNzaW9uQ29uZmlndXJhdGlvbiIsInZhbGlkYXRlTWFzdGVyS2V5SXBzIiwidmFsaWRhdGVNYXhMaW1pdCIsInZhbGlkYXRlQWxsb3dIZWFkZXJzIiwidmFsaWRhdGVJZGVtcG90ZW5jeU9wdGlvbnMiLCJ2YWxpZGF0ZVBhZ2VzT3B0aW9ucyIsInByb3RvdHlwZSIsInRvU3RyaW5nIiwiY2FsbCIsImVuYWJsZVJvdXRlciIsInVuZGVmaW5lZCIsIlBhZ2VzT3B0aW9ucyIsImRlZmF1bHQiLCJlbmFibGVMb2NhbGl6YXRpb24iLCJmb3JjZVJlZGlyZWN0IiwicGFnZXNQYXRoIiwicGFnZXNFbmRwb2ludCIsImN1c3RvbVVybHMiLCJ0dGwiLCJJZGVtcG90ZW5jeU9wdGlvbnMiLCJpc05hTiIsInBhdGhzIiwiQXJyYXkiLCJkdXJhdGlvbiIsIk51bWJlciIsImlzSW50ZWdlciIsInRocmVzaG9sZCIsInVubG9ja09uUGFzc3dvcmRSZXNldCIsIkFjY291bnRMb2Nrb3V0T3B0aW9ucyIsIm1heFBhc3N3b3JkQWdlIiwicmVzZXRUb2tlblZhbGlkaXR5RHVyYXRpb24iLCJ2YWxpZGF0b3JQYXR0ZXJuIiwiUmVnRXhwIiwidmFsaWRhdG9yQ2FsbGJhY2siLCJkb05vdEFsbG93VXNlcm5hbWUiLCJtYXhQYXNzd29yZEhpc3RvcnkiLCJyZXNldFRva2VuUmV1c2VJZlZhbGlkIiwicGF0dGVyblZhbGlkYXRvciIsInZhbHVlIiwidGVzdCIsImUiLCJSZWZlcmVuY2VFcnJvciIsImVuYWJsZUZvckFub255bW91c1VzZXIiLCJGaWxlVXBsb2FkT3B0aW9ucyIsImVuYWJsZUZvclB1YmxpYyIsImVuYWJsZUZvckF1dGhlbnRpY2F0ZWRVc2VyIiwiaXAiLCJuZXQiLCJpc0lQIiwiX21vdW50IiwibmV3VmFsdWUiLCJpbmNsdWRlcyIsImlzQXJyYXkiLCJoZWFkZXIiLCJ0cmltIiwibm93IiwiRGF0ZSIsImdldFRpbWUiLCJnZW5lcmF0ZVBhc3N3b3JkUmVzZXRUb2tlbkV4cGlyZXNBdCIsImludmFsaWRMaW5rVVJMIiwiY3VzdG9tUGFnZXMiLCJpbnZhbGlkTGluayIsImludmFsaWRWZXJpZmljYXRpb25MaW5rVVJMIiwiaW52YWxpZFZlcmlmaWNhdGlvbkxpbmsiLCJsaW5rU2VuZFN1Y2Nlc3NVUkwiLCJsaW5rU2VuZFN1Y2Nlc3MiLCJsaW5rU2VuZEZhaWxVUkwiLCJsaW5rU2VuZEZhaWwiLCJ2ZXJpZnlFbWFpbFN1Y2Nlc3NVUkwiLCJ2ZXJpZnlFbWFpbFN1Y2Nlc3MiLCJjaG9vc2VQYXNzd29yZFVSTCIsImNob29zZVBhc3N3b3JkIiwicmVxdWVzdFJlc2V0UGFzc3dvcmRVUkwiLCJwYXNzd29yZFJlc2V0U3VjY2Vzc1VSTCIsInBhc3N3b3JkUmVzZXRTdWNjZXNzIiwicGFyc2VGcmFtZVVSTCIsInZlcmlmeUVtYWlsVVJMIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUlBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQU1BOzs7O0FBZEE7QUFDQTtBQUNBO0FBY0EsU0FBU0EsbUJBQVQsQ0FBNkJDLEdBQTdCLEVBQWtDO0FBQ2hDLE1BQUksQ0FBQ0EsR0FBTCxFQUFVO0FBQ1IsV0FBT0EsR0FBUDtBQUNEOztBQUNELE1BQUlBLEdBQUcsQ0FBQ0MsUUFBSixDQUFhLEdBQWIsQ0FBSixFQUF1QjtBQUNyQkQsSUFBQUEsR0FBRyxHQUFHQSxHQUFHLENBQUNFLE1BQUosQ0FBVyxDQUFYLEVBQWNGLEdBQUcsQ0FBQ0csTUFBSixHQUFhLENBQTNCLENBQU47QUFDRDs7QUFDRCxTQUFPSCxHQUFQO0FBQ0Q7O0FBRU0sTUFBTUksTUFBTixDQUFhO0FBQ2xCLFNBQU9DLEdBQVAsQ0FBV0MsYUFBWCxFQUFrQ0MsS0FBbEMsRUFBaUQ7QUFDL0MsVUFBTUMsU0FBUyxHQUFHQyxlQUFT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MkJBQWhFO0FBQ0Q7O0FBRUQsTUFBSTBGLHFCQUFKLEdBQTRCO0FBQzFCLFdBQ0UsS0FBS1IsV0FBTCxDQUFpQlMsa0JBQWpCLElBQ0MsR0FBRSxLQUFLM0YsZUFBZ0IsaUNBRjFCO0FBSUQ7O0FBRUQsTUFBSTRGLGlCQUFKLEdBQXdCO0FBQ3RCLFdBQU8sS0FBS1YsV0FBTCxDQUFpQlcsY0FBakIsSUFBb0MsR0FBRSxLQUFLN0YsZUFBZ0IsdUJBQWxFO0FBQ0Q7O0FBRUQsTUFBSThGLHVCQUFKLEdBQThCO0FBQzVCLFdBQVEsR0FBRSxLQUFLOUYsZUFBZ0IsU0FBUSxLQUFLOUIsYUFBYyx5QkFBMUQ7QUFDRDs7QUFFRCxNQUFJNkgsdUJBQUosR0FBOEI7QUFDNUIsV0FDRSxLQUFLYixXQUFMLENBQWlCYyxvQkFBakIsSUFDQyxHQUFFLEtBQUtoRyxlQUFnQixtQ0FGMUI7QUFJRDs7QUFFRCxNQUFJaUcsYUFBSixHQUFvQjtBQUNsQixXQUFPLEtBQUtmLFdBQUwsQ0FBaUJlLGFBQXhCO0FBQ0Q7O0FBRUQsTUFBSUMsY0FBSixHQUFxQjtBQUNuQixXQUFRLEdBQUUsS0FBS2xHLGVBQWdCLFNBQVEsS0FBSzlCLGFBQWMsZUFBMUQ7QUFDRDs7QUF6YWlCOzs7ZUE0YUxGLE07O0FBQ2ZtSSxNQUFNLENBQUNDLE9BQVAsR0FBaUJwSSxNQUFqQiIsInNvdXJjZXNDb250ZW50IjpbIi8vIEEgQ29uZmlnIG9iamVjdCBwcm92aWRlcyBpbmZvcm1hdGlvbiBhYm91dCBob3cgYSBzcGVjaWZpYyBhcHAgaXNcbi8vIGNvbmZpZ3VyZWQuXG4vLyBtb3VudCBpcyB0aGUgVVJMIGZvciB0aGUgcm9vdCBvZiB0aGUgQVBJOyBpbmNsdWRlcyBodHRwLCBkb21haW4sIGV0Yy5cblxuaW1wb3J0IEFwcENhY2hlIGZyb20gJy4vY2FjaGUnO1xuaW1wb3J0IFNjaGVtYUNhY2hlIGZyb20gJy4vQ29udHJvbGxlcnMvU2NoZW1hQ2FjaGUnO1xuaW1wb3J0IERhdGFiYXNlQ29udHJvbGxlciBmcm9tICcuL0NvbnRyb2xsZXJzL0RhdGFiYXNlQ29udHJvbGxlcic7XG5pbXBvcnQgbmV0IGZyb20gJ25ldCc7XG5pbXBvcnQge1xuICBJZGVtcG90ZW5jeU9wdGlvbnMsXG4gIEZpbGVVcGxvYWRPcHRpb25zLFxuICBQYWdlc09wdGlvbnMsXG4gIEFjY291bnRMb2Nrb3V0T3B0aW9ucyxcbn0gZnJvbSAnLi9PcHRpb25zL0RlZmluaXRpb25zJztcbmltcG9ydCB7IGlzQm9vbGVhbiwgaXNTdHJpbmcgfSBmcm9tICdsb2Rhc2gnO1xuXG5mdW5jdGlvbiByZW1vdmVUcmFpbGluZ1NsYXNoKHN0cikge1xuICBpZiAoIXN0cikge1xuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgaWYgKHN0ci5lbmRzV2l0aCgnLycpKSB7XG4gICAgc3RyID0gc3RyLnN1YnN0cigwLCBzdHIubGVuZ3RoIC0gMSk7XG4gIH1cbiAgcmV0dXJuIHN0cjtcbn1cblxuZXhwb3J0IGNsYXNzIENvbmZpZyB7XG4gIHN0YXRpYyBnZXQoYXBwbGljYXRpb25JZDogc3RyaW5nLCBtb3VudDogc3RyaW5nKSB7XG4gICAgY29uc3QgY2FjaGVJbmZvID0gQXBwQ2FjaGUuZ2V0KGFwcGxpY2F0aW9uSWQpO1xuICAgIGlmICghY2FjaGVJbmZvKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGNvbmZpZyA9IG5ldyBDb25maWcoKTtcbiAgICBjb25maWcuYXBwbGljYXRpb25JZCA9IGFwcGxpY2F0aW9uSWQ7XG4gICAgT2JqZWN0LmtleXMoY2FjaGVJbmZvKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBpZiAoa2V5ID09ICdkYXRhYmFzZUNvbnRyb2xsZXInKSB7XG4gICAgICAgIGNvbnN0IHNjaGVtYUNhY2hlID0gbmV3IFNjaGVtYUNhY2hlKFxuICAgICAgICAgIGNhY2hlSW5mby5jYWNoZUNvbnRyb2xsZXIsXG4gICAgICAgICAgY2FjaGVJbmZvLnNjaGVtYUNhY2hlVFRMLFxuICAgICAgICAgIGNhY2hlSW5mby5lbmFibGVTaW5nbGVTY2hlbWFDYWNoZVxuICAgICAgICApO1xuICAgICAgICBjb25maWcuZGF0YWJhc2UgPSBuZXcgRGF0YWJhc2VDb250cm9sbGVyKGNhY2hlSW5mby5kYXRhYmFzZUNvbnRyb2xsZXIuYWRhcHRlciwgc2NoZW1hQ2FjaGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uZmlnW2tleV0gPSBjYWNoZUluZm9ba2V5XTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBjb25maWcubW91bnQgPSByZW1vdmVUcmFpbGluZ1NsYXNoKG1vdW50KTtcbiAgICBjb25maWcuZ2VuZXJhdGVTZXNzaW9uRXhwaXJlc0F0ID0gY29uZmlnLmdlbmVyYXRlU2Vzc2lvbkV4cGlyZXNBdC5iaW5kKGNvbmZpZyk7XG4gICAgY29uZmlnLmdlbmVyYXRlRW1haWxWZXJpZnlUb2tlbkV4cGlyZXNBdCA9IGNvbmZpZy5nZW5lcmF0ZUVtYWlsVmVyaWZ5VG9rZW5FeHBpcmVzQXQuYmluZChcbiAgICAgIGNvbmZpZ1xuICAgICk7XG4gICAgcmV0dXJuIGNvbmZpZztcbiAgfVxuXG4gIHN0YXRpYyBwdXQoc2VydmVyQ29uZmlndXJhdGlvbikge1xuICAgIENvbmZpZy52YWxpZGF0ZShzZXJ2ZXJDb25maWd1cmF0aW9uKTtcbiAgICBBcHBDYWNoZS5wdXQoc2VydmVyQ29uZmlndXJhdGlvbi5hcHBJZCwgc2VydmVyQ29uZmlndXJhdGlvbik7XG4gICAgQ29uZmlnLnNldHVwUGFzc3dvcmRWYWxpZGF0b3Ioc2VydmVyQ29uZmlndXJhdGlvbi5wYXNzd29yZFBvbGljeSk7XG4gICAgcmV0dXJuIHNlcnZlckNvbmZpZ3VyYXRpb247XG4gIH1cblxuICBzdGF0aWMgdmFsaWRhdGUoe1xuICAgIHZlcmlmeVVzZXJFbWFpbHMsXG4gICAgdXNlckNvbnRyb2xsZXIsXG4gICAgYXBwTmFtZSxcbiAgICBwdWJsaWNTZXJ2ZXJVUkwsXG4gICAgcmV2b2tlU2Vzc2lvbk9uUGFzc3dvcmRSZXNldCxcbiAgICBleHBpcmVJbmFjdGl2ZVNlc3Npb25zLFxuICAgIHNlc3Npb25MZW5ndGgsXG4gICAgbWF4TGltaXQsXG4gICAgZW1haWxWZXJpZnlUb2tlblZhbGlkaXR5RHVyYXRpb24sXG4gICAgYWNjb3VudExvY2tvdXQsXG4gICAgcGFzc3dvcmRQb2xpY3ksXG4gICAgbWFzdGVyS2V5SXBzLFxuICAgIG1hc3RlcktleSxcbiAgICByZWFkT25seU1hc3RlcktleSxcbiAgICBhbGxvd0hlYWRlcnMsXG4gICAgaWRlbXBvdGVuY3lPcHRpb25zLFxuICAgIGVtYWlsVmVyaWZ5VG9rZW5SZXVzZUlmVmFsaWQsXG4gICAgZmlsZVVwbG9hZCxcbiAgICBwYWdlcyxcbiAgfSkge1xuICAgIGlmIChtYXN0ZXJLZXkgPT09IHJlYWRPbmx5TWFzdGVyS2V5KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ21hc3RlcktleSBhbmQgcmVhZE9ubHlNYXN0ZXJLZXkgc2hvdWxkIGJlIGRpZmZlcmVudCcpO1xuICAgIH1cblxuICAgIGNvbnN0IGVtYWlsQWRhcHRlciA9IHVzZXJDb250cm9sbGVyLmFkYXB0ZXI7XG4gICAgaWYgKHZlcmlmeVVzZXJFbWFpbHMpIHtcbiAgICAgIHRoaXMudmFsaWRhdGVFbWFpbENvbmZpZ3VyYXRpb24oe1xuICAgICAgICBlbWFpbEFkYXB0ZXIsXG4gICAgICAgIGFwcE5hbWUsXG4gICAgICAgIHB1YmxpY1NlcnZlclVSTCxcbiAgICAgICAgZW1haWxWZXJpZnlUb2tlblZhbGlkaXR5RHVyYXRpb24sXG4gICAgICAgIGVtYWlsVmVyaWZ5VG9rZW5SZXVzZUlmVmFsaWQsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnZhbGlkYXRlQWNjb3VudExvY2tvdXRQb2xpY3koYWNjb3VudExvY2tvdXQpO1xuICAgIHRoaXMudmFsaWRhdGVQYXNzd29yZFBvbGljeShwYXNzd29yZFBvbGljeSk7XG4gICAgdGhpcy52YWxpZGF0ZUZpbGVVcGxvYWRPcHRpb25zKGZpbGVVcGxvYWQpO1xuXG4gICAgaWYgKHR5cGVvZiByZXZva2VTZXNzaW9uT25QYXNzd29yZFJlc2V0ICE9PSAnYm9vbGVhbicpIHtcbiAgICAgIHRocm93ICdyZXZva2VTZXNzaW9uT25QYXNzd29yZFJlc2V0IG11c3QgYmUgYSBib29sZWFuIHZhbHVlJztcbiAgICB9XG5cbiAgICBpZiAocHVibGljU2VydmVyVVJMKSB7XG4gICAgICBpZiAoIXB1YmxpY1NlcnZlclVSTC5zdGFydHNXaXRoKCdodHRwOi8vJykgJiYgIXB1YmxpY1NlcnZlclVSTC5zdGFydHNXaXRoKCdodHRwczovLycpKSB7XG4gICAgICAgIHRocm93ICdwdWJsaWNTZXJ2ZXJVUkwgc2hvdWxkIGJlIGEgdmFsaWQgSFRUUFMgVVJMIHN0YXJ0aW5nIHdpdGggaHR0cHM6Ly8nO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnZhbGlkYXRlU2Vzc2lvbkNvbmZpZ3VyYXRpb24oc2Vzc2lvbkxlbmd0aCwgZXhwaXJlSW5hY3RpdmVTZXNzaW9ucyk7XG4gICAgdGhpcy52YWxpZGF0ZU1hc3RlcktleUlwcyhtYXN0ZXJLZXlJcHMpO1xuICAgIHRoaXMudmFsaWRhdGVNYXhMaW1pdChtYXhMaW1pdCk7XG4gICAgdGhpcy52YWxpZGF0ZUFsbG93SGVhZGVycyhhbGxvd0hlYWRlcnMpO1xuICAgIHRoaXMudmFsaWRhdGVJZGVtcG90ZW5jeU9wdGlvbnMoaWRlbXBvdGVuY3lPcHRpb25zKTtcbiAgICB0aGlzLnZhbGlkYXRlUGFnZXNPcHRpb25zKHBhZ2VzKTtcbiAgfVxuXG4gIHN0YXRpYyB2YWxpZGF0ZVBhZ2VzT3B0aW9ucyhwYWdlcykge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwocGFnZXMpICE9PSAnW29iamVjdCBPYmplY3RdJykge1xuICAgICAgdGhyb3cgJ1BhcnNlIFNlcnZlciBvcHRpb24gcGFnZXMgbXVzdCBiZSBhbiBvYmplY3QuJztcbiAgICB9XG4gICAgaWYgKHBhZ2VzLmVuYWJsZVJvdXRlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBwYWdlcy5lbmFibGVSb3V0ZXIgPSBQYWdlc09wdGlvbnMuZW5hYmxlUm91dGVyLmRlZmF1bHQ7XG4gICAgfSBlbHNlIGlmICghaXNCb29sZWFuKHBhZ2VzLmVuYWJsZVJvdXRlcikpIHtcbiAgICAgIHRocm93ICdQYXJzZSBTZXJ2ZXIgb3B0aW9uIHBhZ2VzLmVuYWJsZVJvdXRlciBtdXN0IGJlIGEgYm9vbGVhbi4nO1xuICAgIH1cbiAgICBpZiAocGFnZXMuZW5hYmxlTG9jYWxpemF0aW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhZ2VzLmVuYWJsZUxvY2FsaXphdGlvbiA9IFBhZ2VzT3B0aW9ucy5lbmFibGVMb2NhbGl6YXRpb24uZGVmYXVsdDtcbiAgICB9IGVsc2UgaWYgKCFpc0Jvb2xlYW4ocGFnZXMuZW5hYmxlTG9jYWxpemF0aW9uKSkge1xuICAgICAgdGhyb3cgJ1BhcnNlIFNlcnZlciBvcHRpb24gcGFnZXMuZW5hYmxlTG9jYWxpemF0aW9uIG11c3QgYmUgYSBib29sZWFuLic7XG4gICAgfVxuICAgIGlmIChwYWdlcy5mb3JjZVJlZGlyZWN0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhZ2VzLmZvcmNlUmVkaXJlY3QgPSBQYWdlc09wdGlvbnMuZm9yY2VSZWRpcmVjdC5kZWZhdWx0O1xuICAgIH0gZWxzZSBpZiAoIWlzQm9vbGVhbihwYWdlcy5mb3JjZVJlZGlyZWN0KSkge1xuICAgICAgdGhyb3cgJ1BhcnNlIFNlcnZlciBvcHRpb24gcGFnZXMuZm9yY2VSZWRpcmVjdCBtdXN0IGJlIGEgYm9vbGVhbi4nO1xuICAgIH1cbiAgICBpZiAocGFnZXMucGFnZXNQYXRoID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhZ2VzLnBhZ2VzUGF0aCA9IFBhZ2VzT3B0aW9ucy5wYWdlc1BhdGguZGVmYXVsdDtcbiAgICB9IGVsc2UgaWYgKCFpc1N0cmluZyhwYWdlcy5wYWdlc1BhdGgpKSB7XG4gICAgICB0aHJvdyAnUGFyc2UgU2VydmVyIG9wdGlvbiBwYWdlcy5wYWdlc1BhdGggbXVzdCBiZSBhIHN0cmluZy4nO1xuICAgIH1cbiAgICBpZiAocGFnZXMucGFnZXNFbmRwb2ludCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBwYWdlcy5wYWdlc0VuZHBvaW50ID0gUGFnZXNPcHRpb25zLnBhZ2VzRW5kcG9pbnQuZGVmYXVsdDtcbiAgICB9IGVsc2UgaWYgKCFpc1N0cmluZyhwYWdlcy5wYWdlc0VuZHBvaW50KSkge1xuICAgICAgdGhyb3cgJ1BhcnNlIFNlcnZlciBvcHRpb24gcGFnZXMucGFnZXNFbmRwb2ludCBtdXN0IGJlIGEgc3RyaW5nLic7XG4gICAgfVxuICAgIGlmIChwYWdlcy5jdXN0b21VcmxzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhZ2VzLmN1c3RvbVVybHMgPSBQYWdlc09wdGlvbnMuY3VzdG9tVXJscy5kZWZhdWx0O1xuICAgIH0gZWxzZSBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHBhZ2VzLmN1c3RvbVVybHMpICE9PSAnW29iamVjdCBPYmplY3RdJykge1xuICAgICAgdGhyb3cgJ1BhcnNlIFNlcnZlciBvcHRpb24gcGFnZXMuY3VzdG9tVXJscyBtdXN0IGJlIGFuIG9iamVjdC4nO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyB2YWxpZGF0ZUlkZW1wb3RlbmN5T3B0aW9ucyhpZGVtcG90ZW5jeU9wdGlvbnMpIHtcbiAgICBpZiAoIWlkZW1wb3RlbmN5T3B0aW9ucykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoaWRlbXBvdGVuY3lPcHRpb25zLnR0bCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZGVtcG90ZW5jeU9wdGlvbnMudHRsID0gSWRlbXBvdGVuY3lPcHRpb25zLnR0bC5kZWZhdWx0O1xuICAgIH0gZWxzZSBpZiAoIWlzTmFOKGlkZW1wb3RlbmN5T3B0aW9ucy50dGwpICYmIGlkZW1wb3RlbmN5T3B0aW9ucy50dGwgPD0gMCkge1xuICAgICAgdGhyb3cgJ2lkZW1wb3RlbmN5IFRUTCB2YWx1ZSBtdXN0IGJlIGdyZWF0ZXIgdGhhbiAwIHNlY29uZHMnO1xuICAgIH0gZWxzZSBpZiAoaXNOYU4oaWRlbXBvdGVuY3lPcHRpb25zLnR0bCkpIHtcbiAgICAgIHRocm93ICdpZGVtcG90ZW5jeSBUVEwgdmFsdWUgbXVzdCBiZSBhIG51bWJlcic7XG4gICAgfVxuICAgIGlmICghaWRlbXBvdGVuY3lPcHRpb25zLnBhdGhzKSB7XG4gICAgICBpZGVtcG90ZW5jeU9wdGlvbnMucGF0aHMgPSBJZGVtcG90ZW5jeU9wdGlvbnMucGF0aHMuZGVmYXVsdDtcbiAgICB9IGVsc2UgaWYgKCEoaWRlbXBvdGVuY3lPcHRpb25zLnBhdGhzIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICB0aHJvdyAnaWRlbXBvdGVuY3kgcGF0aHMgbXVzdCBiZSBvZiBhbiBhcnJheSBvZiBzdHJpbmdzJztcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgdmFsaWRhdGVBY2NvdW50TG9ja291dFBvbGljeShhY2NvdW50TG9ja291dCkge1xuICAgIGlmIChhY2NvdW50TG9ja291dCkge1xuICAgICAgaWYgKFxuICAgICAgICB0eXBlb2YgYWNjb3VudExvY2tvdXQuZHVyYXRpb24gIT09ICdudW1iZXInIHx8XG4gICAgICAgIGFjY291bnRMb2Nrb3V0LmR1cmF0aW9uIDw9IDAgfHxcbiAgICAgICAgYWNjb3VudExvY2tvdXQuZHVyYXRpb24gPiA5OTk5OVxuICAgICAgKSB7XG4gICAgICAgIHRocm93ICdBY2NvdW50IGxvY2tvdXQgZHVyYXRpb24gc2hvdWxkIGJlIGdyZWF0ZXIgdGhhbiAwIGFuZCBsZXNzIHRoYW4gMTAwMDAwJztcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICAhTnVtYmVyLmlzSW50ZWdlcihhY2NvdW50TG9ja291dC50aHJlc2hvbGQpIHx8XG4gICAgICAgIGFjY291bnRMb2Nrb3V0LnRocmVzaG9sZCA8IDEgfHxcbiAgICAgICAgYWNjb3VudExvY2tvdXQudGhyZXNob2xkID4gOTk5XG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgJ0FjY291bnQgbG9ja291dCB0aHJlc2hvbGQgc2hvdWxkIGJlIGFuIGludGVnZXIgZ3JlYXRlciB0aGFuIDAgYW5kIGxlc3MgdGhhbiAxMDAwJztcbiAgICAgIH1cblxuICAgICAgaWYgKGFjY291bnRMb2Nrb3V0LnVubG9ja09uUGFzc3dvcmRSZXNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGFjY291bnRMb2Nrb3V0LnVubG9ja09uUGFzc3dvcmRSZXNldCA9IEFjY291bnRMb2Nrb3V0T3B0aW9ucy51bmxvY2tPblBhc3N3b3JkUmVzZXQuZGVmYXVsdDtcbiAgICAgIH0gZWxzZSBpZiAoIWlzQm9vbGVhbihhY2NvdW50TG9ja291dC51bmxvY2tPblBhc3N3b3JkUmVzZXQpKSB7XG4gICAgICAgIHRocm93ICdQYXJzZSBTZXJ2ZXIgb3B0aW9uIGFjY291bnRMb2Nrb3V0LnVubG9ja09uUGFzc3dvcmRSZXNldCBtdXN0IGJlIGEgYm9vbGVhbi4nO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyB2YWxpZGF0ZVBhc3N3b3JkUG9saWN5KHBhc3N3b3JkUG9saWN5KSB7XG4gICAgaWYgKHBhc3N3b3JkUG9saWN5KSB7XG4gICAgICBpZiAoXG4gICAgICAgIHBhc3N3b3JkUG9saWN5Lm1heFBhc3N3b3JkQWdlICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgKHR5cGVvZiBwYXNzd29yZFBvbGljeS5tYXhQYXNzd29yZEFnZSAhPT0gJ251bWJlcicgfHwgcGFzc3dvcmRQb2xpY3kubWF4UGFzc3dvcmRBZ2UgPCAwKVxuICAgICAgKSB7XG4gICAgICAgIHRocm93ICdwYXNzd29yZFBvbGljeS5tYXhQYXNzd29yZEFnZSBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJztcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBwYXNzd29yZFBvbGljeS5yZXNldFRva2VuVmFsaWRpdHlEdXJhdGlvbiAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICh0eXBlb2YgcGFzc3dvcmRQb2xpY3kucmVzZXRUb2tlblZhbGlkaXR5RHVyYXRpb24gIT09ICdudW1iZXInIHx8XG4gICAgICAgICAgcGFzc3dvcmRQb2xpY3kucmVzZXRUb2tlblZhbGlkaXR5RHVyYXRpb24gPD0gMClcbiAgICAgICkge1xuICAgICAgICB0aHJvdyAncGFzc3dvcmRQb2xpY3kucmVzZXRUb2tlblZhbGlkaXR5RHVyYXRpb24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcic7XG4gICAgICB9XG5cbiAgICAgIGlmIChwYXNzd29yZFBvbGljeS52YWxpZGF0b3JQYXR0ZXJuKSB7XG4gICAgICAgIGlmICh0eXBlb2YgcGFzc3dvcmRQb2xpY3kudmFsaWRhdG9yUGF0dGVybiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBwYXNzd29yZFBvbGljeS52YWxpZGF0b3JQYXR0ZXJuID0gbmV3IFJlZ0V4cChwYXNzd29yZFBvbGljeS52YWxpZGF0b3JQYXR0ZXJuKTtcbiAgICAgICAgfSBlbHNlIGlmICghKHBhc3N3b3JkUG9saWN5LnZhbGlkYXRvclBhdHRlcm4gaW5zdGFuY2VvZiBSZWdFeHApKSB7XG4gICAgICAgICAgdGhyb3cgJ3Bhc3N3b3JkUG9saWN5LnZhbGlkYXRvclBhdHRlcm4gbXVzdCBiZSBhIHJlZ2V4IHN0cmluZyBvciBSZWdFeHAgb2JqZWN0Lic7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBwYXNzd29yZFBvbGljeS52YWxpZGF0b3JDYWxsYmFjayAmJlxuICAgICAgICB0eXBlb2YgcGFzc3dvcmRQb2xpY3kudmFsaWRhdG9yQ2FsbGJhY2sgIT09ICdmdW5jdGlvbidcbiAgICAgICkge1xuICAgICAgICB0aHJvdyAncGFzc3dvcmRQb2xpY3kudmFsaWRhdG9yQ2FsbGJhY2sgbXVzdCBiZSBhIGZ1bmN0aW9uLic7XG4gICAgICB9XG5cbiAgICAgIGlmIChcbiAgICAgICAgcGFzc3dvcmRQb2xpY3kuZG9Ob3RBbGxvd1VzZXJuYW1lICYmXG4gICAgICAgIHR5cGVvZiBwYXNzd29yZFBvbGljeS5kb05vdEFsbG93VXNlcm5hbWUgIT09ICdib29sZWFuJ1xuICAgICAgKSB7XG4gICAgICAgIHRocm93ICdwYXNzd29yZFBvbGljeS5kb05vdEFsbG93VXNlcm5hbWUgbXVzdCBiZSBhIGJvb2xlYW4gdmFsdWUuJztcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBwYXNzd29yZFBvbGljeS5tYXhQYXNzd29yZEhpc3RvcnkgJiZcbiAgICAgICAgKCFOdW1iZXIuaXNJbnRlZ2VyKHBhc3N3b3JkUG9saWN5Lm1heFBhc3N3b3JkSGlzdG9yeSkgfHxcbiAgICAgICAgICBwYXNzd29yZFBvbGljeS5tYXhQYXNzd29yZEhpc3RvcnkgPD0gMCB8fFxuICAgICAgICAgIHBhc3N3b3JkUG9saWN5Lm1heFBhc3N3b3JkSGlzdG9yeSA+IDIwKVxuICAgICAgKSB7XG4gICAgICAgIHRocm93ICdwYXNzd29yZFBvbGljeS5tYXhQYXNzd29yZEhpc3RvcnkgbXVzdCBiZSBhbiBpbnRlZ2VyIHJhbmdpbmcgMCAtIDIwJztcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBwYXNzd29yZFBvbGljeS5yZXNldFRva2VuUmV1c2VJZlZhbGlkICYmXG4gICAgICAgIHR5cGVvZiBwYXNzd29yZFBvbGljeS5yZXNldFRva2VuUmV1c2VJZlZhbGlkICE9PSAnYm9vbGVhbidcbiAgICAgICkge1xuICAgICAgICB0aHJvdyAncmVzZXRUb2tlblJldXNlSWZWYWxpZCBtdXN0IGJlIGEgYm9vbGVhbiB2YWx1ZSc7XG4gICAgICB9XG4gICAgICBpZiAocGFzc3dvcmRQb2xpY3kucmVzZXRUb2tlblJldXNlSWZWYWxpZCAmJiAhcGFzc3dvcmRQb2xpY3kucmVzZXRUb2tlblZhbGlkaXR5RHVyYXRpb24pIHtcbiAgICAgICAgdGhyb3cgJ1lvdSBjYW5ub3QgdXNlIHJlc2V0VG9rZW5SZXVzZUlmVmFsaWQgd2l0aG91dCByZXNldFRva2VuVmFsaWRpdHlEdXJhdGlvbic7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gaWYgdGhlIHBhc3N3b3JkUG9saWN5LnZhbGlkYXRvclBhdHRlcm4gaXMgY29uZmlndXJlZCB0aGVuIHNldHVwIGEgY2FsbGJhY2sgdG8gcHJvY2VzcyB0aGUgcGF0dGVyblxuICBzdGF0aWMgc2V0dXBQYXNzd29yZFZhbGlkYXRvcihwYXNzd29yZFBvbGljeSkge1xuICAgIGlmIChwYXNzd29yZFBvbGljeSAmJiBwYXNzd29yZFBvbGljeS52YWxpZGF0b3JQYXR0ZXJuKSB7XG4gICAgICBwYXNzd29yZFBvbGljeS5wYXR0ZXJuVmFsaWRhdG9yID0gdmFsdWUgPT4ge1xuICAgICAgICByZXR1cm4gcGFzc3dvcmRQb2xpY3kudmFsaWRhdG9yUGF0dGVybi50ZXN0KHZhbHVlKTtcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHZhbGlkYXRlRW1haWxDb25maWd1cmF0aW9uKHtcbiAgICBlbWFpbEFkYXB0ZXIsXG4gICAgYXBwTmFtZSxcbiAgICBwdWJsaWNTZXJ2ZXJVUkwsXG4gICAgZW1haWxWZXJpZnlUb2tlblZhbGlkaXR5RHVyYXRpb24sXG4gICAgZW1haWxWZXJpZnlUb2tlblJldXNlSWZWYWxpZCxcbiAgfSkge1xuICAgIGlmICghZW1haWxBZGFwdGVyKSB7XG4gICAgICB0aHJvdyAnQW4gZW1haWxBZGFwdGVyIGlzIHJlcXVpcmVkIGZvciBlLW1haWwgdmVyaWZpY2F0aW9uIGFuZCBwYXNzd29yZCByZXNldHMuJztcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBhcHBOYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgJ0FuIGFwcCBuYW1lIGlzIHJlcXVpcmVkIGZvciBlLW1haWwgdmVyaWZpY2F0aW9uIGFuZCBwYXNzd29yZCByZXNldHMuJztcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBwdWJsaWNTZXJ2ZXJVUkwgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyAnQSBwdWJsaWMgc2VydmVyIHVybCBpcyByZXF1aXJlZCBmb3IgZS1tYWlsIHZlcmlmaWNhdGlvbiBhbmQgcGFzc3dvcmQgcmVzZXRzLic7XG4gICAgfVxuICAgIGlmIChlbWFpbFZlcmlmeVRva2VuVmFsaWRpdHlEdXJhdGlvbikge1xuICAgICAgaWYgKGlzTmFOKGVtYWlsVmVyaWZ5VG9rZW5WYWxpZGl0eUR1cmF0aW9uKSkge1xuICAgICAgICB0aHJvdyAnRW1haWwgdmVyaWZ5IHRva2VuIHZhbGlkaXR5IGR1cmF0aW9uIG11c3QgYmUgYSB2YWxpZCBudW1iZXIuJztcbiAgICAgIH0gZWxzZSBpZiAoZW1haWxWZXJpZnlUb2tlblZhbGlkaXR5RHVyYXRpb24gPD0gMCkge1xuICAgICAgICB0aHJvdyAnRW1haWwgdmVyaWZ5IHRva2VuIHZhbGlkaXR5IGR1cmF0aW9uIG11c3QgYmUgYSB2YWx1ZSBncmVhdGVyIHRoYW4gMC4nO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZW1haWxWZXJpZnlUb2tlblJldXNlSWZWYWxpZCAmJiB0eXBlb2YgZW1haWxWZXJpZnlUb2tlblJldXNlSWZWYWxpZCAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICB0aHJvdyAnZW1haWxWZXJpZnlUb2tlblJldXNlSWZWYWxpZCBtdXN0IGJlIGEgYm9vbGVhbiB2YWx1ZSc7XG4gICAgfVxuICAgIGlmIChlbWFpbFZlcmlmeVRva2VuUmV1c2VJZlZhbGlkICYmICFlbWFpbFZlcmlmeVRva2VuVmFsaWRpdHlEdXJhdGlvbikge1xuICAgICAgdGhyb3cgJ1lvdSBjYW5ub3QgdXNlIGVtYWlsVmVyaWZ5VG9rZW5SZXVzZUlmVmFsaWQgd2l0aG91dCBlbWFpbFZlcmlmeVRva2VuVmFsaWRpdHlEdXJhdGlvbic7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHZhbGlkYXRlRmlsZVVwbG9hZE9wdGlvbnMoZmlsZVVwbG9hZCkge1xuICAgIHRyeSB7XG4gICAgICBpZiAoZmlsZVVwbG9hZCA9PSBudWxsIHx8IHR5cGVvZiBmaWxlVXBsb2FkICE9PSAnb2JqZWN0JyB8fCBmaWxlVXBsb2FkIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgdGhyb3cgJ2ZpbGVVcGxvYWQgbXVzdCBiZSBhbiBvYmplY3QgdmFsdWUuJztcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZSBpbnN0YW5jZW9mIFJlZmVyZW5jZUVycm9yKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICAgIGlmIChmaWxlVXBsb2FkLmVuYWJsZUZvckFub255bW91c1VzZXIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZmlsZVVwbG9hZC5lbmFibGVGb3JBbm9ueW1vdXNVc2VyID0gRmlsZVVwbG9hZE9wdGlvbnMuZW5hYmxlRm9yQW5vbnltb3VzVXNlci5kZWZhdWx0O1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGZpbGVVcGxvYWQuZW5hYmxlRm9yQW5vbnltb3VzVXNlciAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICB0aHJvdyAnZmlsZVVwbG9hZC5lbmFibGVGb3JBbm9ueW1vdXNVc2VyIG11c3QgYmUgYSBib29sZWFuIHZhbHVlLic7XG4gICAgfVxuICAgIGlmIChmaWxlVXBsb2FkLmVuYWJsZUZvclB1YmxpYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBmaWxlVXBsb2FkLmVuYWJsZUZvclB1YmxpYyA9IEZpbGVVcGxvYWRPcHRpb25zLmVuYWJsZUZvclB1YmxpYy5kZWZhdWx0O1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGZpbGVVcGxvYWQuZW5hYmxlRm9yUHVibGljICE9PSAnYm9vbGVhbicpIHtcbiAgICAgIHRocm93ICdmaWxlVXBsb2FkLmVuYWJsZUZvclB1YmxpYyBtdXN0IGJlIGEgYm9vbGVhbiB2YWx1ZS4nO1xuICAgIH1cbiAgICBpZiAoZmlsZVVwbG9hZC5lbmFibGVGb3JBdXRoZW50aWNhdGVkVXNlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBmaWxlVXBsb2FkLmVuYWJsZUZvckF1dGhlbnRpY2F0ZWRVc2VyID0gRmlsZVVwbG9hZE9wdGlvbnMuZW5hYmxlRm9yQXV0aGVudGljYXRlZFVzZXIuZGVmYXVsdDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBmaWxlVXBsb2FkLmVuYWJsZUZvckF1dGhlbnRpY2F0ZWRVc2VyICE9PSAnYm9vbGVhbicpIHtcbiAgICAgIHRocm93ICdmaWxlVXBsb2FkLmVuYWJsZUZvckF1dGhlbnRpY2F0ZWRVc2VyIG11c3QgYmUgYSBib29sZWFuIHZhbHVlLic7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHZhbGlkYXRlTWFzdGVyS2V5SXBzKG1hc3RlcktleUlwcykge1xuICAgIGZvciAoY29uc3QgaXAgb2YgbWFzdGVyS2V5SXBzKSB7XG4gICAgICBpZiAoIW5ldC5pc0lQKGlwKSkge1xuICAgICAgICB0aHJvdyBgSW52YWxpZCBpcCBpbiBtYXN0ZXJLZXlJcHM6ICR7aXB9YDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZXQgbW91bnQoKSB7XG4gICAgdmFyIG1vdW50ID0gdGhpcy5fbW91bnQ7XG4gICAgaWYgKHRoaXMucHVibGljU2VydmVyVVJMKSB7XG4gICAgICBtb3VudCA9IHRoaXMucHVibGljU2VydmVyVVJMO1xuICAgIH1cbiAgICByZXR1cm4gbW91bnQ7XG4gIH1cblxuICBzZXQgbW91bnQobmV3VmFsdWUpIHtcbiAgICB0aGlzLl9tb3VudCA9IG5ld1ZhbHVlO1xuICB9XG5cbiAgc3RhdGljIHZhbGlkYXRlU2Vzc2lvbkNvbmZpZ3VyYXRpb24oc2Vzc2lvbkxlbmd0aCwgZXhwaXJlSW5hY3RpdmVTZXNzaW9ucykge1xuICAgIGlmIChleHBpcmVJbmFjdGl2ZVNlc3Npb25zKSB7XG4gICAgICBpZiAoaXNOYU4oc2Vzc2lvbkxlbmd0aCkpIHtcbiAgICAgICAgdGhyb3cgJ1Nlc3Npb24gbGVuZ3RoIG11c3QgYmUgYSB2YWxpZCBudW1iZXIuJztcbiAgICAgIH0gZWxzZSBpZiAoc2Vzc2lvbkxlbmd0aCA8PSAwKSB7XG4gICAgICAgIHRocm93ICdTZXNzaW9uIGxlbmd0aCBtdXN0IGJlIGEgdmFsdWUgZ3JlYXRlciB0aGFuIDAuJztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBzdGF0aWMgdmFsaWRhdGVNYXhMaW1pdChtYXhMaW1pdCkge1xuICAgIGlmIChtYXhMaW1pdCA8PSAwKSB7XG4gICAgICB0aHJvdyAnTWF4IGxpbWl0IG11c3QgYmUgYSB2YWx1ZSBncmVhdGVyIHRoYW4gMC4nO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyB2YWxpZGF0ZUFsbG93SGVhZGVycyhhbGxvd0hlYWRlcnMpIHtcbiAgICBpZiAoIVtudWxsLCB1bmRlZmluZWRdLmluY2x1ZGVzKGFsbG93SGVhZGVycykpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGFsbG93SGVhZGVycykpIHtcbiAgICAgICAgYWxsb3dIZWFkZXJzLmZvckVhY2goaGVhZGVyID0+IHtcbiAgICAgICAgICBpZiAodHlwZW9mIGhlYWRlciAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHRocm93ICdBbGxvdyBoZWFkZXJzIG11c3Qgb25seSBjb250YWluIHN0cmluZ3MnO1xuICAgICAgICAgIH0gZWxzZSBpZiAoIWhlYWRlci50cmltKCkubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aHJvdyAnQWxsb3cgaGVhZGVycyBtdXN0IG5vdCBjb250YWluIGVtcHR5IHN0cmluZ3MnO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyAnQWxsb3cgaGVhZGVycyBtdXN0IGJlIGFuIGFycmF5JztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZW5lcmF0ZUVtYWlsVmVyaWZ5VG9rZW5FeHBpcmVzQXQoKSB7XG4gICAgaWYgKCF0aGlzLnZlcmlmeVVzZXJFbWFpbHMgfHwgIXRoaXMuZW1haWxWZXJpZnlUb2tlblZhbGlkaXR5RHVyYXRpb24pIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHZhciBub3cgPSBuZXcgRGF0ZSgpO1xuICAgIHJldHVybiBuZXcgRGF0ZShub3cuZ2V0VGltZSgpICsgdGhpcy5lbWFpbFZlcmlmeVRva2VuVmFsaWRpdHlEdXJhdGlvbiAqIDEwMDApO1xuICB9XG5cbiAgZ2VuZXJhdGVQYXNzd29yZFJlc2V0VG9rZW5FeHBpcmVzQXQoKSB7XG4gICAgaWYgKCF0aGlzLnBhc3N3b3JkUG9saWN5IHx8ICF0aGlzLnBhc3N3b3JkUG9saWN5LnJlc2V0VG9rZW5WYWxpZGl0eUR1cmF0aW9uKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xuICAgIHJldHVybiBuZXcgRGF0ZShub3cuZ2V0VGltZSgpICsgdGhpcy5wYXNzd29yZFBvbGljeS5yZXNldFRva2VuVmFsaWRpdHlEdXJhdGlvbiAqIDEwMDApO1xuICB9XG5cbiAgZ2VuZXJhdGVTZXNzaW9uRXhwaXJlc0F0KCkge1xuICAgIGlmICghdGhpcy5leHBpcmVJbmFjdGl2ZVNlc3Npb25zKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICB2YXIgbm93ID0gbmV3IERhdGUoKTtcbiAgICByZXR1cm4gbmV3IERhdGUobm93LmdldFRpbWUoKSArIHRoaXMuc2Vzc2lvbkxlbmd0aCAqIDEwMDApO1xuICB9XG5cbiAgZ2V0IGludmFsaWRMaW5rVVJMKCkge1xuICAgIHJldHVybiB0aGlzLmN1c3RvbVBhZ2VzLmludmFsaWRMaW5rIHx8IGAke3RoaXMucHVibGljU2VydmVyVVJMfS9hcHBzL2ludmFsaWRfbGluay5odG1sYDtcbiAgfVxuXG4gIGdldCBpbnZhbGlkVmVyaWZpY2F0aW9uTGlua1VSTCgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5jdXN0b21QYWdlcy5pbnZhbGlkVmVyaWZpY2F0aW9uTGluayB8fFxuICAgICAgYCR7dGhpcy5wdWJsaWNTZXJ2ZXJVUkx9L2FwcHMvaW52YWxpZF92ZXJpZmljYXRpb25fbGluay5odG1sYFxuICAgICk7XG4gIH1cblxuICBnZXQgbGlua1NlbmRTdWNjZXNzVVJMKCkge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLmN1c3RvbVBhZ2VzLmxpbmtTZW5kU3VjY2VzcyB8fCBgJHt0aGlzLnB1YmxpY1NlcnZlclVSTH0vYXBwcy9saW5rX3NlbmRfc3VjY2Vzcy5odG1sYFxuICAgICk7XG4gIH1cblxuICBnZXQgbGlua1NlbmRGYWlsVVJMKCkge1xuICAgIHJldHVybiB0aGlzLmN1c3RvbVBhZ2VzLmxpbmtTZW5kRmFpbCB8fCBgJHt0aGlzLnB1YmxpY1NlcnZlclVSTH0vYXBwcy9saW5rX3NlbmRfZmFpbC5odG1sYDtcbiAgfVxuXG4gIGdldCB2ZXJpZnlFbWFpbFN1Y2Nlc3NVUkwoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuY3VzdG9tUGFnZXMudmVyaWZ5RW1haWxTdWNjZXNzIHx8XG4gICAgICBgJHt0aGlzLnB1YmxpY1NlcnZlclVSTH0vYXBwcy92ZXJpZnlfZW1haWxfc3VjY2Vzcy5odG1sYFxuICAgICk7XG4gIH1cblxuICBnZXQgY2hvb3NlUGFzc3dvcmRVUkwoKSB7XG4gICAgcmV0dXJuIHRoaXMuY3VzdG9tUGFnZXMuY2hvb3NlUGFzc3dvcmQgfHwgYCR7dGhpcy5wdWJsaWNTZXJ2ZXJVUkx9L2FwcHMvY2hvb3NlX3Bhc3N3b3JkYDtcbiAgfVxuXG4gIGdldCByZXF1ZXN0UmVzZXRQYXNzd29yZFVSTCgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5wdWJsaWNTZXJ2ZXJVUkx9L2FwcHMvJHt0aGlzLmFwcGxpY2F0aW9uSWR9L3JlcXVlc3RfcGFzc3dvcmRfcmVzZXRgO1xuICB9XG5cbiAgZ2V0IHBhc3N3b3JkUmVzZXRTdWNjZXNzVVJMKCkge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLmN1c3RvbVBhZ2VzLnBhc3N3b3JkUmVzZXRTdWNjZXNzIHx8XG4gICAgICBgJHt0aGlzLnB1YmxpY1NlcnZlclVSTH0vYXBwcy9wYXNzd29yZF9yZXNldF9zdWNjZXNzLmh0bWxgXG4gICAgKTtcbiAgfVxuXG4gIGdldCBwYXJzZUZyYW1lVVJMKCkge1xuICAgIHJldHVybiB0aGlzLmN1c3RvbVBhZ2VzLnBhcnNlRnJhbWVVUkw7XG4gIH1cblxuICBnZXQgdmVyaWZ5RW1haWxVUkwoKSB7XG4gICAgcmV0dXJuIGAke3RoaXMucHVibGljU2VydmVyVVJMfS9hcHBzLyR7dGhpcy5hcHBsaWNhdGlvbklkfS92ZXJpZnlfZW1haWxgO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IENvbmZpZztcbm1vZHVsZS5leHBvcnRzID0gQ29uZmlnO1xuIl19