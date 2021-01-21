"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.PagesRouter = void 0;

var _PromiseRouter = _interopRequireDefault(require("../PromiseRouter"));

var _Config = _interopRequireDefault(require("../Config"));

var _express = _interopRequireDefault(require("express"));

var _path = _interopRequireDefault(require("path"));

var _fs = require("fs");

var _node = require("parse/node");

var _Utils = _interopRequireDefault(require("../Utils"));

var _mustache = _interopRequireDefault(require("mustache"));

var _Page = _interopRequireDefault(require("../Page"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// All pages with custom page key for reference and file name
const pages = Object.freeze({
  passwordReset: new _Page.default({
    id: 'passwordReset',
    defaultFile: 'password_reset.html'
  }),
  passwordResetSuccess: new _Page.default({
    id: 'passwordResetSuccess',
    defaultFile: 'password_reset_success.html'
  }),
  passwordResetLinkInvalid: new _Page.default({
    id: 'passwordResetLinkInvalid',
    defaultFile: 'password_reset_link_invalid.html'
  }),
  emailVerificationSuccess: new _Page.default({
    id: 'emailVerificationSuccess',
    defaultFile: 'email_verification_success.html'
  }),
  emailVerificationSendFail: new _Page.default({
    id: 'emailVerificationSendFail',
    defaultFile: 'email_verification_send_fail.html'
  }),
  emailVerificationSendSuccess: new _Page.default({
    id: 'emailVerificationSendSuccess',
    defaultFile: 'email_verification_send_success.html'
  }),
  emailVerificationLinkInvalid: new _Page.default({
    id: 'emailVerificationLinkInvalid',
    defaultFile: 'email_verification_link_invalid.html'
  }),
  emailVerificationLinkExpired: new _Page.default({
    id: 'emailVerificationLinkExpired',
    defaultFile: 'email_verification_link_expired.html'
  })
}); // All page parameters for reference to be used as template placeholders or query params

const pageParams = Object.freeze({
  appName: 'appName',
  appId: 'appId',
  token: 'token',
  username: 'username',
  error: 'error',
  locale: 'locale',
  publicServerUrl: 'publicServerUrl'
}); // The header prefix to add page params as response headers

const pageParamHeaderPrefix = 'x-parse-page-param-';

class PagesRouter extends _PromiseRouter.default {
  /**
   * Constructs a PagesRouter.
   * @param {Object} pages The pages options from the Parse Server configuration.
   */
  constructor(pages = {}) {
    super();
    this.pagesEndpoint = pages.pagesEndpoint ? pages.pagesEndpoint : 'apps';
    this.pagesPath = pages.pagesPath ? _path.default.resolve('./', pages.pagesPath) : _path.default.resolve(__dirname, '../../public');
    this.mountPagesRoutes();
  }

  verifyEmail(req) {
    const config = req.config;
    const {
      username,
      token: rawToken
    } = req.query;
    const token = rawToken && typeof rawToken !== 'string' ? rawToken.toString() : rawToken;

    if (!config) {
      this.invalidRequest();
    }

    if (!token || !username) {
      return this.goToPage(req, pages.emailVerificationLinkInvalid);
    }

    const userController = config.userController;
    return userController.verifyEmail(username, token).then(() => {
      const params = {
        [pageParams.username]: username
      };
      return this.goToPage(req, pages.emailVerificationSuccess, params);
    }, () => {
      const params = {
        [pageParams.username]: username
      };
      return this.goToPage(req, pages.emailVerificationLinkExpired, params);
    });
  }

  resendVerificationEmail(req) {
    const config = req.config;
    const username = req.body.username;

    if (!config) {
      this.invalidRequest();
    }

    if (!username) {
      return this.goToPage(req, pages.emailVerificationLinkInvalid);
    }

    const userController = config.userController;
    return userController.resendVerificationEmail(username).then(() => {
      return this.goToPage(req, pages.emailVerificationSendSuccess);
    }, () => {
      return this.goToPage(req, pages.emailVerificationSendFail);
    });
  }

  passwordReset(req) {
    const config = req.config;
    const params = {
      [pageParams.appId]: req.params.appId,
      [pageParams.appName]: config.appName,
      [pageParams.token]: req.query.token,
      [pageParams.username]: req.query.username,
      [pageParams.publicServerUrl]: config.publicServerURL
    };
    return this.goToPage(req, pages.passwordReset, params);
  }

  requestResetPassword(req) {
    const config = req.config;

    if (!config) {
      this.invalidRequest();
    }

    const {
      username,
      token: rawToken
    } = req.query;
    const token = rawToken && typeof rawToken !== 'string' ? rawToken.toString() : rawToken;

    if (!username || !token) {
      return this.goToPage(req, pages.passwordResetLinkInvalid);
    }

    return config.userController.checkResetTokenValidity(username, token).then(() => {
      const params = {
        [pageParams.token]: token,
        [pageParams.username]: username,
        [pageParams.appId]: config.applicationId,
        [pageParams.appName]: config.appName
      };
      return this.goToPage(req, pages.passwordReset, params);
    }, () => {
      const params = {
        [pageParams.username]: username
      };
      return this.goToPage(req, pages.passwordResetLinkInvalid, params);
    });
  }

  resetPassword(req) {
    const config = req.config;

    if (!config) {
      this.invalidRequest();
    }

    const {
      username,
      new_password,
      token: rawToken
    } = req.body;
    const token = rawToken && typeof rawToken !== 'string' ? rawToken.toString() : rawToken;

    if ((!username || !token || !new_password) && req.xhr === false) {
      return this.goToPage(req, pages.passwordResetLinkInvalid);
    }

    if (!username) {
      throw new _node.Parse.Error(_node.Parse.Error.USERNAME_MISSING, 'Missing username');
    }

    if (!token) {
      throw new _node.Parse.Error(_node.Parse.Error.OTHER_CAUSE, 'Missing token');
    }

    if (!new_password) {
      throw new _node.Parse.Error(_node.Parse.Error.PASSWORD_MISSING, 'Missing password');
    }

    return config.userController.updatePassword(username, token, new_password).then(() => {
      return Promise.resolve({
        success: true
      });
    }, err => {
      return Promise.resolve({
        success: false,
        err
      });
    }).then(result => {
      if (req.xhr) {
        if (result.success) {
          return Promise.resolve({
            status: 200,
            response: 'Password successfully reset'
          });
        }

        if (result.err) {
          throw new _node.Parse.Error(_node.Parse.Error.OTHER_CAUSE, `${result.err}`);
        }
      }

      const query = result.success ? {
        [pageParams.username]: username
      } : {
        [pageParams.username]: username,
        [pageParams.token]: token,
        [pageParams.appId]: config.applicationId,
        [pageParams.error]: result.err,
        [pageParams.appName]: config.appName
      };
      const page = result.success ? pages.passwordResetSuccess : pages.passwordReset;
      return this.goToPage(req, page, query, false);
    });
  }
  /**
   * Returns page content if the page is a local file or returns a
   * redirect to a custom page.
   * @param {Object} req The express request.
   * @param {Page} page The page to go to.
   * @param {Object} [params={}] The query parameters to attach to the URL in case of
   * HTTP redirect responses for POST requests, or the placeholders to fill into
   * the response content in case of HTTP content responses for GET requests.
   * @param {Boolean} [responseType] Is true if a redirect response should be forced,
   * false if a content response should be forced, undefined if the response type
   * should depend on the request type by default:
   * - GET request -> content response
   * - POST request -> redirect response (PRG pattern)
   * @returns {Promise<Object>} The express response.
   */


  goToPage(req, page, params = {}, responseType) {
    const config = req.config; // Determine redirect either by force, response setting or request method

    const redirect = config.pages.forceRedirect ? true : responseType !== undefined ? responseType : req.method == 'POST'; // Include default parameters

    const defaultParams = {
      [pageParams.appId]: config.appId,
      [pageParams.appName]: config.appName,
      [pageParams.publicServerUrl]: config.publicServerURL
    };

    if (Object.values(defaultParams).includes(undefined)) {
      return this.notFound();
    }

    params = Object.assign(params, defaultParams); // Add locale to params to ensure it is passed on with every request;
    // that means, once a locale is set, it is passed on to any follow-up page,
    // e.g. request_password_reset -> password_reset -> passwort_reset_success

    const locale = (req.query || {})[pageParams.locale] || (req.body || {})[pageParams.locale] || (req.params || {})[pageParams.locale] || (req.headers || {})[pageParamHeaderPrefix + pageParams.locale];
    params[pageParams.locale] = locale; // Compose paths and URLs

    const defaultFile = page.defaultFile;
    const defaultPath = this.defaultPagePath(defaultFile);
    const defaultUrl = this.composePageUrl(defaultFile, config.publicServerURL); // If custom URL is set redirect to it without localization

    const customUrl = config.pages.customUrls[page.id];

    if (customUrl && !_Utils.default.isPath(customUrl)) {
      return this.redirectResponse(customUrl, params);
    } // If localization is enabled


    if (config.pages.enableLocalization && locale) {
      return _Utils.default.getLocalizedPath(defaultPath, locale).then(({
        path,
        subdir
      }) => redirect ? this.redirectResponse(this.composePageUrl(defaultFile, config.publicServerURL, subdir), params) : this.pageResponse(path, params));
    } else {
      return redirect ? this.redirectResponse(defaultUrl, params) : this.pageResponse(defaultPath, params);
    }
  }
  /**
   * Creates a response with file content.
   * @param {String} path The path of the file to return.
   * @param {Object} placeholders The placeholders to fill in the
   * content.
   * @returns {Object} The Promise Router response.
   */


  async pageResponse(path, placeholders) {
    // Get file content
    let data;

    try {
      data = await _fs.promises.readFile(path, 'utf-8');
    } catch (e) {
      return this.notFound();
    } // Fill placeholders


    data = _mustache.default.render(data, placeholders); // Add placeholers in header to allow parsing for programmatic use
    // of response, instead of having to parse the HTML content.

    const headers = Object.entries(placeholders).reduce((m, p) => {
      if (p[1] !== undefined) {
        m[`${pageParamHeaderPrefix}${p[0].toLowerCase()}`] = p[1];
      }

      return m;
    }, {});
    return {
      text: data,
      headers: headers
    };
  }
  /**
   * Creates a response with http rediret.
   * @param {Object} req The express request.
   * @param {String} path The path of the file to return.
   * @param {Object} params The query parameters to include.
   * @returns {Object} The Promise Router response.
   */


  async redirectResponse(url, params) {
    // Remove any parameters with undefined value
    params = Object.entries(params).reduce((m, p) => {
      if (p[1] !== undefined) {
        m[p[0]] = p[1];
      }

      return m;
    }, {}); // Compose URL with parameters in query

    const location = new URL(url);
    Object.entries(params).forEach(p => location.searchParams.set(p[0], p[1]));
    const locationString = location.toString(); // Add parameters to header to allow parsing for programmatic use
    // of response, instead of having to parse the HTML content.

    const headers = Object.entries(params).reduce((m, p) => {
      if (p[1] !== undefined) {
        m[`${pageParamHeaderPrefix}${p[0].toLowerCase()}`] = p[1];
      }

      return m;
    }, {});
    return {
      status: 303,
      location: locationString,
      headers: headers
    };
  }

  defaultPagePath(file) {
    return _path.default.join(this.pagesPath, file);
  }

  composePageUrl(file, publicServerUrl, locale) {
    let url = publicServerUrl;
    url += url.endsWith('/') ? '' : '/';
    url += this.pagesEndpoint + '/';
    url += locale === undefined ? '' : locale + '/';
    url += file;
    return url;
  }

  notFound() {
    return {
      text: 'Not found.',
      status: 404
    };
  }

  invalidRequest() {
    const error = new Error();
    error.status = 403;
    error.message = 'unauthorized';
    throw error;
  }

  setConfig(req) {
    req.config = _Config.default.get(req.params.appId || req.query.appId);

    if (!req.config) {
      this.invalidRequest();
    }

    return Promise.resolve();
  }

  mountPagesRoutes() {
    this.route('GET', `/${this.pagesEndpoint}/:appId/verify_email`, req => {
      this.setConfig(req);
    }, req => {
      return this.verifyEmail(req);
    });
    this.route('POST', `/${this.pagesEndpoint}/:appId/resend_verification_email`, req => {
      this.setConfig(req);
    }, req => {
      return this.resendVerificationEmail(req);
    });
    this.route('GET', `/${this.pagesEndpoint}/choose_password`, req => {
      this.setConfig(req);
    }, req => {
      return this.passwordReset(req);
    });
    this.route('POST', `/${this.pagesEndpoint}/:appId/request_password_reset`, req => {
      this.setConfig(req);
    }, req => {
      return this.resetPassword(req);
    });
    this.route('GET', `/${this.pagesEndpoint}/:appId/request_password_reset`, req => {
      this.setConfig(req);
    }, req => {
      return this.requestResetPassword(req);
    });
  }

  expressRouter() {
    const router = _express.default.Router();

    router.use(`/${this.pagesEndpoint}`, _express.default.static(this.pagesPath));
    router.use('/', super.expressRouter());
    return router;
  }

}

exports.PagesRouter = PagesRouter;
var _default = PagesRouter;
exports.default = _default;
module.exports = {
  PagesRouter,
  pageParams,
  pages
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9Sb3V0ZXJzL1BhZ2VzUm91dGVyLmpzIl0sIm5hbWVzIjpbInBhZ2VzIiwiT2JqZWN0IiwiZnJlZXplIiwicGFzc3dvcmRSZXNldCIsIlBhZ2UiLCJpZCIsImRlZmF1bHRGaWxlIiwicGFzc3dvcmRSZXNldFN1Y2Nlc3MiLCJwYXNzd29yZFJlc2V0TGlua0ludmFsaWQiLCJlbWFpbFZlcmlmaWNhdGlvblN1Y2Nlc3MiLCJlbWFpbFZlcmlmaWNhdGlvblNlbmRGYWlsIiwiZW1haWxWZXJpZmljYXRpb25TZW5kU3VjY2VzcyIsImVtYWlsVmVyaWZpY2F0aW9uTGlua0ludmFsaWQiLCJlbWFpbFZlcmlmaWNhdGlvbkxpbmtFeHBpcmVkIiwicGFnZVBhcmFtcyIsImFwcE5hbWUiLCJhcHBJZCIsInRva2VuIiwidXNlcm5hbWUiLCJlcnJvciIsImxvY2FsZSIsInB1YmxpY1NlcnZlclVybCIsInBhZ2VQYXJhbUhlYWRlclByZWZpeCIsIlBhZ2VzUm91dGVyIiwiUHJvbWlzZVJvdXRlciIsImNvbnN0cnVjdG9yIiwicGFnZXNFbmRwb2ludCIsInBhZ2VzUGF0aCIsInBhdGgiLCJyZXNvbHZlIiwiX19kaXJuYW1lIiwibW91bnRQYWdlc1JvdXRlcyIsInZlcmlmeUVtYWlsIiwicmVxIiwiY29uZmlnIiwicmF3VG9rZW4iLCJxdWVyeSIsInRvU3RyaW5nIiwiaW52YWxpZFJlcXVlc3QiLCJnb1RvUGFnZSIsInVzZXJDb250cm9sbGVyIiwidGhlbiIsInBhcmFtcyIsInJlc2VuZFZlcmlmaWNhdGlvbkVtYWlsIiwiYm9keSIsInB1YmxpY1NlcnZlclVSTCIsInJlcXVlc3RSZXNldFBhc3N3b3JkIiwiY2hlY2tSZXNldFRva2VuVmFsaWRpdHkiLCJhcHBsaWNhdGlvbklkIiwicmVzZXRQYXNzd29yZCIsIm5ld19wYXNzd29yZCIsInhociIsIlBhcnNlIiwiRXJyb3IiLCJVU0VSTkFNRV9NSVNTSU5HIiwiT1RIRVJfQ0FVU0UiLCJQQVNTV09SRF9NSVNTSU5HIiwidXBkYXRlUGFzc3dvcmQiLCJQcm9taXNlIiwic3VjY2VzcyIsImVyciIsInJlc3VsdCIsInN0YXR1cyIsInJlc3BvbnNlIiwicGFnZSIsInJlc3BvbnNlVHlwZSIsInJlZGlyZWN0IiwiZm9yY2VSZWRpcmVjdCIsInVuZGVmaW5lZCIsIm1ldGhvZCIsImRlZmF1bHRQYXJhbXMiLCJ2YWx1ZXMiLCJpbmNsdWRlcyIsIm5vdEZvdW5kIiwiYXNzaWduIiwiaGVhZGVycyIsImRlZmF1bHRQYXRoIiwiZGVmYXVsdFBhZ2VQYXRoIiwiZGVmYXVsdFVybCIsImNvbXBvc2VQYWdlVXJsIiwiY3VzdG9tVXJsIiwiY3VzdG9tVXJscyIsIlV0aWxzIiwiaXNQYXRoIiwicmVkaXJlY3RSZXNwb25zZSIsImVuYWJsZUxvY2FsaXphdGlvbiIsImdldExvY2FsaXplZFBhdGgiLCJzdWJkaXIiLCJwYWdlUmVzcG9uc2UiLCJwbGFjZWhvbGRlcnMiLCJkYXRhIiwiZnMiLCJyZWFkRmlsZSIsImUiLCJtdXN0YWNoZSIsInJlbmRlciIsImVudHJpZXMiLCJyZWR1Y2UiLCJtIiwicCIsInRvTG93ZXJDYXNlIiwidGV4dCIsInVybCIsImxvY2F0aW9uIiwiVVJMIiwiZm9yRWFjaCIsInNlYXJjaFBhcmFtcyIsInNldCIsImxvY2F0aW9uU3RyaW5nIiwiZmlsZSIsImpvaW4iLCJlbmRzV2l0aCIsIm1lc3NhZ2UiLCJzZXRDb25maWciLCJDb25maWciLCJnZXQiLCJyb3V0ZSIsImV4cHJlc3NSb3V0ZXIiLCJyb3V0ZXIiLCJleHByZXNzIiwiUm91dGVyIiwidXNlIiwic3RhdGljIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOzs7O0FBRUE7QUFDQSxNQUFNQSxLQUFLLEdBQUdDLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjO0FBQzFCQyxFQUFBQSxhQUFhLEVBQUUsSUFBSUMsYUFBSixDQUFTO0FBQUVDLElB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TCxhQUFPLEtBQUs5QixhQUFMLENBQW1COEIsR0FBbkIsQ0FBUDtBQUNELEtBUkg7QUFXQSxTQUFLbUYsS0FBTCxDQUNFLE1BREYsRUFFRyxJQUFHLEtBQUsxRixhQUFjLGdDQUZ6QixFQUdFTyxHQUFHLElBQUk7QUFDTCxXQUFLZ0YsU0FBTCxDQUFlaEYsR0FBZjtBQUNELEtBTEgsRUFNRUEsR0FBRyxJQUFJO0FBQ0wsYUFBTyxLQUFLZ0IsYUFBTCxDQUFtQmhCLEdBQW5CLENBQVA7QUFDRCxLQVJIO0FBV0EsU0FBS21GLEtBQUwsQ0FDRSxLQURGLEVBRUcsSUFBRyxLQUFLMUYsYUFBYyxnQ0FGekIsRUFHRU8sR0FBRyxJQUFJO0FBQ0wsV0FBS2dGLFNBQUwsQ0FBZWhGLEdBQWY7QUFDRCxLQUxILEVBTUVBLEdBQUcsSUFBSTtBQUNMLGFBQU8sS0FBS2Esb0JBQUwsQ0FBMEJiLEdBQTFCLENBQVA7QUFDRCxLQVJIO0FBVUQ7O0FBRURvRixFQUFBQSxhQUFhLEdBQUc7QUFDZCxVQUFNQyxNQUFNLEdBQUdDLGlCQUFRQyxNQUFSLEVBQWY7O0FBQ0FGLElBQUFBLE1BQU0sQ0FBQ0csR0FBUCxDQUFZLElBQUcsS0FBSy9GLGFBQWMsRUFBbEMsRUFBcUM2RixpQkFBUUcsTUFBUixDQUFlLEtBQUsvRixTQUFwQixDQUFyQztBQUNBMkYsSUFBQUEsTUFBTSxDQUFDRyxHQUFQLENBQVcsR0FBWCxFQUFnQixNQUFNSixhQUFOLEVBQWhCO0FBQ0EsV0FBT0MsTUFBUDtBQUNEOztBQXZhNEM7OztlQTBhaEMvRixXOztBQUNmb0csTUFBTSxDQUFDQyxPQUFQLEdBQWlCO0FBQ2ZyRyxFQUFBQSxXQURlO0FBRWZULEVBQUFBLFVBRmU7QUFHZmQsRUFBQUE7QUFIZSxDQUFqQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBQcm9taXNlUm91dGVyIGZyb20gJy4uL1Byb21pc2VSb3V0ZXInO1xuaW1wb3J0IENvbmZpZyBmcm9tICcuLi9Db25maWcnO1xuaW1wb3J0IGV4cHJlc3MgZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHByb21pc2VzIGFzIGZzIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgUGFyc2UgfSBmcm9tICdwYXJzZS9ub2RlJztcbmltcG9ydCBVdGlscyBmcm9tICcuLi9VdGlscyc7XG5pbXBvcnQgbXVzdGFjaGUgZnJvbSAnbXVzdGFjaGUnO1xuaW1wb3J0IFBhZ2UgZnJvbSAnLi4vUGFnZSc7XG5cbi8vIEFsbCBwYWdlcyB3aXRoIGN1c3RvbSBwYWdlIGtleSBmb3IgcmVmZXJlbmNlIGFuZCBmaWxlIG5hbWVcbmNvbnN0IHBhZ2VzID0gT2JqZWN0LmZyZWV6ZSh7XG4gIHBhc3N3b3JkUmVzZXQ6IG5ldyBQYWdlKHsgaWQ6ICdwYXNzd29yZFJlc2V0JywgZGVmYXVsdEZpbGU6ICdwYXNzd29yZF9yZXNldC5odG1sJyB9KSxcbiAgcGFzc3dvcmRSZXNldFN1Y2Nlc3M6IG5ldyBQYWdlKHsgaWQ6ICdwYXNzd29yZFJlc2V0U3VjY2VzcycsIGRlZmF1bHRGaWxlOiAncGFzc3dvcmRfcmVzZXRfc3VjY2Vzcy5odG1sJyB9KSxcbiAgcGFzc3dvcmRSZXNldExpbmtJbnZhbGlkOiBuZXcgUGFnZSh7IGlkOiAncGFzc3dvcmRSZXNldExpbmtJbnZhbGlkJywgZGVmYXVsdEZpbGU6ICdwYXNzd29yZF9yZXNldF9saW5rX2ludmFsaWQuaHRtbCcgfSksXG4gIGVtYWlsVmVyaWZpY2F0aW9uU3VjY2VzczogbmV3IFBhZ2UoeyBpZDogJ2VtYWlsVmVyaWZpY2F0aW9uU3VjY2VzcycsIGRlZmF1bHRGaWxlOiAnZW1haWxfdmVyaWZpY2F0aW9uX3N1Y2Nlc3MuaHRtbCcgfSksXG4gIGVtYWlsVmVyaWZpY2F0aW9uU2VuZEZhaWw6IG5ldyBQYWdlKHsgaWQ6ICdlbWFpbFZlcmlmaWNhdGlvblNlbmRGYWlsJywgZGVmYXVsdEZpbGU6ICdlbWFpbF92ZXJpZmljYXRpb25fc2VuZF9mYWlsLmh0bWwnIH0pLFxuICBlbWFpbFZlcmlmaWNhdGlvblNlbmRTdWNjZXNzOiBuZXcgUGFnZSh7IGlkOiAnZW1haWxWZXJpZmljYXRpb25TZW5kU3VjY2VzcycsIGRlZmF1bHRGaWxlOiAnZW1haWxfdmVyaWZpY2F0aW9uX3NlbmRfc3VjY2Vzcy5odG1sJyB9KSxcbiAgZW1haWxWZXJpZmljYXRpb25MaW5rSW52YWxpZDogbmV3IFBhZ2UoeyBpZDogJ2VtYWlsVmVyaWZpY2F0aW9uTGlua0ludmFsaWQnLCBkZWZhdWx0RmlsZTogJ2VtYWlsX3ZlcmlmaWNhdGlvbl9saW5rX2ludmFsaWQuaHRtbCcgfSksXG4gIGVtYWlsVmVyaWZpY2F0aW9uTGlua0V4cGlyZWQ6IG5ldyBQYWdlKHsgaWQ6ICdlbWFpbFZlcmlmaWNhdGlvbkxpbmtFeHBpcmVkJywgZGVmYXVsdEZpbGU6ICdlbWFpbF92ZXJpZmljYXRpb25fbGlua19leHBpcmVkLmh0bWwnIH0pLFxufSk7XG4vLyBBbGwgcGFnZSBwYXJhbWV0ZXJzIGZvciByZWZlcmVuY2UgdG8gYmUgdXNlZCBhcyB0ZW1wbGF0ZSBwbGFjZWhvbGRlcnMgb3IgcXVlcnkgcGFyYW1zXG5jb25zdCBwYWdlUGFyYW1zID0gT2JqZWN0LmZyZWV6ZSh7XG4gIGFwcE5hbWU6ICdhcHBOYW1lJyxcbiAgYXBwSWQ6ICdhcHBJZCcsXG4gIHRva2VuOiAndG9rZW4nLFxuICB1c2VybmFtZTogJ3VzZXJuYW1lJyxcbiAgZXJyb3I6ICdlcnJvcicsXG4gIGxvY2FsZTogJ2xvY2FsZScsXG4gIHB1YmxpY1NlcnZlclVybDogJ3B1YmxpY1NlcnZlclVybCcsXG59KTtcbi8vIFRoZSBoZWFkZXIgcHJlZml4IHRvIGFkZCBwYWdlIHBhcmFtcyBhcyByZXNwb25zZSBoZWFkZXJzXG5jb25zdCBwYWdlUGFyYW1IZWFkZXJQcmVmaXggPSAneC1wYXJzZS1wYWdlLXBhcmFtLSc7XG5cbmV4cG9ydCBjbGFzcyBQYWdlc1JvdXRlciBleHRlbmRzIFByb21pc2VSb3V0ZXIge1xuICAvKipcbiAgICogQ29uc3RydWN0cyBhIFBhZ2VzUm91dGVyLlxuICAgKiBAcGFyYW0ge09iamVjdH0gcGFnZXMgVGhlIHBhZ2VzIG9wdGlvbnMgZnJvbSB0aGUgUGFyc2UgU2VydmVyIGNvbmZpZ3VyYXRpb24uXG4gICAqL1xuICBjb25zdHJ1Y3RvcihwYWdlcyA9IHt9KSB7XG4gICAgc3VwZXIoKTtcblxuICAgIHRoaXMucGFnZXNFbmRwb2ludCA9IHBhZ2VzLnBhZ2VzRW5kcG9pbnRcbiAgICAgID8gcGFnZXMucGFnZXNFbmRwb2ludFxuICAgICAgOiAnYXBwcyc7XG4gICAgdGhpcy5wYWdlc1BhdGggPSBwYWdlcy5wYWdlc1BhdGhcbiAgICAgID8gcGF0aC5yZXNvbHZlKCcuLycsIHBhZ2VzLnBhZ2VzUGF0aClcbiAgICAgIDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL3B1YmxpYycpO1xuICAgIHRoaXMubW91bnRQYWdlc1JvdXRlcygpO1xuICB9XG5cbiAgdmVyaWZ5RW1haWwocmVxKSB7XG4gICAgY29uc3QgY29uZmlnID0gcmVxLmNvbmZpZztcbiAgICBjb25zdCB7IHVzZXJuYW1lLCB0b2tlbjogcmF3VG9rZW4gfSA9IHJlcS5xdWVyeTtcbiAgICBjb25zdCB0b2tlbiA9IHJhd1Rva2VuICYmIHR5cGVvZiByYXdUb2tlbiAhPT0gJ3N0cmluZycgPyByYXdUb2tlbi50b1N0cmluZygpIDogcmF3VG9rZW47XG5cbiAgICBpZiAoIWNvbmZpZykge1xuICAgICAgdGhpcy5pbnZhbGlkUmVxdWVzdCgpO1xuICAgIH1cblxuICAgIGlmICghdG9rZW4gfHwgIXVzZXJuYW1lKSB7XG4gICAgICByZXR1cm4gdGhpcy5nb1RvUGFnZShyZXEsIHBhZ2VzLmVtYWlsVmVyaWZpY2F0aW9uTGlua0ludmFsaWQpO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXJDb250cm9sbGVyID0gY29uZmlnLnVzZXJDb250cm9sbGVyO1xuICAgIHJldHVybiB1c2VyQ29udHJvbGxlci52ZXJpZnlFbWFpbCh1c2VybmFtZSwgdG9rZW4pLnRoZW4oXG4gICAgICAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgICAgICBbcGFnZVBhcmFtcy51c2VybmFtZV06IHVzZXJuYW1lLFxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gdGhpcy5nb1RvUGFnZShyZXEsIHBhZ2VzLmVtYWlsVmVyaWZpY2F0aW9uU3VjY2VzcywgcGFyYW1zKTtcbiAgICAgIH0sXG4gICAgICAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgICAgICBbcGFnZVBhcmFtcy51c2VybmFtZV06IHVzZXJuYW1lLFxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gdGhpcy5nb1RvUGFnZShyZXEsIHBhZ2VzLmVtYWlsVmVyaWZpY2F0aW9uTGlua0V4cGlyZWQsIHBhcmFtcyk7XG4gICAgICB9XG4gICAgKTtcbiAgfVxuXG4gIHJlc2VuZFZlcmlmaWNhdGlvbkVtYWlsKHJlcSkge1xuICAgIGNvbnN0IGNvbmZpZyA9IHJlcS5jb25maWc7XG4gICAgY29uc3QgdXNlcm5hbWUgPSByZXEuYm9keS51c2VybmFtZTtcblxuICAgIGlmICghY29uZmlnKSB7XG4gICAgICB0aGlzLmludmFsaWRSZXF1ZXN0KCk7XG4gICAgfVxuXG4gICAgaWYgKCF1c2VybmFtZSkge1xuICAgICAgcmV0dXJuIHRoaXMuZ29Ub1BhZ2UocmVxLCBwYWdlcy5lbWFpbFZlcmlmaWNhdGlvbkxpbmtJbnZhbGlkKTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyQ29udHJvbGxlciA9IGNvbmZpZy51c2VyQ29udHJvbGxlcjtcblxuICAgIHJldHVybiB1c2VyQ29udHJvbGxlci5yZXNlbmRWZXJpZmljYXRpb25FbWFpbCh1c2VybmFtZSkudGhlbihcbiAgICAgICgpID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ29Ub1BhZ2UocmVxLCBwYWdlcy5lbWFpbFZlcmlmaWNhdGlvblNlbmRTdWNjZXNzKTtcbiAgICAgIH0sXG4gICAgICAoKSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLmdvVG9QYWdlKHJlcSwgcGFnZXMuZW1haWxWZXJpZmljYXRpb25TZW5kRmFpbCk7XG4gICAgICB9XG4gICAgKTtcbiAgfVxuXG4gIHBhc3N3b3JkUmVzZXQocmVxKSB7XG4gICAgY29uc3QgY29uZmlnID0gcmVxLmNvbmZpZztcbiAgICBjb25zdCBwYXJhbXMgPSB7XG4gICAgICBbcGFnZVBhcmFtcy5hcHBJZF06IHJlcS5wYXJhbXMuYXBwSWQsXG4gICAgICBbcGFnZVBhcmFtcy5hcHBOYW1lXTogY29uZmlnLmFwcE5hbWUsXG4gICAgICBbcGFnZVBhcmFtcy50b2tlbl06IHJlcS5xdWVyeS50b2tlbixcbiAgICAgIFtwYWdlUGFyYW1zLnVzZXJuYW1lXTogcmVxLnF1ZXJ5LnVzZXJuYW1lLFxuICAgICAgW3BhZ2VQYXJhbXMucHVibGljU2VydmVyVXJsXTogY29uZmlnLnB1YmxpY1NlcnZlclVSTFxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuZ29Ub1BhZ2UocmVxLCBwYWdlcy5wYXNzd29yZFJlc2V0LCBwYXJhbXMpO1xuICB9XG5cbiAgcmVxdWVzdFJlc2V0UGFzc3dvcmQocmVxKSB7XG4gICAgY29uc3QgY29uZmlnID0gcmVxLmNvbmZpZztcblxuICAgIGlmICghY29uZmlnKSB7XG4gICAgICB0aGlzLmludmFsaWRSZXF1ZXN0KCk7XG4gICAgfVxuXG4gICAgY29uc3QgeyB1c2VybmFtZSwgdG9rZW46IHJhd1Rva2VuIH0gPSByZXEucXVlcnk7XG4gICAgY29uc3QgdG9rZW4gPSByYXdUb2tlbiAmJiB0eXBlb2YgcmF3VG9rZW4gIT09ICdzdHJpbmcnID8gcmF3VG9rZW4udG9TdHJpbmcoKSA6IHJhd1Rva2VuO1xuXG4gICAgaWYgKCF1c2VybmFtZSB8fCAhdG9rZW4pIHtcbiAgICAgIHJldHVybiB0aGlzLmdvVG9QYWdlKHJlcSwgcGFnZXMucGFzc3dvcmRSZXNldExpbmtJbnZhbGlkKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29uZmlnLnVzZXJDb250cm9sbGVyLmNoZWNrUmVzZXRUb2tlblZhbGlkaXR5KHVzZXJuYW1lLCB0b2tlbikudGhlbihcbiAgICAgICgpID0+IHtcbiAgICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICAgIFtwYWdlUGFyYW1zLnRva2VuXTogdG9rZW4sXG4gICAgICAgICAgW3BhZ2VQYXJhbXMudXNlcm5hbWVdOiB1c2VybmFtZSxcbiAgICAgICAgICBbcGFnZVBhcmFtcy5hcHBJZF06IGNvbmZpZy5hcHBsaWNhdGlvbklkLFxuICAgICAgICAgIFtwYWdlUGFyYW1zLmFwcE5hbWVdOiBjb25maWcuYXBwTmFtZSxcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ29Ub1BhZ2UocmVxLCBwYWdlcy5wYXNzd29yZFJlc2V0LCBwYXJhbXMpO1xuICAgICAgfSxcbiAgICAgICgpID0+IHtcbiAgICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICAgIFtwYWdlUGFyYW1zLnVzZXJuYW1lXTogdXNlcm5hbWUsXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB0aGlzLmdvVG9QYWdlKHJlcSwgcGFnZXMucGFzc3dvcmRSZXNldExpbmtJbnZhbGlkLCBwYXJhbXMpO1xuICAgICAgfVxuICAgICk7XG4gIH1cblxuICByZXNldFBhc3N3b3JkKHJlcSkge1xuICAgIGNvbnN0IGNvbmZpZyA9IHJlcS5jb25maWc7XG5cbiAgICBpZiAoIWNvbmZpZykge1xuICAgICAgdGhpcy5pbnZhbGlkUmVxdWVzdCgpO1xuICAgIH1cblxuICAgIGNvbnN0IHsgdXNlcm5hbWUsIG5ld19wYXNzd29yZCwgdG9rZW46IHJhd1Rva2VuIH0gPSByZXEuYm9keTtcbiAgICBjb25zdCB0b2tlbiA9IHJhd1Rva2VuICYmIHR5cGVvZiByYXdUb2tlbiAhPT0gJ3N0cmluZycgPyByYXdUb2tlbi50b1N0cmluZygpIDogcmF3VG9rZW47XG5cbiAgICBpZiAoKCF1c2VybmFtZSB8fCAhdG9rZW4gfHwgIW5ld19wYXNzd29yZCkgJiYgcmVxLnhociA9PT0gZmFsc2UpIHtcbiAgICAgIHJldHVybiB0aGlzLmdvVG9QYWdlKHJlcSwgcGFnZXMucGFzc3dvcmRSZXNldExpbmtJbnZhbGlkKTtcbiAgICB9XG5cbiAgICBpZiAoIXVzZXJuYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuVVNFUk5BTUVfTUlTU0lORywgJ01pc3NpbmcgdXNlcm5hbWUnKTtcbiAgICB9XG5cbiAgICBpZiAoIXRva2VuKSB7XG4gICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuT1RIRVJfQ0FVU0UsICdNaXNzaW5nIHRva2VuJyk7XG4gICAgfVxuXG4gICAgaWYgKCFuZXdfcGFzc3dvcmQpIHtcbiAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5QQVNTV09SRF9NSVNTSU5HLCAnTWlzc2luZyBwYXNzd29yZCcpO1xuICAgIH1cblxuICAgIHJldHVybiBjb25maWcudXNlckNvbnRyb2xsZXJcbiAgICAgIC51cGRhdGVQYXNzd29yZCh1c2VybmFtZSwgdG9rZW4sIG5ld19wYXNzd29yZClcbiAgICAgIC50aGVuKFxuICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBlcnIgPT4ge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoe1xuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBlcnIsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIClcbiAgICAgIC50aGVuKHJlc3VsdCA9PiB7XG4gICAgICAgIGlmIChyZXEueGhyKSB7XG4gICAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHtcbiAgICAgICAgICAgICAgc3RhdHVzOiAyMDAsXG4gICAgICAgICAgICAgIHJlc3BvbnNlOiAnUGFzc3dvcmQgc3VjY2Vzc2Z1bGx5IHJlc2V0JyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocmVzdWx0LmVycikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLk9USEVSX0NBVVNFLCBgJHtyZXN1bHQuZXJyfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHF1ZXJ5ID0gcmVzdWx0LnN1Y2Nlc3NcbiAgICAgICAgICA/IHtcbiAgICAgICAgICAgIFtwYWdlUGFyYW1zLnVzZXJuYW1lXTogdXNlcm5hbWUsXG4gICAgICAgICAgfVxuICAgICAgICAgIDoge1xuICAgICAgICAgICAgW3BhZ2VQYXJhbXMudXNlcm5hbWVdOiB1c2VybmFtZSxcbiAgICAgICAgICAgIFtwYWdlUGFyYW1zLnRva2VuXTogdG9rZW4sXG4gICAgICAgICAgICBbcGFnZVBhcmFtcy5hcHBJZF06IGNvbmZpZy5hcHBsaWNhdGlvbklkLFxuICAgICAgICAgICAgW3BhZ2VQYXJhbXMuZXJyb3JdOiByZXN1bHQuZXJyLFxuICAgICAgICAgICAgW3BhZ2VQYXJhbXMuYXBwTmFtZV06IGNvbmZpZy5hcHBOYW1lLFxuICAgICAgICAgIH07XG4gICAgICAgIGNvbnN0IHBhZ2UgPSByZXN1bHQuc3VjY2VzcyA/IHBhZ2VzLnBhc3N3b3JkUmVzZXRTdWNjZXNzIDogcGFnZXMucGFzc3dvcmRSZXNldDtcblxuICAgICAgICByZXR1cm4gdGhpcy5nb1RvUGFnZShyZXEsIHBhZ2UsIHF1ZXJ5LCBmYWxzZSk7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHBhZ2UgY29udGVudCBpZiB0aGUgcGFnZSBpcyBhIGxvY2FsIGZpbGUgb3IgcmV0dXJucyBhXG4gICAqIHJlZGlyZWN0IHRvIGEgY3VzdG9tIHBhZ2UuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXEgVGhlIGV4cHJlc3MgcmVxdWVzdC5cbiAgICogQHBhcmFtIHtQYWdlfSBwYWdlIFRoZSBwYWdlIHRvIGdvIHRvLlxuICAgKiBAcGFyYW0ge09iamVjdH0gW3BhcmFtcz17fV0gVGhlIHF1ZXJ5IHBhcmFtZXRlcnMgdG8gYXR0YWNoIHRvIHRoZSBVUkwgaW4gY2FzZSBvZlxuICAgKiBIVFRQIHJlZGlyZWN0IHJlc3BvbnNlcyBmb3IgUE9TVCByZXF1ZXN0cywgb3IgdGhlIHBsYWNlaG9sZGVycyB0byBmaWxsIGludG9cbiAgICogdGhlIHJlc3BvbnNlIGNvbnRlbnQgaW4gY2FzZSBvZiBIVFRQIGNvbnRlbnQgcmVzcG9uc2VzIGZvciBHRVQgcmVxdWVzdHMuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gW3Jlc3BvbnNlVHlwZV0gSXMgdHJ1ZSBpZiBhIHJlZGlyZWN0IHJlc3BvbnNlIHNob3VsZCBiZSBmb3JjZWQsXG4gICAqIGZhbHNlIGlmIGEgY29udGVudCByZXNwb25zZSBzaG91bGQgYmUgZm9yY2VkLCB1bmRlZmluZWQgaWYgdGhlIHJlc3BvbnNlIHR5cGVcbiAgICogc2hvdWxkIGRlcGVuZCBvbiB0aGUgcmVxdWVzdCB0eXBlIGJ5IGRlZmF1bHQ6XG4gICAqIC0gR0VUIHJlcXVlc3QgLT4gY29udGVudCByZXNwb25zZVxuICAgKiAtIFBPU1QgcmVxdWVzdCAtPiByZWRpcmVjdCByZXNwb25zZSAoUFJHIHBhdHRlcm4pXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPE9iamVjdD59IFRoZSBleHByZXNzIHJlc3BvbnNlLlxuICAgKi9cbiAgZ29Ub1BhZ2UocmVxLCBwYWdlLCBwYXJhbXMgPSB7fSwgcmVzcG9uc2VUeXBlKSB7XG4gICAgY29uc3QgY29uZmlnID0gcmVxLmNvbmZpZztcblxuICAgIC8vIERldGVybWluZSByZWRpcmVjdCBlaXRoZXIgYnkgZm9yY2UsIHJlc3BvbnNlIHNldHRpbmcgb3IgcmVxdWVzdCBtZXRob2RcbiAgICBjb25zdCByZWRpcmVjdCA9IGNvbmZpZy5wYWdlcy5mb3JjZVJlZGlyZWN0XG4gICAgICA/IHRydWVcbiAgICAgIDogcmVzcG9uc2VUeXBlICE9PSB1bmRlZmluZWRcbiAgICAgICAgPyByZXNwb25zZVR5cGVcbiAgICAgICAgOiByZXEubWV0aG9kID09ICdQT1NUJztcblxuICAgIC8vIEluY2x1ZGUgZGVmYXVsdCBwYXJhbWV0ZXJzXG4gICAgY29uc3QgZGVmYXVsdFBhcmFtcyA9IHtcbiAgICAgIFtwYWdlUGFyYW1zLmFwcElkXTogY29uZmlnLmFwcElkLFxuICAgICAgW3BhZ2VQYXJhbXMuYXBwTmFtZV06IGNvbmZpZy5hcHBOYW1lLFxuICAgICAgW3BhZ2VQYXJhbXMucHVibGljU2VydmVyVXJsXTogY29uZmlnLnB1YmxpY1NlcnZlclVSTCxcbiAgICB9O1xuICAgIGlmIChPYmplY3QudmFsdWVzKGRlZmF1bHRQYXJhbXMpLmluY2x1ZGVzKHVuZGVmaW5lZCkpIHtcbiAgICAgIHJldHVybiB0aGlzLm5vdEZvdW5kKCk7XG4gICAgfVxuICAgIHBhcmFtcyA9IE9iamVjdC5hc3NpZ24ocGFyYW1zLCBkZWZhdWx0UGFyYW1zKTtcblxuICAgIC8vIEFkZCBsb2NhbGUgdG8gcGFyYW1zIHRvIGVuc3VyZSBpdCBpcyBwYXNzZWQgb24gd2l0aCBldmVyeSByZXF1ZXN0O1xuICAgIC8vIHRoYXQgbWVhbnMsIG9uY2UgYSBsb2NhbGUgaXMgc2V0LCBpdCBpcyBwYXNzZWQgb24gdG8gYW55IGZvbGxvdy11cCBwYWdlLFxuICAgIC8vIGUuZy4gcmVxdWVzdF9wYXNzd29yZF9yZXNldCAtPiBwYXNzd29yZF9yZXNldCAtPiBwYXNzd29ydF9yZXNldF9zdWNjZXNzXG4gICAgY29uc3QgbG9jYWxlID1cbiAgICAgIChyZXEucXVlcnkgfHwge30pW3BhZ2VQYXJhbXMubG9jYWxlXVxuICAgICAgfHwgKHJlcS5ib2R5IHx8IHt9KVtwYWdlUGFyYW1zLmxvY2FsZV1cbiAgICAgIHx8IChyZXEucGFyYW1zIHx8IHt9KVtwYWdlUGFyYW1zLmxvY2FsZV1cbiAgICAgIHx8IChyZXEuaGVhZGVycyB8fCB7fSlbcGFnZVBhcmFtSGVhZGVyUHJlZml4ICsgcGFnZVBhcmFtcy5sb2NhbGVdO1xuICAgIHBhcmFtc1twYWdlUGFyYW1zLmxvY2FsZV0gPSBsb2NhbGU7XG5cbiAgICAvLyBDb21wb3NlIHBhdGhzIGFuZCBVUkxzXG4gICAgY29uc3QgZGVmYXVsdEZpbGUgPSBwYWdlLmRlZmF1bHRGaWxlO1xuICAgIGNvbnN0IGRlZmF1bHRQYXRoID0gdGhpcy5kZWZhdWx0UGFnZVBhdGgoZGVmYXVsdEZpbGUpO1xuICAgIGNvbnN0IGRlZmF1bHRVcmwgPSB0aGlzLmNvbXBvc2VQYWdlVXJsKGRlZmF1bHRGaWxlLCBjb25maWcucHVibGljU2VydmVyVVJMKTtcblxuICAgIC8vIElmIGN1c3RvbSBVUkwgaXMgc2V0IHJlZGlyZWN0IHRvIGl0IHdpdGhvdXQgbG9jYWxpemF0aW9uXG4gICAgY29uc3QgY3VzdG9tVXJsID0gY29uZmlnLnBhZ2VzLmN1c3RvbVVybHNbcGFnZS5pZF07XG4gICAgaWYgKGN1c3RvbVVybCAmJiAhVXRpbHMuaXNQYXRoKGN1c3RvbVVybCkpIHtcbiAgICAgIHJldHVybiB0aGlzLnJlZGlyZWN0UmVzcG9uc2UoY3VzdG9tVXJsLCBwYXJhbXMpO1xuICAgIH1cblxuICAgIC8vIElmIGxvY2FsaXphdGlvbiBpcyBlbmFibGVkXG4gICAgaWYgKGNvbmZpZy5wYWdlcy5lbmFibGVMb2NhbGl6YXRpb24gJiYgbG9jYWxlKSB7XG4gICAgICByZXR1cm4gVXRpbHMuZ2V0TG9jYWxpemVkUGF0aChkZWZhdWx0UGF0aCwgbG9jYWxlKS50aGVuKCh7IHBhdGgsIHN1YmRpciB9KSA9PlxuICAgICAgICByZWRpcmVjdFxuICAgICAgICAgID8gdGhpcy5yZWRpcmVjdFJlc3BvbnNlKHRoaXMuY29tcG9zZVBhZ2VVcmwoZGVmYXVsdEZpbGUsIGNvbmZpZy5wdWJsaWNTZXJ2ZXJVUkwsIHN1YmRpciksIHBhcmFtcylcbiAgICAgICAgICA6IHRoaXMucGFnZVJlc3BvbnNlKHBhdGgsIHBhcmFtcylcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiByZWRpcmVjdFxuICAgICAgICA/IHRoaXMucmVkaXJlY3RSZXNwb25zZShkZWZhdWx0VXJsLCBwYXJhbXMpXG4gICAgICAgIDogdGhpcy5wYWdlUmVzcG9uc2UoZGVmYXVsdFBhdGgsIHBhcmFtcyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSByZXNwb25zZSB3aXRoIGZpbGUgY29udGVudC5cbiAgICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggb2YgdGhlIGZpbGUgdG8gcmV0dXJuLlxuICAgKiBAcGFyYW0ge09iamVjdH0gcGxhY2Vob2xkZXJzIFRoZSBwbGFjZWhvbGRlcnMgdG8gZmlsbCBpbiB0aGVcbiAgICogY29udGVudC5cbiAgICogQHJldHVybnMge09iamVjdH0gVGhlIFByb21pc2UgUm91dGVyIHJlc3BvbnNlLlxuICAgKi9cbiAgYXN5bmMgcGFnZVJlc3BvbnNlKHBhdGgsIHBsYWNlaG9sZGVycykge1xuICAgIC8vIEdldCBmaWxlIGNvbnRlbnRcbiAgICBsZXQgZGF0YTtcbiAgICB0cnkge1xuICAgICAgZGF0YSA9IGF3YWl0IGZzLnJlYWRGaWxlKHBhdGgsICd1dGYtOCcpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiB0aGlzLm5vdEZvdW5kKCk7XG4gICAgfVxuXG4gICAgLy8gRmlsbCBwbGFjZWhvbGRlcnNcbiAgICBkYXRhID0gbXVzdGFjaGUucmVuZGVyKGRhdGEsIHBsYWNlaG9sZGVycyk7XG5cbiAgICAvLyBBZGQgcGxhY2Vob2xlcnMgaW4gaGVhZGVyIHRvIGFsbG93IHBhcnNpbmcgZm9yIHByb2dyYW1tYXRpYyB1c2VcbiAgICAvLyBvZiByZXNwb25zZSwgaW5zdGVhZCBvZiBoYXZpbmcgdG8gcGFyc2UgdGhlIEhUTUwgY29udGVudC5cbiAgICBjb25zdCBoZWFkZXJzID0gT2JqZWN0LmVudHJpZXMocGxhY2Vob2xkZXJzKS5yZWR1Y2UoKG0sIHApID0+IHtcbiAgICAgIGlmIChwWzFdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbVtgJHtwYWdlUGFyYW1IZWFkZXJQcmVmaXh9JHtwWzBdLnRvTG93ZXJDYXNlKCl9YF0gPSBwWzFdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG07XG4gICAgfSwge30pO1xuXG4gICAgcmV0dXJuIHsgdGV4dDogZGF0YSwgaGVhZGVyczogaGVhZGVycyB9O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSByZXNwb25zZSB3aXRoIGh0dHAgcmVkaXJldC5cbiAgICogQHBhcmFtIHtPYmplY3R9IHJlcSBUaGUgZXhwcmVzcyByZXF1ZXN0LlxuICAgKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgcGF0aCBvZiB0aGUgZmlsZSB0byByZXR1cm4uXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBwYXJhbXMgVGhlIHF1ZXJ5IHBhcmFtZXRlcnMgdG8gaW5jbHVkZS5cbiAgICogQHJldHVybnMge09iamVjdH0gVGhlIFByb21pc2UgUm91dGVyIHJlc3BvbnNlLlxuICAgKi9cbiAgYXN5bmMgcmVkaXJlY3RSZXNwb25zZSh1cmwsIHBhcmFtcykge1xuICAgIC8vIFJlbW92ZSBhbnkgcGFyYW1ldGVycyB3aXRoIHVuZGVmaW5lZCB2YWx1ZVxuICAgIHBhcmFtcyA9IE9iamVjdC5lbnRyaWVzKHBhcmFtcykucmVkdWNlKChtLCBwKSA9PiB7XG4gICAgICBpZiAocFsxXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG1bcFswXV0gPSBwWzFdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG07XG4gICAgfSwge30pO1xuXG4gICAgLy8gQ29tcG9zZSBVUkwgd2l0aCBwYXJhbWV0ZXJzIGluIHF1ZXJ5XG4gICAgY29uc3QgbG9jYXRpb24gPSBuZXcgVVJMKHVybCk7XG4gICAgT2JqZWN0LmVudHJpZXMocGFyYW1zKS5mb3JFYWNoKHAgPT4gbG9jYXRpb24uc2VhcmNoUGFyYW1zLnNldChwWzBdLCBwWzFdKSk7XG4gICAgY29uc3QgbG9jYXRpb25TdHJpbmcgPSBsb2NhdGlvbi50b1N0cmluZygpO1xuXG4gICAgLy8gQWRkIHBhcmFtZXRlcnMgdG8gaGVhZGVyIHRvIGFsbG93IHBhcnNpbmcgZm9yIHByb2dyYW1tYXRpYyB1c2VcbiAgICAvLyBvZiByZXNwb25zZSwgaW5zdGVhZCBvZiBoYXZpbmcgdG8gcGFyc2UgdGhlIEhUTUwgY29udGVudC5cbiAgICBjb25zdCBoZWFkZXJzID0gT2JqZWN0LmVudHJpZXMocGFyYW1zKS5yZWR1Y2UoKG0sIHApID0+IHtcbiAgICAgIGlmIChwWzFdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbVtgJHtwYWdlUGFyYW1IZWFkZXJQcmVmaXh9JHtwWzBdLnRvTG93ZXJDYXNlKCl9YF0gPSBwWzFdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG07XG4gICAgfSwge30pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1czogMzAzLFxuICAgICAgbG9jYXRpb246IGxvY2F0aW9uU3RyaW5nLFxuICAgICAgaGVhZGVyczogaGVhZGVycyxcbiAgICB9O1xuICB9XG5cbiAgZGVmYXVsdFBhZ2VQYXRoKGZpbGUpIHtcbiAgICByZXR1cm4gcGF0aC5qb2luKHRoaXMucGFnZXNQYXRoLCBmaWxlKTtcbiAgfVxuXG4gIGNvbXBvc2VQYWdlVXJsKGZpbGUsIHB1YmxpY1NlcnZlclVybCwgbG9jYWxlKSB7XG4gICAgbGV0IHVybCA9IHB1YmxpY1NlcnZlclVybDtcbiAgICB1cmwgKz0gdXJsLmVuZHNXaXRoKCcvJykgPyAnJyA6ICcvJztcbiAgICB1cmwgKz0gdGhpcy5wYWdlc0VuZHBvaW50ICsgJy8nO1xuICAgIHVybCArPSBsb2NhbGUgPT09IHVuZGVmaW5lZCA/ICcnIDogbG9jYWxlICsgJy8nO1xuICAgIHVybCArPSBmaWxlO1xuICAgIHJldHVybiB1cmw7XG4gIH1cblxuICBub3RGb3VuZCgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdGV4dDogJ05vdCBmb3VuZC4nLFxuICAgICAgc3RhdHVzOiA0MDQsXG4gICAgfTtcbiAgfVxuXG4gIGludmFsaWRSZXF1ZXN0KCkge1xuICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCk7XG4gICAgZXJyb3Iuc3RhdHVzID0gNDAzO1xuICAgIGVycm9yLm1lc3NhZ2UgPSAndW5hdXRob3JpemVkJztcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuXG4gIHNldENvbmZpZyhyZXEpIHtcbiAgICByZXEuY29uZmlnID0gQ29uZmlnLmdldChyZXEucGFyYW1zLmFwcElkIHx8IHJlcS5xdWVyeS5hcHBJZCk7XG4gICAgaWYgKCFyZXEuY29uZmlnKSB7XG4gICAgICB0aGlzLmludmFsaWRSZXF1ZXN0KCk7XG4gICAgfVxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxuXG4gIG1vdW50UGFnZXNSb3V0ZXMoKSB7XG4gICAgdGhpcy5yb3V0ZShcbiAgICAgICdHRVQnLFxuICAgICAgYC8ke3RoaXMucGFnZXNFbmRwb2ludH0vOmFwcElkL3ZlcmlmeV9lbWFpbGAsXG4gICAgICByZXEgPT4ge1xuICAgICAgICB0aGlzLnNldENvbmZpZyhyZXEpO1xuICAgICAgfSxcbiAgICAgIHJlcSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLnZlcmlmeUVtYWlsKHJlcSk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIHRoaXMucm91dGUoXG4gICAgICAnUE9TVCcsXG4gICAgICBgLyR7dGhpcy5wYWdlc0VuZHBvaW50fS86YXBwSWQvcmVzZW5kX3ZlcmlmaWNhdGlvbl9lbWFpbGAsXG4gICAgICByZXEgPT4ge1xuICAgICAgICB0aGlzLnNldENvbmZpZyhyZXEpO1xuICAgICAgfSxcbiAgICAgIHJlcSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlc2VuZFZlcmlmaWNhdGlvbkVtYWlsKHJlcSk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIHRoaXMucm91dGUoXG4gICAgICAnR0VUJyxcbiAgICAgIGAvJHt0aGlzLnBhZ2VzRW5kcG9pbnR9L2Nob29zZV9wYXNzd29yZGAsXG4gICAgICByZXEgPT4ge1xuICAgICAgICB0aGlzLnNldENvbmZpZyhyZXEpO1xuICAgICAgfSxcbiAgICAgIHJlcSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhc3N3b3JkUmVzZXQocmVxKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgdGhpcy5yb3V0ZShcbiAgICAgICdQT1NUJyxcbiAgICAgIGAvJHt0aGlzLnBhZ2VzRW5kcG9pbnR9LzphcHBJZC9yZXF1ZXN0X3Bhc3N3b3JkX3Jlc2V0YCxcbiAgICAgIHJlcSA9PiB7XG4gICAgICAgIHRoaXMuc2V0Q29uZmlnKHJlcSk7XG4gICAgICB9LFxuICAgICAgcmVxID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVzZXRQYXNzd29yZChyZXEpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICB0aGlzLnJvdXRlKFxuICAgICAgJ0dFVCcsXG4gICAgICBgLyR7dGhpcy5wYWdlc0VuZHBvaW50fS86YXBwSWQvcmVxdWVzdF9wYXNzd29yZF9yZXNldGAsXG4gICAgICByZXEgPT4ge1xuICAgICAgICB0aGlzLnNldENvbmZpZyhyZXEpO1xuICAgICAgfSxcbiAgICAgIHJlcSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3RSZXNldFBhc3N3b3JkKHJlcSk7XG4gICAgICB9XG4gICAgKTtcbiAgfVxuXG4gIGV4cHJlc3NSb3V0ZXIoKSB7XG4gICAgY29uc3Qgcm91dGVyID0gZXhwcmVzcy5Sb3V0ZXIoKTtcbiAgICByb3V0ZXIudXNlKGAvJHt0aGlzLnBhZ2VzRW5kcG9pbnR9YCwgZXhwcmVzcy5zdGF0aWModGhpcy5wYWdlc1BhdGgpKTtcbiAgICByb3V0ZXIudXNlKCcvJywgc3VwZXIuZXhwcmVzc1JvdXRlcigpKTtcbiAgICByZXR1cm4gcm91dGVyO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFBhZ2VzUm91dGVyO1xubW9kdWxlLmV4cG9ydHMgPSB7XG4gIFBhZ2VzUm91dGVyLFxuICBwYWdlUGFyYW1zLFxuICBwYWdlcyxcbn07XG4iXX0=