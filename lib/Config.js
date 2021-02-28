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

    if (pages.localizationJsonPath === undefined) {
      pages.localizationJsonPath = _Definitions.PagesOptions.localizationJsonPath.default;
    } else if (!(0, _lodash.isString)(pages.localizationJsonPath)) {
      throw 'Parse Server option pages.localizationJsonPath must be a string.';
    }

    if (pages.localizationFallbackLocale === undefined) {
      pages.localizationFallbackLocale = _Definitions.PagesOptions.localizationFallbackLocale.default;
    } else if (!(0, _lodash.isString)(pages.localizationFallbackLocale)) {
      throw 'Parse Server option pages.localizationFallbackLocale must be a string.';
    }

    if (pages.placeholders === undefined) {
      pages.placeholders = _Definitions.PagesOptions.placeholders.default;
    } else if (Object.prototype.toString.call(pages.placeholders) !== '[object Object]' && typeof pages.placeholders !== 'function') {
      throw 'Parse Server option pages.placeholders must be an object or a function.';
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

    if (pages.customRoutes === undefined) {
      pages.customRoutes = _Definitions.PagesOptions.customRoutes.default;
    } else if (!(pages.customRoutes instanceof Array)) {
      throw 'Parse Server option pages.customRoutes must be an array.';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9Db25maWcuanMiXSwibmFtZXMiOlsicmVtb3ZlVHJhaWxpbmdTbGFzaCIsInN0ciIsImVuZHNXaXRoIiwic3Vic3RyIiwibGVuZ3RoIiwiQ29uZmlnIiwiZ2V0IiwiYXBwbGljYXRpb25JZCIsIm1vdW50IiwiY2FjaGVJbmZvIiwiQXBwQ2FjaGUiLCJjb25maWciLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsImtleSIsInNjaGVtYUNhY2hlIiwiU2NoZW1hQ2FjaGUiLCJjYWNoZUNvbnRyb2xsZXIiLCJzY2hlbWFDYWNoZVRUTCIsImVuYWJsZVNpbmdsZVNjaGVtYUNhY2hlIiwiZGF0YWJhc2UiLCJEYXRhYmFzZUNvbnRyb2xsZXIiLCJkYXRhYmFzZUNvbnRyb2xsZXIiLCJhZGFwdGVyIiwiZ2VuZXJhdGVTZXNzaW9uRXhwaXJlc0F0IiwiYmluZCIsImdlbmVyYXRlRW1haWxWZXJpZnlUb2tlbkV4cGlyZXNBdCIsInB1dCIsInNlcnZlckNvbmZpZ3VyYXRpb24iLCJ2YWxpZGF0ZSIsImFwcElkIiwic2V0dXBQYXNzd29yZFZhbGlkYXRvciIsInBhc3N3b3JkUG9saWN5IiwidmVyaWZ5VXNlckVtYWlscyIsInVzZXJDb250cm9sbGVyIiwiYXBwTmFtZSIsInB1YmxpY1NlcnZlclVSTCIsInJldm9rZVNlc3Npb25PblBhc3N3b3JkUmVzZXQiLCJleHBpcmVJbmFjdGl2ZVNlc3Npb25zIiwic2Vzc2lvbkxlbmd0aCIsIm1heExpbWl0IiwiZW1haWxWZXJpZnlUb2tlblZhbGlkaXR5RHVyYXRpb24iLCJhY2NvdW50TG9ja291dCIsIm1hc3RlcktleUlwcyIsIm1hc3RlcktleSIsInJlYWRPbmx5TWFzdGVyS2V5IiwiYWxsb3dIZWFkZXJzIiwiaWRlbXBvdGVuY3lPcHRpb25zIiwiZW1haWxWZXJpZnlUb2tlblJldXNlSWZWYWxpZCIsImZpbGVVcGxvYWQiLCJwYWdlcyIsIkVycm9yIiwiZW1haWxBZGFwdGVyIiwidmFsaWRhdGVFbWFpbENvbmZpZ3VyYXRpb24iLCJ2YWxpZGF0ZUFjY291bnRMb2Nrb3V0UG9saWN5IiwidmFsaWRhdGVQYXNzd29yZFBvbGljeSIsInZhbGlkYXRlRmlsZVVwbG9hZE9wdGlvbnMiLCJzdGFydHNXaXRoIiwidmFsaWRhdGVTZXNzaW9uQ29uZmlndXJhdGlvbiIsInZhbGlkYXRlTWFzdGVyS2V5SXBzIiwidmFsaWRhdGVNYXhMaW1pdCIsInZhbGlkYXRlQWxsb3dIZWFkZXJzIiwidmFsaWRhdGVJZGVtcG90ZW5jeU9wdGlvbnMiLCJ2YWxpZGF0ZVBhZ2VzT3B0aW9ucyIsInByb3RvdHlwZSIsInRvU3RyaW5nIiwiY2FsbCIsImVuYWJsZVJvdXRlciIsInVuZGVmaW5lZCIsIlBhZ2VzT3B0aW9ucyIsImRlZmF1bHQiLCJlbmFibGVMb2NhbGl6YXRpb24iLCJsb2NhbGl6YXRpb25Kc29uUGF0aCIsImxvY2FsaXphdGlvbkZhbGxiYWNrTG9jYWxlIiwicGxhY2Vob2xkZXJzIiwiZm9yY2VSZWRpcmVjdCIsInBhZ2VzUGF0aCIsInBhZ2VzRW5kcG9pbnQiLCJjdXN0b21VcmxzIiwiY3VzdG9tUm91dGVzIiwiQXJyYXkiLCJ0dGwiLCJJZGVtcG90ZW5jeU9wdGlvbnMiLCJpc05hTiIsInBhdGhzIiwiZHVyYXRpb24iLCJOdW1iZXIiLCJpc0ludGVnZXIiLCJ0aHJlc2hvbGQiLCJ1bmxvY2tPblBhc3N3b3JkUmVzZXQiLCJBY2NvdW50TG9ja291dE9wdGlvbnMiLCJtYXhQYXNzd29yZEFnZSIsInJlc2V0VG9rZW5WYWxpZGl0eUR1cmF0aW9uIiwidmFsaWRhdG9yUGF0dGVybiIsIlJlZ0V4cCIsInZhbGlkYXRvckNhbGxiYWNrIiwiZG9Ob3RBbGxvd1VzZXJuYW1lIiwibWF4UGFzc3dvcmRIaXN0b3J5IiwicmVzZXRUb2tlblJldXNlSWZWYWxpZCIsInBhdHRlcm5WYWxpZGF0b3IiLCJ2YWx1ZSIsInRlc3QiLCJlIiwiUmVmZXJlbmNlRXJyb3IiLCJlbmFibGVGb3JBbm9ueW1vdXNVc2VyIiwiRmlsZVVwbG9hZE9wdGlvbnMiLCJlbmFibGVGb3JQdWJsaWMiLCJlbmFibGVGb3JBdXRoZW50aWNhdGVkVXNlciIsImlwIiwibmV0IiwiaXNJUCIsIl9tb3VudCIsIm5ld1ZhbHVlIiwiaW5jbHVkZXMiLCJpc0FycmF5IiwiaGVhZGVyIiwidHJpbSIsIm5vdyIsIkRhdGUiLCJnZXRUaW1lIiwiZ2VuZXJhdGVQYXNzd29yZFJlc2V0VG9rZW5FeHBpcmVzQXQiLCJpbnZhbGlkTGlua1VSTCIsImN1c3RvbVBhZ2VzIiwiaW52YWxpZExpbmsiLCJpbnZhbGlkVmVyaWZpY2F0aW9uTGlua1VSTCIsImludmFsaWRWZXJpZmljYXRpb25MaW5rIiwibGlua1NlbmRTdWNjZXNzVVJMIiwibGlua1NlbmRTdWNjZXNzIiwibGlua1NlbmRGYWlsVVJMIiwibGlua1NlbmRGYWlsIiwidmVyaWZ5RW1haWxTdWNjZXNzVVJMIiwidmVyaWZ5RW1haWxTdWNjZXNzIiwiY2hvb3NlUGFzc3dvcmRVUkwiLCJjaG9vc2VQYXNzd29yZCIsInJlcXVlc3RSZXNldFBhc3N3b3JkVVJMIiwicGFzc3dvcmRSZXNldFN1Y2Nlc3NVUkwiLCJwYXNzd29yZFJlc2V0U3VjY2VzcyIsInBhcnNlRnJhbWVVUkwiLCJ2ZXJpZnlFbWFpbFVSTCIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFJQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFNQTs7OztBQWRBO0FBQ0E7QUFDQTtBQWNBLFNBQVNBLG1CQUFULENBQTZCQyxHQUE3QixFQUFrQztBQUNoQyxNQUFJLENBQUNBLEdBQUwsRUFBVTtBQUNSLFdBQU9BLEdBQVA7QUFDRDs7QUFDRCxNQUFJQSxHQUFHLENBQUNDLFFBQUosQ0FBYSxHQUFiLENBQUosRUFBdUI7QUFDckJELElBQUFBLEdBQUcsR0FBR0EsR0FBRyxDQUFDRSxNQUFKLENBQVcsQ0FBWCxFQUFjRixHQUFHLENBQUNHLE1BQUosR0FBYSxDQUEzQixDQUFOO0FBQ0Q7O0FBQ0QsU0FBT0gsR0FBUDtBQUNEOztBQUVNLE1BQU1JLE1B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QWY0RixlQUFlLEdBQUc7QUFDcEIsV0FBTyxLQUFLTixXQUFMLENBQWlCTyxZQUFqQixJQUFrQyxHQUFFLEtBQUs3RixlQUFnQiwyQkFBaEU7QUFDRDs7QUFFd0IsTUFBckI4RixxQkFBcUIsR0FBRztBQUMxQixXQUNFLEtBQUtSLFdBQUwsQ0FBaUJTLGtCQUFqQixJQUNDLEdBQUUsS0FBSy9GLGVBQWdCLGlDQUYxQjtBQUlEOztBQUVvQixNQUFqQmdHLGlCQUFpQixHQUFHO0FBQ3RCLFdBQU8sS0FBS1YsV0FBTCxDQUFpQlcsY0FBakIsSUFBb0MsR0FBRSxLQUFLakcsZUFBZ0IsdUJBQWxFO0FBQ0Q7O0FBRTBCLE1BQXZCa0csdUJBQXVCLEdBQUc7QUFDNUIsV0FBUSxHQUFFLEtBQUtsRyxlQUFnQixTQUFRLEtBQUs5QixhQUFjLHlCQUExRDtBQUNEOztBQUUwQixNQUF2QmlJLHVCQUF1QixHQUFHO0FBQzVCLFdBQ0UsS0FBS2IsV0FBTCxDQUFpQmMsb0JBQWpCLElBQ0MsR0FBRSxLQUFLcEcsZUFBZ0IsbUNBRjFCO0FBSUQ7O0FBRWdCLE1BQWJxRyxhQUFhLEdBQUc7QUFDbEIsV0FBTyxLQUFLZixXQUFMLENBQWlCZSxhQUF4QjtBQUNEOztBQUVpQixNQUFkQyxjQUFjLEdBQUc7QUFDbkIsV0FBUSxHQUFFLEtBQUt0RyxlQUFnQixTQUFRLEtBQUs5QixhQUFjLGVBQTFEO0FBQ0Q7O0FBaGNpQjs7O2VBbWNMRixNOztBQUNmdUksTUFBTSxDQUFDQyxPQUFQLEdBQWlCeEksTUFBakIiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBBIENvbmZpZyBvYmplY3QgcHJvdmlkZXMgaW5mb3JtYXRpb24gYWJvdXQgaG93IGEgc3BlY2lmaWMgYXBwIGlzXG4vLyBjb25maWd1cmVkLlxuLy8gbW91bnQgaXMgdGhlIFVSTCBmb3IgdGhlIHJvb3Qgb2YgdGhlIEFQSTsgaW5jbHVkZXMgaHR0cCwgZG9tYWluLCBldGMuXG5cbmltcG9ydCBBcHBDYWNoZSBmcm9tICcuL2NhY2hlJztcbmltcG9ydCBTY2hlbWFDYWNoZSBmcm9tICcuL0NvbnRyb2xsZXJzL1NjaGVtYUNhY2hlJztcbmltcG9ydCBEYXRhYmFzZUNvbnRyb2xsZXIgZnJvbSAnLi9Db250cm9sbGVycy9EYXRhYmFzZUNvbnRyb2xsZXInO1xuaW1wb3J0IG5ldCBmcm9tICduZXQnO1xuaW1wb3J0IHtcbiAgSWRlbXBvdGVuY3lPcHRpb25zLFxuICBGaWxlVXBsb2FkT3B0aW9ucyxcbiAgQWNjb3VudExvY2tvdXRPcHRpb25zLFxuICBQYWdlc09wdGlvbnMsXG59IGZyb20gJy4vT3B0aW9ucy9EZWZpbml0aW9ucyc7XG5pbXBvcnQgeyBpc0Jvb2xlYW4sIGlzU3RyaW5nIH0gZnJvbSAnbG9kYXNoJztcblxuZnVuY3Rpb24gcmVtb3ZlVHJhaWxpbmdTbGFzaChzdHIpIHtcbiAgaWYgKCFzdHIpIHtcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gIGlmIChzdHIuZW5kc1dpdGgoJy8nKSkge1xuICAgIHN0ciA9IHN0ci5zdWJzdHIoMCwgc3RyLmxlbmd0aCAtIDEpO1xuICB9XG4gIHJldHVybiBzdHI7XG59XG5cbmV4cG9ydCBjbGFzcyBDb25maWcge1xuICBzdGF0aWMgZ2V0KGFwcGxpY2F0aW9uSWQ6IHN0cmluZywgbW91bnQ6IHN0cmluZykge1xuICAgIGNvbnN0IGNhY2hlSW5mbyA9IEFwcENhY2hlLmdldChhcHBsaWNhdGlvbklkKTtcbiAgICBpZiAoIWNhY2hlSW5mbykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBjb25maWcgPSBuZXcgQ29uZmlnKCk7XG4gICAgY29uZmlnLmFwcGxpY2F0aW9uSWQgPSBhcHBsaWNhdGlvbklkO1xuICAgIE9iamVjdC5rZXlzKGNhY2hlSW5mbykuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgaWYgKGtleSA9PSAnZGF0YWJhc2VDb250cm9sbGVyJykge1xuICAgICAgICBjb25zdCBzY2hlbWFDYWNoZSA9IG5ldyBTY2hlbWFDYWNoZShcbiAgICAgICAgICBjYWNoZUluZm8uY2FjaGVDb250cm9sbGVyLFxuICAgICAgICAgIGNhY2hlSW5mby5zY2hlbWFDYWNoZVRUTCxcbiAgICAgICAgICBjYWNoZUluZm8uZW5hYmxlU2luZ2xlU2NoZW1hQ2FjaGVcbiAgICAgICAgKTtcbiAgICAgICAgY29uZmlnLmRhdGFiYXNlID0gbmV3IERhdGFiYXNlQ29udHJvbGxlcihjYWNoZUluZm8uZGF0YWJhc2VDb250cm9sbGVyLmFkYXB0ZXIsIHNjaGVtYUNhY2hlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbmZpZ1trZXldID0gY2FjaGVJbmZvW2tleV07XG4gICAgICB9XG4gICAgfSk7XG4gICAgY29uZmlnLm1vdW50ID0gcmVtb3ZlVHJhaWxpbmdTbGFzaChtb3VudCk7XG4gICAgY29uZmlnLmdlbmVyYXRlU2Vzc2lvbkV4cGlyZXNBdCA9IGNvbmZpZy5nZW5lcmF0ZVNlc3Npb25FeHBpcmVzQXQuYmluZChjb25maWcpO1xuICAgIGNvbmZpZy5nZW5lcmF0ZUVtYWlsVmVyaWZ5VG9rZW5FeHBpcmVzQXQgPSBjb25maWcuZ2VuZXJhdGVFbWFpbFZlcmlmeVRva2VuRXhwaXJlc0F0LmJpbmQoXG4gICAgICBjb25maWdcbiAgICApO1xuICAgIHJldHVybiBjb25maWc7XG4gIH1cblxuICBzdGF0aWMgcHV0KHNlcnZlckNvbmZpZ3VyYXRpb24pIHtcbiAgICBDb25maWcudmFsaWRhdGUoc2VydmVyQ29uZmlndXJhdGlvbik7XG4gICAgQXBwQ2FjaGUucHV0KHNlcnZlckNvbmZpZ3VyYXRpb24uYXBwSWQsIHNlcnZlckNvbmZpZ3VyYXRpb24pO1xuICAgIENvbmZpZy5zZXR1cFBhc3N3b3JkVmFsaWRhdG9yKHNlcnZlckNvbmZpZ3VyYXRpb24ucGFzc3dvcmRQb2xpY3kpO1xuICAgIHJldHVybiBzZXJ2ZXJDb25maWd1cmF0aW9uO1xuICB9XG5cbiAgc3RhdGljIHZhbGlkYXRlKHtcbiAgICB2ZXJpZnlVc2VyRW1haWxzLFxuICAgIHVzZXJDb250cm9sbGVyLFxuICAgIGFwcE5hbWUsXG4gICAgcHVibGljU2VydmVyVVJMLFxuICAgIHJldm9rZVNlc3Npb25PblBhc3N3b3JkUmVzZXQsXG4gICAgZXhwaXJlSW5hY3RpdmVTZXNzaW9ucyxcbiAgICBzZXNzaW9uTGVuZ3RoLFxuICAgIG1heExpbWl0LFxuICAgIGVtYWlsVmVyaWZ5VG9rZW5WYWxpZGl0eUR1cmF0aW9uLFxuICAgIGFjY291bnRMb2Nrb3V0LFxuICAgIHBhc3N3b3JkUG9saWN5LFxuICAgIG1hc3RlcktleUlwcyxcbiAgICBtYXN0ZXJLZXksXG4gICAgcmVhZE9ubHlNYXN0ZXJLZXksXG4gICAgYWxsb3dIZWFkZXJzLFxuICAgIGlkZW1wb3RlbmN5T3B0aW9ucyxcbiAgICBlbWFpbFZlcmlmeVRva2VuUmV1c2VJZlZhbGlkLFxuICAgIGZpbGVVcGxvYWQsXG4gICAgcGFnZXMsXG4gIH0pIHtcbiAgICBpZiAobWFzdGVyS2V5ID09PSByZWFkT25seU1hc3RlcktleSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdtYXN0ZXJLZXkgYW5kIHJlYWRPbmx5TWFzdGVyS2V5IHNob3VsZCBiZSBkaWZmZXJlbnQnKTtcbiAgICB9XG5cbiAgICBjb25zdCBlbWFpbEFkYXB0ZXIgPSB1c2VyQ29udHJvbGxlci5hZGFwdGVyO1xuICAgIGlmICh2ZXJpZnlVc2VyRW1haWxzKSB7XG4gICAgICB0aGlzLnZhbGlkYXRlRW1haWxDb25maWd1cmF0aW9uKHtcbiAgICAgICAgZW1haWxBZGFwdGVyLFxuICAgICAgICBhcHBOYW1lLFxuICAgICAgICBwdWJsaWNTZXJ2ZXJVUkwsXG4gICAgICAgIGVtYWlsVmVyaWZ5VG9rZW5WYWxpZGl0eUR1cmF0aW9uLFxuICAgICAgICBlbWFpbFZlcmlmeVRva2VuUmV1c2VJZlZhbGlkLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy52YWxpZGF0ZUFjY291bnRMb2Nrb3V0UG9saWN5KGFjY291bnRMb2Nrb3V0KTtcbiAgICB0aGlzLnZhbGlkYXRlUGFzc3dvcmRQb2xpY3kocGFzc3dvcmRQb2xpY3kpO1xuICAgIHRoaXMudmFsaWRhdGVGaWxlVXBsb2FkT3B0aW9ucyhmaWxlVXBsb2FkKTtcblxuICAgIGlmICh0eXBlb2YgcmV2b2tlU2Vzc2lvbk9uUGFzc3dvcmRSZXNldCAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICB0aHJvdyAncmV2b2tlU2Vzc2lvbk9uUGFzc3dvcmRSZXNldCBtdXN0IGJlIGEgYm9vbGVhbiB2YWx1ZSc7XG4gICAgfVxuXG4gICAgaWYgKHB1YmxpY1NlcnZlclVSTCkge1xuICAgICAgaWYgKCFwdWJsaWNTZXJ2ZXJVUkwuc3RhcnRzV2l0aCgnaHR0cDovLycpICYmICFwdWJsaWNTZXJ2ZXJVUkwuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSkge1xuICAgICAgICB0aHJvdyAncHVibGljU2VydmVyVVJMIHNob3VsZCBiZSBhIHZhbGlkIEhUVFBTIFVSTCBzdGFydGluZyB3aXRoIGh0dHBzOi8vJztcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy52YWxpZGF0ZVNlc3Npb25Db25maWd1cmF0aW9uKHNlc3Npb25MZW5ndGgsIGV4cGlyZUluYWN0aXZlU2Vzc2lvbnMpO1xuICAgIHRoaXMudmFsaWRhdGVNYXN0ZXJLZXlJcHMobWFzdGVyS2V5SXBzKTtcbiAgICB0aGlzLnZhbGlkYXRlTWF4TGltaXQobWF4TGltaXQpO1xuICAgIHRoaXMudmFsaWRhdGVBbGxvd0hlYWRlcnMoYWxsb3dIZWFkZXJzKTtcbiAgICB0aGlzLnZhbGlkYXRlSWRlbXBvdGVuY3lPcHRpb25zKGlkZW1wb3RlbmN5T3B0aW9ucyk7XG4gICAgdGhpcy52YWxpZGF0ZVBhZ2VzT3B0aW9ucyhwYWdlcyk7XG4gIH1cblxuICBzdGF0aWMgdmFsaWRhdGVQYWdlc09wdGlvbnMocGFnZXMpIHtcbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHBhZ2VzKSAhPT0gJ1tvYmplY3QgT2JqZWN0XScpIHtcbiAgICAgIHRocm93ICdQYXJzZSBTZXJ2ZXIgb3B0aW9uIHBhZ2VzIG11c3QgYmUgYW4gb2JqZWN0Lic7XG4gICAgfVxuICAgIGlmIChwYWdlcy5lbmFibGVSb3V0ZXIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcGFnZXMuZW5hYmxlUm91dGVyID0gUGFnZXNPcHRpb25zLmVuYWJsZVJvdXRlci5kZWZhdWx0O1xuICAgIH0gZWxzZSBpZiAoIWlzQm9vbGVhbihwYWdlcy5lbmFibGVSb3V0ZXIpKSB7XG4gICAgICB0aHJvdyAnUGFyc2UgU2VydmVyIG9wdGlvbiBwYWdlcy5lbmFibGVSb3V0ZXIgbXVzdCBiZSBhIGJvb2xlYW4uJztcbiAgICB9XG4gICAgaWYgKHBhZ2VzLmVuYWJsZUxvY2FsaXphdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBwYWdlcy5lbmFibGVMb2NhbGl6YXRpb24gPSBQYWdlc09wdGlvbnMuZW5hYmxlTG9jYWxpemF0aW9uLmRlZmF1bHQ7XG4gICAgfSBlbHNlIGlmICghaXNCb29sZWFuKHBhZ2VzLmVuYWJsZUxvY2FsaXphdGlvbikpIHtcbiAgICAgIHRocm93ICdQYXJzZSBTZXJ2ZXIgb3B0aW9uIHBhZ2VzLmVuYWJsZUxvY2FsaXphdGlvbiBtdXN0IGJlIGEgYm9vbGVhbi4nO1xuICAgIH1cbiAgICBpZiAocGFnZXMubG9jYWxpemF0aW9uSnNvblBhdGggPT09IHVuZGVmaW5lZCkge1xuICAgICAgcGFnZXMubG9jYWxpemF0aW9uSnNvblBhdGggPSBQYWdlc09wdGlvbnMubG9jYWxpemF0aW9uSnNvblBhdGguZGVmYXVsdDtcbiAgICB9IGVsc2UgaWYgKCFpc1N0cmluZyhwYWdlcy5sb2NhbGl6YXRpb25Kc29uUGF0aCkpIHtcbiAgICAgIHRocm93ICdQYXJzZSBTZXJ2ZXIgb3B0aW9uIHBhZ2VzLmxvY2FsaXphdGlvbkpzb25QYXRoIG11c3QgYmUgYSBzdHJpbmcuJztcbiAgICB9XG4gICAgaWYgKHBhZ2VzLmxvY2FsaXphdGlvbkZhbGxiYWNrTG9jYWxlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhZ2VzLmxvY2FsaXphdGlvbkZhbGxiYWNrTG9jYWxlID0gUGFnZXNPcHRpb25zLmxvY2FsaXphdGlvbkZhbGxiYWNrTG9jYWxlLmRlZmF1bHQ7XG4gICAgfSBlbHNlIGlmICghaXNTdHJpbmcocGFnZXMubG9jYWxpemF0aW9uRmFsbGJhY2tMb2NhbGUpKSB7XG4gICAgICB0aHJvdyAnUGFyc2UgU2VydmVyIG9wdGlvbiBwYWdlcy5sb2NhbGl6YXRpb25GYWxsYmFja0xvY2FsZSBtdXN0IGJlIGEgc3RyaW5nLic7XG4gICAgfVxuICAgIGlmIChwYWdlcy5wbGFjZWhvbGRlcnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcGFnZXMucGxhY2Vob2xkZXJzID0gUGFnZXNPcHRpb25zLnBsYWNlaG9sZGVycy5kZWZhdWx0O1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwocGFnZXMucGxhY2Vob2xkZXJzKSAhPT0gJ1tvYmplY3QgT2JqZWN0XScgJiZcbiAgICAgIHR5cGVvZiBwYWdlcy5wbGFjZWhvbGRlcnMgIT09ICdmdW5jdGlvbidcbiAgICApIHtcbiAgICAgIHRocm93ICdQYXJzZSBTZXJ2ZXIgb3B0aW9uIHBhZ2VzLnBsYWNlaG9sZGVycyBtdXN0IGJlIGFuIG9iamVjdCBvciBhIGZ1bmN0aW9uLic7XG4gICAgfVxuICAgIGlmIChwYWdlcy5mb3JjZVJlZGlyZWN0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhZ2VzLmZvcmNlUmVkaXJlY3QgPSBQYWdlc09wdGlvbnMuZm9yY2VSZWRpcmVjdC5kZWZhdWx0O1xuICAgIH0gZWxzZSBpZiAoIWlzQm9vbGVhbihwYWdlcy5mb3JjZVJlZGlyZWN0KSkge1xuICAgICAgdGhyb3cgJ1BhcnNlIFNlcnZlciBvcHRpb24gcGFnZXMuZm9yY2VSZWRpcmVjdCBtdXN0IGJlIGEgYm9vbGVhbi4nO1xuICAgIH1cbiAgICBpZiAocGFnZXMucGFnZXNQYXRoID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhZ2VzLnBhZ2VzUGF0aCA9IFBhZ2VzT3B0aW9ucy5wYWdlc1BhdGguZGVmYXVsdDtcbiAgICB9IGVsc2UgaWYgKCFpc1N0cmluZyhwYWdlcy5wYWdlc1BhdGgpKSB7XG4gICAgICB0aHJvdyAnUGFyc2UgU2VydmVyIG9wdGlvbiBwYWdlcy5wYWdlc1BhdGggbXVzdCBiZSBhIHN0cmluZy4nO1xuICAgIH1cbiAgICBpZiAocGFnZXMucGFnZXNFbmRwb2ludCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBwYWdlcy5wYWdlc0VuZHBvaW50ID0gUGFnZXNPcHRpb25zLnBhZ2VzRW5kcG9pbnQuZGVmYXVsdDtcbiAgICB9IGVsc2UgaWYgKCFpc1N0cmluZyhwYWdlcy5wYWdlc0VuZHBvaW50KSkge1xuICAgICAgdGhyb3cgJ1BhcnNlIFNlcnZlciBvcHRpb24gcGFnZXMucGFnZXNFbmRwb2ludCBtdXN0IGJlIGEgc3RyaW5nLic7XG4gICAgfVxuICAgIGlmIChwYWdlcy5jdXN0b21VcmxzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhZ2VzLmN1c3RvbVVybHMgPSBQYWdlc09wdGlvbnMuY3VzdG9tVXJscy5kZWZhdWx0O1xuICAgIH0gZWxzZSBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHBhZ2VzLmN1c3RvbVVybHMpICE9PSAnW29iamVjdCBPYmplY3RdJykge1xuICAgICAgdGhyb3cgJ1BhcnNlIFNlcnZlciBvcHRpb24gcGFnZXMuY3VzdG9tVXJscyBtdXN0IGJlIGFuIG9iamVjdC4nO1xuICAgIH1cbiAgICBpZiAocGFnZXMuY3VzdG9tUm91dGVzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhZ2VzLmN1c3RvbVJvdXRlcyA9IFBhZ2VzT3B0aW9ucy5jdXN0b21Sb3V0ZXMuZGVmYXVsdDtcbiAgICB9IGVsc2UgaWYgKCEocGFnZXMuY3VzdG9tUm91dGVzIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICB0aHJvdyAnUGFyc2UgU2VydmVyIG9wdGlvbiBwYWdlcy5jdXN0b21Sb3V0ZXMgbXVzdCBiZSBhbiBhcnJheS4nO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyB2YWxpZGF0ZUlkZW1wb3RlbmN5T3B0aW9ucyhpZGVtcG90ZW5jeU9wdGlvbnMpIHtcbiAgICBpZiAoIWlkZW1wb3RlbmN5T3B0aW9ucykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoaWRlbXBvdGVuY3lPcHRpb25zLnR0bCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZGVtcG90ZW5jeU9wdGlvbnMudHRsID0gSWRlbXBvdGVuY3lPcHRpb25zLnR0bC5kZWZhdWx0O1xuICAgIH0gZWxzZSBpZiAoIWlzTmFOKGlkZW1wb3RlbmN5T3B0aW9ucy50dGwpICYmIGlkZW1wb3RlbmN5T3B0aW9ucy50dGwgPD0gMCkge1xuICAgICAgdGhyb3cgJ2lkZW1wb3RlbmN5IFRUTCB2YWx1ZSBtdXN0IGJlIGdyZWF0ZXIgdGhhbiAwIHNlY29uZHMnO1xuICAgIH0gZWxzZSBpZiAoaXNOYU4oaWRlbXBvdGVuY3lPcHRpb25zLnR0bCkpIHtcbiAgICAgIHRocm93ICdpZGVtcG90ZW5jeSBUVEwgdmFsdWUgbXVzdCBiZSBhIG51bWJlcic7XG4gICAgfVxuICAgIGlmICghaWRlbXBvdGVuY3lPcHRpb25zLnBhdGhzKSB7XG4gICAgICBpZGVtcG90ZW5jeU9wdGlvbnMucGF0aHMgPSBJZGVtcG90ZW5jeU9wdGlvbnMucGF0aHMuZGVmYXVsdDtcbiAgICB9IGVsc2UgaWYgKCEoaWRlbXBvdGVuY3lPcHRpb25zLnBhdGhzIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICB0aHJvdyAnaWRlbXBvdGVuY3kgcGF0aHMgbXVzdCBiZSBvZiBhbiBhcnJheSBvZiBzdHJpbmdzJztcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgdmFsaWRhdGVBY2NvdW50TG9ja291dFBvbGljeShhY2NvdW50TG9ja291dCkge1xuICAgIGlmIChhY2NvdW50TG9ja291dCkge1xuICAgICAgaWYgKFxuICAgICAgICB0eXBlb2YgYWNjb3VudExvY2tvdXQuZHVyYXRpb24gIT09ICdudW1iZXInIHx8XG4gICAgICAgIGFjY291bnRMb2Nrb3V0LmR1cmF0aW9uIDw9IDAgfHxcbiAgICAgICAgYWNjb3VudExvY2tvdXQuZHVyYXRpb24gPiA5OTk5OVxuICAgICAgKSB7XG4gICAgICAgIHRocm93ICdBY2NvdW50IGxvY2tvdXQgZHVyYXRpb24gc2hvdWxkIGJlIGdyZWF0ZXIgdGhhbiAwIGFuZCBsZXNzIHRoYW4gMTAwMDAwJztcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICAhTnVtYmVyLmlzSW50ZWdlcihhY2NvdW50TG9ja291dC50aHJlc2hvbGQpIHx8XG4gICAgICAgIGFjY291bnRMb2Nrb3V0LnRocmVzaG9sZCA8IDEgfHxcbiAgICAgICAgYWNjb3VudExvY2tvdXQudGhyZXNob2xkID4gOTk5XG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgJ0FjY291bnQgbG9ja291dCB0aHJlc2hvbGQgc2hvdWxkIGJlIGFuIGludGVnZXIgZ3JlYXRlciB0aGFuIDAgYW5kIGxlc3MgdGhhbiAxMDAwJztcbiAgICAgIH1cblxuICAgICAgaWYgKGFjY291bnRMb2Nrb3V0LnVubG9ja09uUGFzc3dvcmRSZXNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGFjY291bnRMb2Nrb3V0LnVubG9ja09uUGFzc3dvcmRSZXNldCA9IEFjY291bnRMb2Nrb3V0T3B0aW9ucy51bmxvY2tPblBhc3N3b3JkUmVzZXQuZGVmYXVsdDtcbiAgICAgIH0gZWxzZSBpZiAoIWlzQm9vbGVhbihhY2NvdW50TG9ja291dC51bmxvY2tPblBhc3N3b3JkUmVzZXQpKSB7XG4gICAgICAgIHRocm93ICdQYXJzZSBTZXJ2ZXIgb3B0aW9uIGFjY291bnRMb2Nrb3V0LnVubG9ja09uUGFzc3dvcmRSZXNldCBtdXN0IGJlIGEgYm9vbGVhbi4nO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyB2YWxpZGF0ZVBhc3N3b3JkUG9saWN5KHBhc3N3b3JkUG9saWN5KSB7XG4gICAgaWYgKHBhc3N3b3JkUG9saWN5KSB7XG4gICAgICBpZiAoXG4gICAgICAgIHBhc3N3b3JkUG9saWN5Lm1heFBhc3N3b3JkQWdlICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgKHR5cGVvZiBwYXNzd29yZFBvbGljeS5tYXhQYXNzd29yZEFnZSAhPT0gJ251bWJlcicgfHwgcGFzc3dvcmRQb2xpY3kubWF4UGFzc3dvcmRBZ2UgPCAwKVxuICAgICAgKSB7XG4gICAgICAgIHRocm93ICdwYXNzd29yZFBvbGljeS5tYXhQYXNzd29yZEFnZSBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJztcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBwYXNzd29yZFBvbGljeS5yZXNldFRva2VuVmFsaWRpdHlEdXJhdGlvbiAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICh0eXBlb2YgcGFzc3dvcmRQb2xpY3kucmVzZXRUb2tlblZhbGlkaXR5RHVyYXRpb24gIT09ICdudW1iZXInIHx8XG4gICAgICAgICAgcGFzc3dvcmRQb2xpY3kucmVzZXRUb2tlblZhbGlkaXR5RHVyYXRpb24gPD0gMClcbiAgICAgICkge1xuICAgICAgICB0aHJvdyAncGFzc3dvcmRQb2xpY3kucmVzZXRUb2tlblZhbGlkaXR5RHVyYXRpb24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcic7XG4gICAgICB9XG5cbiAgICAgIGlmIChwYXNzd29yZFBvbGljeS52YWxpZGF0b3JQYXR0ZXJuKSB7XG4gICAgICAgIGlmICh0eXBlb2YgcGFzc3dvcmRQb2xpY3kudmFsaWRhdG9yUGF0dGVybiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBwYXNzd29yZFBvbGljeS52YWxpZGF0b3JQYXR0ZXJuID0gbmV3IFJlZ0V4cChwYXNzd29yZFBvbGljeS52YWxpZGF0b3JQYXR0ZXJuKTtcbiAgICAgICAgfSBlbHNlIGlmICghKHBhc3N3b3JkUG9saWN5LnZhbGlkYXRvclBhdHRlcm4gaW5zdGFuY2VvZiBSZWdFeHApKSB7XG4gICAgICAgICAgdGhyb3cgJ3Bhc3N3b3JkUG9saWN5LnZhbGlkYXRvclBhdHRlcm4gbXVzdCBiZSBhIHJlZ2V4IHN0cmluZyBvciBSZWdFeHAgb2JqZWN0Lic7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBwYXNzd29yZFBvbGljeS52YWxpZGF0b3JDYWxsYmFjayAmJlxuICAgICAgICB0eXBlb2YgcGFzc3dvcmRQb2xpY3kudmFsaWRhdG9yQ2FsbGJhY2sgIT09ICdmdW5jdGlvbidcbiAgICAgICkge1xuICAgICAgICB0aHJvdyAncGFzc3dvcmRQb2xpY3kudmFsaWRhdG9yQ2FsbGJhY2sgbXVzdCBiZSBhIGZ1bmN0aW9uLic7XG4gICAgICB9XG5cbiAgICAgIGlmIChcbiAgICAgICAgcGFzc3dvcmRQb2xpY3kuZG9Ob3RBbGxvd1VzZXJuYW1lICYmXG4gICAgICAgIHR5cGVvZiBwYXNzd29yZFBvbGljeS5kb05vdEFsbG93VXNlcm5hbWUgIT09ICdib29sZWFuJ1xuICAgICAgKSB7XG4gICAgICAgIHRocm93ICdwYXNzd29yZFBvbGljeS5kb05vdEFsbG93VXNlcm5hbWUgbXVzdCBiZSBhIGJvb2xlYW4gdmFsdWUuJztcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBwYXNzd29yZFBvbGljeS5tYXhQYXNzd29yZEhpc3RvcnkgJiZcbiAgICAgICAgKCFOdW1iZXIuaXNJbnRlZ2VyKHBhc3N3b3JkUG9saWN5Lm1heFBhc3N3b3JkSGlzdG9yeSkgfHxcbiAgICAgICAgICBwYXNzd29yZFBvbGljeS5tYXhQYXNzd29yZEhpc3RvcnkgPD0gMCB8fFxuICAgICAgICAgIHBhc3N3b3JkUG9saWN5Lm1heFBhc3N3b3JkSGlzdG9yeSA+IDIwKVxuICAgICAgKSB7XG4gICAgICAgIHRocm93ICdwYXNzd29yZFBvbGljeS5tYXhQYXNzd29yZEhpc3RvcnkgbXVzdCBiZSBhbiBpbnRlZ2VyIHJhbmdpbmcgMCAtIDIwJztcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBwYXNzd29yZFBvbGljeS5yZXNldFRva2VuUmV1c2VJZlZhbGlkICYmXG4gICAgICAgIHR5cGVvZiBwYXNzd29yZFBvbGljeS5yZXNldFRva2VuUmV1c2VJZlZhbGlkICE9PSAnYm9vbGVhbidcbiAgICAgICkge1xuICAgICAgICB0aHJvdyAncmVzZXRUb2tlblJldXNlSWZWYWxpZCBtdXN0IGJlIGEgYm9vbGVhbiB2YWx1ZSc7XG4gICAgICB9XG4gICAgICBpZiAocGFzc3dvcmRQb2xpY3kucmVzZXRUb2tlblJldXNlSWZWYWxpZCAmJiAhcGFzc3dvcmRQb2xpY3kucmVzZXRUb2tlblZhbGlkaXR5RHVyYXRpb24pIHtcbiAgICAgICAgdGhyb3cgJ1lvdSBjYW5ub3QgdXNlIHJlc2V0VG9rZW5SZXVzZUlmVmFsaWQgd2l0aG91dCByZXNldFRva2VuVmFsaWRpdHlEdXJhdGlvbic7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gaWYgdGhlIHBhc3N3b3JkUG9saWN5LnZhbGlkYXRvclBhdHRlcm4gaXMgY29uZmlndXJlZCB0aGVuIHNldHVwIGEgY2FsbGJhY2sgdG8gcHJvY2VzcyB0aGUgcGF0dGVyblxuICBzdGF0aWMgc2V0dXBQYXNzd29yZFZhbGlkYXRvcihwYXNzd29yZFBvbGljeSkge1xuICAgIGlmIChwYXNzd29yZFBvbGljeSAmJiBwYXNzd29yZFBvbGljeS52YWxpZGF0b3JQYXR0ZXJuKSB7XG4gICAgICBwYXNzd29yZFBvbGljeS5wYXR0ZXJuVmFsaWRhdG9yID0gdmFsdWUgPT4ge1xuICAgICAgICByZXR1cm4gcGFzc3dvcmRQb2xpY3kudmFsaWRhdG9yUGF0dGVybi50ZXN0KHZhbHVlKTtcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHZhbGlkYXRlRW1haWxDb25maWd1cmF0aW9uKHtcbiAgICBlbWFpbEFkYXB0ZXIsXG4gICAgYXBwTmFtZSxcbiAgICBwdWJsaWNTZXJ2ZXJVUkwsXG4gICAgZW1haWxWZXJpZnlUb2tlblZhbGlkaXR5RHVyYXRpb24sXG4gICAgZW1haWxWZXJpZnlUb2tlblJldXNlSWZWYWxpZCxcbiAgfSkge1xuICAgIGlmICghZW1haWxBZGFwdGVyKSB7XG4gICAgICB0aHJvdyAnQW4gZW1haWxBZGFwdGVyIGlzIHJlcXVpcmVkIGZvciBlLW1haWwgdmVyaWZpY2F0aW9uIGFuZCBwYXNzd29yZCByZXNldHMuJztcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBhcHBOYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgJ0FuIGFwcCBuYW1lIGlzIHJlcXVpcmVkIGZvciBlLW1haWwgdmVyaWZpY2F0aW9uIGFuZCBwYXNzd29yZCByZXNldHMuJztcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBwdWJsaWNTZXJ2ZXJVUkwgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyAnQSBwdWJsaWMgc2VydmVyIHVybCBpcyByZXF1aXJlZCBmb3IgZS1tYWlsIHZlcmlmaWNhdGlvbiBhbmQgcGFzc3dvcmQgcmVzZXRzLic7XG4gICAgfVxuICAgIGlmIChlbWFpbFZlcmlmeVRva2VuVmFsaWRpdHlEdXJhdGlvbikge1xuICAgICAgaWYgKGlzTmFOKGVtYWlsVmVyaWZ5VG9rZW5WYWxpZGl0eUR1cmF0aW9uKSkge1xuICAgICAgICB0aHJvdyAnRW1haWwgdmVyaWZ5IHRva2VuIHZhbGlkaXR5IGR1cmF0aW9uIG11c3QgYmUgYSB2YWxpZCBudW1iZXIuJztcbiAgICAgIH0gZWxzZSBpZiAoZW1haWxWZXJpZnlUb2tlblZhbGlkaXR5RHVyYXRpb24gPD0gMCkge1xuICAgICAgICB0aHJvdyAnRW1haWwgdmVyaWZ5IHRva2VuIHZhbGlkaXR5IGR1cmF0aW9uIG11c3QgYmUgYSB2YWx1ZSBncmVhdGVyIHRoYW4gMC4nO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZW1haWxWZXJpZnlUb2tlblJldXNlSWZWYWxpZCAmJiB0eXBlb2YgZW1haWxWZXJpZnlUb2tlblJldXNlSWZWYWxpZCAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICB0aHJvdyAnZW1haWxWZXJpZnlUb2tlblJldXNlSWZWYWxpZCBtdXN0IGJlIGEgYm9vbGVhbiB2YWx1ZSc7XG4gICAgfVxuICAgIGlmIChlbWFpbFZlcmlmeVRva2VuUmV1c2VJZlZhbGlkICYmICFlbWFpbFZlcmlmeVRva2VuVmFsaWRpdHlEdXJhdGlvbikge1xuICAgICAgdGhyb3cgJ1lvdSBjYW5ub3QgdXNlIGVtYWlsVmVyaWZ5VG9rZW5SZXVzZUlmVmFsaWQgd2l0aG91dCBlbWFpbFZlcmlmeVRva2VuVmFsaWRpdHlEdXJhdGlvbic7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHZhbGlkYXRlRmlsZVVwbG9hZE9wdGlvbnMoZmlsZVVwbG9hZCkge1xuICAgIHRyeSB7XG4gICAgICBpZiAoZmlsZVVwbG9hZCA9PSBudWxsIHx8IHR5cGVvZiBmaWxlVXBsb2FkICE9PSAnb2JqZWN0JyB8fCBmaWxlVXBsb2FkIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgdGhyb3cgJ2ZpbGVVcGxvYWQgbXVzdCBiZSBhbiBvYmplY3QgdmFsdWUuJztcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZSBpbnN0YW5jZW9mIFJlZmVyZW5jZUVycm9yKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICAgIGlmIChmaWxlVXBsb2FkLmVuYWJsZUZvckFub255bW91c1VzZXIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZmlsZVVwbG9hZC5lbmFibGVGb3JBbm9ueW1vdXNVc2VyID0gRmlsZVVwbG9hZE9wdGlvbnMuZW5hYmxlRm9yQW5vbnltb3VzVXNlci5kZWZhdWx0O1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGZpbGVVcGxvYWQuZW5hYmxlRm9yQW5vbnltb3VzVXNlciAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICB0aHJvdyAnZmlsZVVwbG9hZC5lbmFibGVGb3JBbm9ueW1vdXNVc2VyIG11c3QgYmUgYSBib29sZWFuIHZhbHVlLic7XG4gICAgfVxuICAgIGlmIChmaWxlVXBsb2FkLmVuYWJsZUZvclB1YmxpYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBmaWxlVXBsb2FkLmVuYWJsZUZvclB1YmxpYyA9IEZpbGVVcGxvYWRPcHRpb25zLmVuYWJsZUZvclB1YmxpYy5kZWZhdWx0O1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGZpbGVVcGxvYWQuZW5hYmxlRm9yUHVibGljICE9PSAnYm9vbGVhbicpIHtcbiAgICAgIHRocm93ICdmaWxlVXBsb2FkLmVuYWJsZUZvclB1YmxpYyBtdXN0IGJlIGEgYm9vbGVhbiB2YWx1ZS4nO1xuICAgIH1cbiAgICBpZiAoZmlsZVVwbG9hZC5lbmFibGVGb3JBdXRoZW50aWNhdGVkVXNlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBmaWxlVXBsb2FkLmVuYWJsZUZvckF1dGhlbnRpY2F0ZWRVc2VyID0gRmlsZVVwbG9hZE9wdGlvbnMuZW5hYmxlRm9yQXV0aGVudGljYXRlZFVzZXIuZGVmYXVsdDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBmaWxlVXBsb2FkLmVuYWJsZUZvckF1dGhlbnRpY2F0ZWRVc2VyICE9PSAnYm9vbGVhbicpIHtcbiAgICAgIHRocm93ICdmaWxlVXBsb2FkLmVuYWJsZUZvckF1dGhlbnRpY2F0ZWRVc2VyIG11c3QgYmUgYSBib29sZWFuIHZhbHVlLic7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHZhbGlkYXRlTWFzdGVyS2V5SXBzKG1hc3RlcktleUlwcykge1xuICAgIGZvciAoY29uc3QgaXAgb2YgbWFzdGVyS2V5SXBzKSB7XG4gICAgICBpZiAoIW5ldC5pc0lQKGlwKSkge1xuICAgICAgICB0aHJvdyBgSW52YWxpZCBpcCBpbiBtYXN0ZXJLZXlJcHM6ICR7aXB9YDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZXQgbW91bnQoKSB7XG4gICAgdmFyIG1vdW50ID0gdGhpcy5fbW91bnQ7XG4gICAgaWYgKHRoaXMucHVibGljU2VydmVyVVJMKSB7XG4gICAgICBtb3VudCA9IHRoaXMucHVibGljU2VydmVyVVJMO1xuICAgIH1cbiAgICByZXR1cm4gbW91bnQ7XG4gIH1cblxuICBzZXQgbW91bnQobmV3VmFsdWUpIHtcbiAgICB0aGlzLl9tb3VudCA9IG5ld1ZhbHVlO1xuICB9XG5cbiAgc3RhdGljIHZhbGlkYXRlU2Vzc2lvbkNvbmZpZ3VyYXRpb24oc2Vzc2lvbkxlbmd0aCwgZXhwaXJlSW5hY3RpdmVTZXNzaW9ucykge1xuICAgIGlmIChleHBpcmVJbmFjdGl2ZVNlc3Npb25zKSB7XG4gICAgICBpZiAoaXNOYU4oc2Vzc2lvbkxlbmd0aCkpIHtcbiAgICAgICAgdGhyb3cgJ1Nlc3Npb24gbGVuZ3RoIG11c3QgYmUgYSB2YWxpZCBudW1iZXIuJztcbiAgICAgIH0gZWxzZSBpZiAoc2Vzc2lvbkxlbmd0aCA8PSAwKSB7XG4gICAgICAgIHRocm93ICdTZXNzaW9uIGxlbmd0aCBtdXN0IGJlIGEgdmFsdWUgZ3JlYXRlciB0aGFuIDAuJztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBzdGF0aWMgdmFsaWRhdGVNYXhMaW1pdChtYXhMaW1pdCkge1xuICAgIGlmIChtYXhMaW1pdCA8PSAwKSB7XG4gICAgICB0aHJvdyAnTWF4IGxpbWl0IG11c3QgYmUgYSB2YWx1ZSBncmVhdGVyIHRoYW4gMC4nO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyB2YWxpZGF0ZUFsbG93SGVhZGVycyhhbGxvd0hlYWRlcnMpIHtcbiAgICBpZiAoIVtudWxsLCB1bmRlZmluZWRdLmluY2x1ZGVzKGFsbG93SGVhZGVycykpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGFsbG93SGVhZGVycykpIHtcbiAgICAgICAgYWxsb3dIZWFkZXJzLmZvckVhY2goaGVhZGVyID0+IHtcbiAgICAgICAgICBpZiAodHlwZW9mIGhlYWRlciAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHRocm93ICdBbGxvdyBoZWFkZXJzIG11c3Qgb25seSBjb250YWluIHN0cmluZ3MnO1xuICAgICAgICAgIH0gZWxzZSBpZiAoIWhlYWRlci50cmltKCkubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aHJvdyAnQWxsb3cgaGVhZGVycyBtdXN0IG5vdCBjb250YWluIGVtcHR5IHN0cmluZ3MnO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyAnQWxsb3cgaGVhZGVycyBtdXN0IGJlIGFuIGFycmF5JztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZW5lcmF0ZUVtYWlsVmVyaWZ5VG9rZW5FeHBpcmVzQXQoKSB7XG4gICAgaWYgKCF0aGlzLnZlcmlmeVVzZXJFbWFpbHMgfHwgIXRoaXMuZW1haWxWZXJpZnlUb2tlblZhbGlkaXR5RHVyYXRpb24pIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHZhciBub3cgPSBuZXcgRGF0ZSgpO1xuICAgIHJldHVybiBuZXcgRGF0ZShub3cuZ2V0VGltZSgpICsgdGhpcy5lbWFpbFZlcmlmeVRva2VuVmFsaWRpdHlEdXJhdGlvbiAqIDEwMDApO1xuICB9XG5cbiAgZ2VuZXJhdGVQYXNzd29yZFJlc2V0VG9rZW5FeHBpcmVzQXQoKSB7XG4gICAgaWYgKCF0aGlzLnBhc3N3b3JkUG9saWN5IHx8ICF0aGlzLnBhc3N3b3JkUG9saWN5LnJlc2V0VG9rZW5WYWxpZGl0eUR1cmF0aW9uKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xuICAgIHJldHVybiBuZXcgRGF0ZShub3cuZ2V0VGltZSgpICsgdGhpcy5wYXNzd29yZFBvbGljeS5yZXNldFRva2VuVmFsaWRpdHlEdXJhdGlvbiAqIDEwMDApO1xuICB9XG5cbiAgZ2VuZXJhdGVTZXNzaW9uRXhwaXJlc0F0KCkge1xuICAgIGlmICghdGhpcy5leHBpcmVJbmFjdGl2ZVNlc3Npb25zKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICB2YXIgbm93ID0gbmV3IERhdGUoKTtcbiAgICByZXR1cm4gbmV3IERhdGUobm93LmdldFRpbWUoKSArIHRoaXMuc2Vzc2lvbkxlbmd0aCAqIDEwMDApO1xuICB9XG5cbiAgZ2V0IGludmFsaWRMaW5rVVJMKCkge1xuICAgIHJldHVybiB0aGlzLmN1c3RvbVBhZ2VzLmludmFsaWRMaW5rIHx8IGAke3RoaXMucHVibGljU2VydmVyVVJMfS9hcHBzL2ludmFsaWRfbGluay5odG1sYDtcbiAgfVxuXG4gIGdldCBpbnZhbGlkVmVyaWZpY2F0aW9uTGlua1VSTCgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5jdXN0b21QYWdlcy5pbnZhbGlkVmVyaWZpY2F0aW9uTGluayB8fFxuICAgICAgYCR7dGhpcy5wdWJsaWNTZXJ2ZXJVUkx9L2FwcHMvaW52YWxpZF92ZXJpZmljYXRpb25fbGluay5odG1sYFxuICAgICk7XG4gIH1cblxuICBnZXQgbGlua1NlbmRTdWNjZXNzVVJMKCkge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLmN1c3RvbVBhZ2VzLmxpbmtTZW5kU3VjY2VzcyB8fCBgJHt0aGlzLnB1YmxpY1NlcnZlclVSTH0vYXBwcy9saW5rX3NlbmRfc3VjY2Vzcy5odG1sYFxuICAgICk7XG4gIH1cblxuICBnZXQgbGlua1NlbmRGYWlsVVJMKCkge1xuICAgIHJldHVybiB0aGlzLmN1c3RvbVBhZ2VzLmxpbmtTZW5kRmFpbCB8fCBgJHt0aGlzLnB1YmxpY1NlcnZlclVSTH0vYXBwcy9saW5rX3NlbmRfZmFpbC5odG1sYDtcbiAgfVxuXG4gIGdldCB2ZXJpZnlFbWFpbFN1Y2Nlc3NVUkwoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuY3VzdG9tUGFnZXMudmVyaWZ5RW1haWxTdWNjZXNzIHx8XG4gICAgICBgJHt0aGlzLnB1YmxpY1NlcnZlclVSTH0vYXBwcy92ZXJpZnlfZW1haWxfc3VjY2Vzcy5odG1sYFxuICAgICk7XG4gIH1cblxuICBnZXQgY2hvb3NlUGFzc3dvcmRVUkwoKSB7XG4gICAgcmV0dXJuIHRoaXMuY3VzdG9tUGFnZXMuY2hvb3NlUGFzc3dvcmQgfHwgYCR7dGhpcy5wdWJsaWNTZXJ2ZXJVUkx9L2FwcHMvY2hvb3NlX3Bhc3N3b3JkYDtcbiAgfVxuXG4gIGdldCByZXF1ZXN0UmVzZXRQYXNzd29yZFVSTCgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5wdWJsaWNTZXJ2ZXJVUkx9L2FwcHMvJHt0aGlzLmFwcGxpY2F0aW9uSWR9L3JlcXVlc3RfcGFzc3dvcmRfcmVzZXRgO1xuICB9XG5cbiAgZ2V0IHBhc3N3b3JkUmVzZXRTdWNjZXNzVVJMKCkge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLmN1c3RvbVBhZ2VzLnBhc3N3b3JkUmVzZXRTdWNjZXNzIHx8XG4gICAgICBgJHt0aGlzLnB1YmxpY1NlcnZlclVSTH0vYXBwcy9wYXNzd29yZF9yZXNldF9zdWNjZXNzLmh0bWxgXG4gICAgKTtcbiAgfVxuXG4gIGdldCBwYXJzZUZyYW1lVVJMKCkge1xuICAgIHJldHVybiB0aGlzLmN1c3RvbVBhZ2VzLnBhcnNlRnJhbWVVUkw7XG4gIH1cblxuICBnZXQgdmVyaWZ5RW1haWxVUkwoKSB7XG4gICAgcmV0dXJuIGAke3RoaXMucHVibGljU2VydmVyVVJMfS9hcHBzLyR7dGhpcy5hcHBsaWNhdGlvbklkfS92ZXJpZnlfZW1haWxgO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IENvbmZpZztcbm1vZHVsZS5leHBvcnRzID0gQ29uZmlnO1xuIl19