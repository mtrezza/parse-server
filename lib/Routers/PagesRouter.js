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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9Sb3V0ZXJzL1BhZ2VzUm91dGVyLmpzIl0sIm5hbWVzIjpbInBhZ2VzIiwiT2JqZWN0IiwiZnJlZXplIiwicGFzc3dvcmRSZXNldCIsIlBhZ2UiLCJpZCIsImRlZmF1bHRGaWxlIiwicGFzc3dvcmRSZXNldFN1Y2Nlc3MiLCJwYXNzd29yZFJlc2V0TGlua0ludmFsaWQiLCJlbWFpbFZlcmlmaWNhdGlvblN1Y2Nlc3MiLCJlbWFpbFZlcmlmaWNhdGlvblNlbmRGYWlsIiwiZW1haWxWZXJpZmljYXRpb25TZW5kU3VjY2VzcyIsImVtYWlsVmVyaWZpY2F0aW9uTGlua0ludmFsaWQiLCJlbWFpbFZlcmlmaWNhdGlvbkxpbmtFeHBpcmVkIiwicGFnZVBhcmFtcyIsImFwcE5hbWUiLCJhcHBJZCIsInRva2VuIiwidXNlcm5hbWUiLCJlcnJvciIsImxvY2FsZSIsInB1YmxpY1NlcnZlclVybCIsInBhZ2VQYXJhbUhlYWRlclByZWZpeCIsIlBhZ2VzUm91dGVyIiwiUHJvbWlzZVJvdXRlciIsImNvbnN0cnVjdG9yIiwicGFnZXNFbmRwb2ludCIsInBhZ2VzUGF0aCIsInBhdGgiLCJyZXNvbHZlIiwiX19kaXJuYW1lIiwibW91bnRQYWdlc1JvdXRlcyIsInZlcmlmeUVtYWlsIiwicmVxIiwiY29uZmlnIiwicmF3VG9rZW4iLCJxdWVyeSIsInRvU3RyaW5nIiwiaW52YWxpZFJlcXVlc3QiLCJnb1RvUGFnZSIsInVzZXJDb250cm9sbGVyIiwidGhlbiIsInBhcmFtcyIsInJlc2VuZFZlcmlmaWNhdGlvbkVtYWlsIiwiYm9keSIsInB1YmxpY1NlcnZlclVSTCIsInJlcXVlc3RSZXNldFBhc3N3b3JkIiwiY2hlY2tSZXNldFRva2VuVmFsaWRpdHkiLCJhcHBsaWNhdGlvbklkIiwicmVzZXRQYXNzd29yZCIsIm5ld19wYXNzd29yZCIsInhociIsIlBhcnNlIiwiRXJyb3IiLCJVU0VSTkFNRV9NSVNTSU5HIiwiT1RIRVJfQ0FVU0UiLCJQQVNTV09SRF9NSVNTSU5HIiwidXBkYXRlUGFzc3dvcmQiLCJQcm9taXNlIiwic3VjY2VzcyIsImVyciIsInJlc3VsdCIsInN0YXR1cyIsInJlc3BvbnNlIiwicGFnZSIsInJlc3BvbnNlVHlwZSIsInJlZGlyZWN0IiwiZm9yY2VSZWRpcmVjdCIsInVuZGVmaW5lZCIsIm1ldGhvZCIsImRlZmF1bHRQYXJhbXMiLCJ2YWx1ZXMiLCJpbmNsdWRlcyIsIm5vdEZvdW5kIiwiYXNzaWduIiwiaGVhZGVycyIsImRlZmF1bHRQYXRoIiwiZGVmYXVsdFBhZ2VQYXRoIiwiZGVmYXVsdFVybCIsImNvbXBvc2VQYWdlVXJsIiwiY3VzdG9tVXJsIiwiY3VzdG9tVXJscyIsIlV0aWxzIiwiaXNQYXRoIiwicmVkaXJlY3RSZXNwb25zZSIsImVuYWJsZUxvY2FsaXphdGlvbiIsImdldExvY2FsaXplZFBhdGgiLCJzdWJkaXIiLCJwYWdlUmVzcG9uc2UiLCJwbGFjZWhvbGRlcnMiLCJkYXRhIiwiZnMiLCJyZWFkRmlsZSIsImUiLCJtdXN0YWNoZSIsInJlbmRlciIsImVudHJpZXMiLCJyZWR1Y2UiLCJtIiwicCIsInRvTG93ZXJDYXNlIiwidGV4dCIsInVybCIsImxvY2F0aW9uIiwiVVJMIiwiZm9yRWFjaCIsInNlYXJjaFBhcmFtcyIsInNldCIsImxvY2F0aW9uU3RyaW5nIiwiZmlsZSIsImpvaW4iLCJlbmRzV2l0aCIsIm1lc3NhZ2UiLCJzZXRDb25maWciLCJDb25maWciLCJnZXQiLCJyb3V0ZSIsImV4cHJlc3NSb3V0ZXIiLCJyb3V0ZXIiLCJleHByZXNzIiwiUm91dGVyIiwidXNlIiwic3RhdGljIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOzs7O0FBRUE7QUFDQSxNQUFNQSxLQUFLLEdBQUdDLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjO0FBQzFCQyxFQUFBQSxhQUFhLEVBQUUsSUFBSUMsYUFBSixDQUFTO0FBQUVDLElBQUFBLEVBQUUsRUFBRSxlQUFOO0FBQXVCQyxJQUFBQSxXQUFXLEVBQUU7QUFBcEMsR0FBVCxDQURXO0FBRTFCQyxFQUFBQSxvQkFBb0IsRUFBRSxJQUFJSCxhQUFKLENBQVM7QUFBRUMsSUFBQUEsRUFBRSxFQUFFLHNCQUFOO0FBQThCQyxJQUFBQSxXQUFXLEVBQUU7QUFBM0MsR0FBVCxDQUZJO0FBRzFCRSxFQUFBQSx3QkFBd0IsRUFBRSxJQUFJSixhQUFKLENBQVM7QUFBRUMsSUFBQUEsRUFBRSxFQUFFLDBCQUFOO0FBQWtDQyxJQUFBQSxXQUFXLEVBQUU7QUFBL0MsR0FBVCxDQUhBO0FBSTFCRyxFQUFBQSx3QkFBd0IsRUFBRSxJQUFJTCxhQUFKLENBQVM7QUFBRUMsSUFBQUEsRUFBRSxFQUFFLDBCQUFOO0FBQWtDQyxJQUFBQSxXQUFXLEVBQUU7QUFBL0MsR0FBVCxDQUpBO0FBSzFCSSxFQUFBQSx5QkFBeUIsRUFBRSxJQUFJTixhQUFKLENBQVM7QUFBRUMsSUFBQUEsRUFBRSxFQUFFLDJCQUFOO0FBQW1DQyxJQUFBQSxXQUFXLEVBQUU7QUFBaEQsR0FBVCxDQUxEO0FBTTFCSyxFQUFBQSw0QkFBNEIsRUFBRSxJQUFJUCxhQUFKLENBQVM7QUFBRUMsSUFBQUEsRUFBRSxFQUFFLDhCQUFOO0FBQXNDQyxJQUFBQSxXQUFXLEVBQUU7QUFBbkQsR0FBVCxDQU5KO0FBTzFCTSxFQUFBQSw0QkFBNEIsRUFBRSxJQUFJUixhQUFKLENBQVM7QUFBRUMsSUFBQUEsRUFBRSxFQUFFLDhCQUFOO0FBQXNDQyxJQUFBQSxXQUFXLEVBQUU7QUFBbkQsR0FBVCxDQVBKO0FBUTFCTyxFQUFBQSw0QkFBNEIsRUFBRSxJQUFJVCxhQUFKLENBQVM7QUFBRUMsSUFBQUEsRUFBRSxFQUFFLDhCQUFOO0FBQXNDQyxJQUFBQSxXQUFXLEVBQUU7QUFBbkQsR0FBVDtBQVJKLENBQWQsQ0FBZCxDLENBVUE7O0FBQ0EsTUFBTVEsVUFBVSxHQUFHYixNQUFNLENBQUNDLE1BQVAsQ0FBYztBQUMvQmEsRUFBQUEsT0FBTyxFQUFFLFNBRHNCO0FBRS9CQyxFQUFBQSxLQUFLLEVBQUUsT0FGd0I7QUFHL0JDLEVBQUFBLEtBQUssRUFBRSxPQUh3QjtBQUkvQkMsRUFBQUEsUUFBUSxFQUFFLFVBSnFCO0FBSy9CQyxFQUFBQSxLQUFLLEVBQUUsT0FMd0I7QUFNL0JDLEVBQUFBLE1BQU0sRUFBRSxRQU51QjtBQU8vQkMsRUFBQUEsZUFBZSxFQUFFO0FBUGMsQ0FBZCxDQUFuQixDLENBU0E7O0FBQ0EsTUFBTUMscUJBQXFCLEdBQUcscUJBQTlCOztBQUVPLE1BQU1DLFdBQU4sU0FBMEJDLHNCQUExQixDQUF3QztBQUM3Qzs7OztBQUlBQyxFQUFBQSxXQUFXLENBQUN6QixLQUFLLEdBQUcsRUFBVCxFQUFhO0FBQ3RCO0FBRUEsU0FBSzBCLGFBQUwsR0FBcUIxQixLQUFLLENBQUMwQixhQUFOLEdBQ2pCMUIsS0FBSyxDQUFDMEIsYUFEVyxHQUVqQixNQUZKO0FBR0EsU0FBS0MsU0FBTCxHQUFpQjNCLEtBQUssQ0FBQzJCLFNBQU4sR0FDYkMsY0FBS0MsT0FBTCxDQUFhLElBQWIsRUFBbUI3QixLQUFLLENBQUMyQixTQUF6QixDQURhLEdBRWJDLGNBQUtDLE9BQUwsQ0FBYUMsU0FBYixFQUF3QixjQUF4QixDQUZKO0FBR0EsU0FBS0MsZ0JBQUw7QUFDRDs7QUFFREMsRUFBQUEsV0FBVyxDQUFDQyxHQUFELEVBQU07QUFDZixVQUFNQyxNQUFNLEdBQUdELEdBQUcsQ0FBQ0MsTUFBbkI7QUFDQSxVQUFNO0FBQUVoQixNQUFBQSxRQUFGO0FBQVlELE1BQUFBLEtBQUssRUFBRWtCO0FBQW5CLFFBQWdDRixHQUFHLENBQUNHLEtBQTFDO0FBQ0EsVUFBTW5CLEtBQUssR0FBR2tCLFFBQVEsSUFBSSxPQUFPQSxRQUFQLEtBQW9CLFFBQWhDLEdBQTJDQSxRQUFRLENBQUNFLFFBQVQsRUFBM0MsR0FBaUVGLFFBQS9FOztBQUVBLFFBQUksQ0FBQ0QsTUFBTCxFQUFhO0FBQ1gsV0FBS0ksY0FBTDtBQUNEOztBQUVELFFBQUksQ0FBQ3JCLEtBQUQsSUFBVSxDQUFDQyxRQUFmLEVBQXlCO0FBQ3ZCLGFBQU8sS0FBS3FCLFFBQUwsQ0FBY04sR0FBZCxFQUFtQmpDLEtBQUssQ0FBQ1ksNEJBQXpCLENBQVA7QUFDRDs7QUFFRCxVQUFNNEIsY0FBYyxHQUFHTixNQUFNLENBQUNNLGNBQTlCO0FBQ0EsV0FBT0EsY0FBYyxDQUFDUixXQUFmLENBQTJCZCxRQUEzQixFQUFxQ0QsS0FBckMsRUFBNEN3QixJQUE1QyxDQUNMLE1BQU07QUFDSixZQUFNQyxNQUFNLEdBQUc7QUFDYixTQUFDNUIsVUFBVSxDQUFDSSxRQUFaLEdBQXVCQTtBQURWLE9BQWY7QUFHQSxhQUFPLEtBQUtxQixRQUFMLENBQWNOLEdBQWQsRUFBbUJqQyxLQUFLLENBQUNTLHdCQUF6QixFQUFtRGlDLE1BQW5ELENBQVA7QUFDRCxLQU5JLEVBT0wsTUFBTTtBQUNKLFlBQU1BLE1BQU0sR0FBRztBQUNiLFNBQUM1QixVQUFVLENBQUNJLFFBQVosR0FBdUJBO0FBRFYsT0FBZjtBQUdBLGFBQU8sS0FBS3FCLFFBQUwsQ0FBY04sR0FBZCxFQUFtQmpDLEtBQUssQ0FBQ2EsNEJBQXpCLEVBQXVENkIsTUFBdkQsQ0FBUDtBQUNELEtBWkksQ0FBUDtBQWNEOztBQUVEQyxFQUFBQSx1QkFBdUIsQ0FBQ1YsR0FBRCxFQUFNO0FBQzNCLFVBQU1DLE1BQU0sR0FBR0QsR0FBRyxDQUFDQyxNQUFuQjtBQUNBLFVBQU1oQixRQUFRLEdBQUdlLEdBQUcsQ0FBQ1csSUFBSixDQUFTMUIsUUFBMUI7O0FBRUEsUUFBSSxDQUFDZ0IsTUFBTCxFQUFhO0FBQ1gsV0FBS0ksY0FBTDtBQUNEOztBQUVELFFBQUksQ0FBQ3BCLFFBQUwsRUFBZTtBQUNiLGFBQU8sS0FBS3FCLFFBQUwsQ0FBY04sR0FBZCxFQUFtQmpDLEtBQUssQ0FBQ1ksNEJBQXpCLENBQVA7QUFDRDs7QUFFRCxVQUFNNEIsY0FBYyxHQUFHTixNQUFNLENBQUNNLGNBQTlCO0FBRUEsV0FBT0EsY0FBYyxDQUFDRyx1QkFBZixDQUF1Q3pCLFFBQXZDLEVBQWlEdUIsSUFBakQsQ0FDTCxNQUFNO0FBQ0osYUFBTyxLQUFLRixRQUFMLENBQWNOLEdBQWQsRUFBbUJqQyxLQUFLLENBQUNXLDRCQUF6QixDQUFQO0FBQ0QsS0FISSxFQUlMLE1BQU07QUFDSixhQUFPLEtBQUs0QixRQUFMLENBQWNOLEdBQWQsRUFBbUJqQyxLQUFLLENBQUNVLHlCQUF6QixDQUFQO0FBQ0QsS0FOSSxDQUFQO0FBUUQ7O0FBRURQLEVBQUFBLGFBQWEsQ0FBQzhCLEdBQUQsRUFBTTtBQUNqQixVQUFNQyxNQUFNLEdBQUdELEdBQUcsQ0FBQ0MsTUFBbkI7QUFDQSxVQUFNUSxNQUFNLEdBQUc7QUFDYixPQUFDNUIsVUFBVSxDQUFDRSxLQUFaLEdBQW9CaUIsR0FBRyxDQUFDUyxNQUFKLENBQVcxQixLQURsQjtBQUViLE9BQUNGLFVBQVUsQ0FBQ0MsT0FBWixHQUFzQm1CLE1BQU0sQ0FBQ25CLE9BRmhCO0FBR2IsT0FBQ0QsVUFBVSxDQUFDRyxLQUFaLEdBQW9CZ0IsR0FBRyxDQUFDRyxLQUFKLENBQVVuQixLQUhqQjtBQUliLE9BQUNILFVBQVUsQ0FBQ0ksUUFBWixHQUF1QmUsR0FBRyxDQUFDRyxLQUFKLENBQVVsQixRQUpwQjtBQUtiLE9BQUNKLFVBQVUsQ0FBQ08sZUFBWixHQUE4QmEsTUFBTSxDQUFDVztBQUx4QixLQUFmO0FBT0EsV0FBTyxLQUFLTixRQUFMLENBQWNOLEdBQWQsRUFBbUJqQyxLQUFLLENBQUNHLGFBQXpCLEVBQXdDdUMsTUFBeEMsQ0FBUDtBQUNEOztBQUVESSxFQUFBQSxvQkFBb0IsQ0FBQ2IsR0FBRCxFQUFNO0FBQ3hCLFVBQU1DLE1BQU0sR0FBR0QsR0FBRyxDQUFDQyxNQUFuQjs7QUFFQSxRQUFJLENBQUNBLE1BQUwsRUFBYTtBQUNYLFdBQUtJLGNBQUw7QUFDRDs7QUFFRCxVQUFNO0FBQUVwQixNQUFBQSxRQUFGO0FBQVlELE1BQUFBLEtBQUssRUFBRWtCO0FBQW5CLFFBQWdDRixHQUFHLENBQUNHLEtBQTFDO0FBQ0EsVUFBTW5CLEtBQUssR0FBR2tCLFFBQVEsSUFBSSxPQUFPQSxRQUFQLEtBQW9CLFFBQWhDLEdBQTJDQSxRQUFRLENBQUNFLFFBQVQsRUFBM0MsR0FBaUVGLFFBQS9FOztBQUVBLFFBQUksQ0FBQ2pCLFFBQUQsSUFBYSxDQUFDRCxLQUFsQixFQUF5QjtBQUN2QixhQUFPLEtBQUtzQixRQUFMLENBQWNOLEdBQWQsRUFBbUJqQyxLQUFLLENBQUNRLHdCQUF6QixDQUFQO0FBQ0Q7O0FBRUQsV0FBTzBCLE1BQU0sQ0FBQ00sY0FBUCxDQUFzQk8sdUJBQXRCLENBQThDN0IsUUFBOUMsRUFBd0RELEtBQXhELEVBQStEd0IsSUFBL0QsQ0FDTCxNQUFNO0FBQ0osWUFBTUMsTUFBTSxHQUFHO0FBQ2IsU0FBQzVCLFVBQVUsQ0FBQ0csS0FBWixHQUFvQkEsS0FEUDtBQUViLFNBQUNILFVBQVUsQ0FBQ0ksUUFBWixHQUF1QkEsUUFGVjtBQUdiLFNBQUNKLFVBQVUsQ0FBQ0UsS0FBWixHQUFvQmtCLE1BQU0sQ0FBQ2MsYUFIZDtBQUliLFNBQUNsQyxVQUFVLENBQUNDLE9BQVosR0FBc0JtQixNQUFNLENBQUNuQjtBQUpoQixPQUFmO0FBTUEsYUFBTyxLQUFLd0IsUUFBTCxDQUFjTixHQUFkLEVBQW1CakMsS0FBSyxDQUFDRyxhQUF6QixFQUF3Q3VDLE1BQXhDLENBQVA7QUFDRCxLQVRJLEVBVUwsTUFBTTtBQUNKLFlBQU1BLE1BQU0sR0FBRztBQUNiLFNBQUM1QixVQUFVLENBQUNJLFFBQVosR0FBdUJBO0FBRFYsT0FBZjtBQUdBLGFBQU8sS0FBS3FCLFFBQUwsQ0FBY04sR0FBZCxFQUFtQmpDLEtBQUssQ0FBQ1Esd0JBQXpCLEVBQW1Ea0MsTUFBbkQsQ0FBUDtBQUNELEtBZkksQ0FBUDtBQWlCRDs7QUFFRE8sRUFBQUEsYUFBYSxDQUFDaEIsR0FBRCxFQUFNO0FBQ2pCLFVBQU1DLE1BQU0sR0FBR0QsR0FBRyxDQUFDQyxNQUFuQjs7QUFFQSxRQUFJLENBQUNBLE1BQUwsRUFBYTtBQUNYLFdBQUtJLGNBQUw7QUFDRDs7QUFFRCxVQUFNO0FBQUVwQixNQUFBQSxRQUFGO0FBQVlnQyxNQUFBQSxZQUFaO0FBQTBCakMsTUFBQUEsS0FBSyxFQUFFa0I7QUFBakMsUUFBOENGLEdBQUcsQ0FBQ1csSUFBeEQ7QUFDQSxVQUFNM0IsS0FBSyxHQUFHa0IsUUFBUSxJQUFJLE9BQU9BLFFBQVAsS0FBb0IsUUFBaEMsR0FBMkNBLFFBQVEsQ0FBQ0UsUUFBVCxFQUEzQyxHQUFpRUYsUUFBL0U7O0FBRUEsUUFBSSxDQUFDLENBQUNqQixRQUFELElBQWEsQ0FBQ0QsS0FBZCxJQUF1QixDQUFDaUMsWUFBekIsS0FBMENqQixHQUFHLENBQUNrQixHQUFKLEtBQVksS0FBMUQsRUFBaUU7QUFDL0QsYUFBTyxLQUFLWixRQUFMLENBQWNOLEdBQWQsRUFBbUJqQyxLQUFLLENBQUNRLHdCQUF6QixDQUFQO0FBQ0Q7O0FBRUQsUUFBSSxDQUFDVSxRQUFMLEVBQWU7QUFDYixZQUFNLElBQUlrQyxZQUFNQyxLQUFWLENBQWdCRCxZQUFNQyxLQUFOLENBQVlDLGdCQUE1QixFQUE4QyxrQkFBOUMsQ0FBTjtBQUNEOztBQUVELFFBQUksQ0FBQ3JDLEtBQUwsRUFBWTtBQUNWLFlBQU0sSUFBSW1DLFlBQU1DLEtBQVYsQ0FBZ0JELFlBQU1DLEtBQU4sQ0FBWUUsV0FBNUIsRUFBeUMsZUFBekMsQ0FBTjtBQUNEOztBQUVELFFBQUksQ0FBQ0wsWUFBTCxFQUFtQjtBQUNqQixZQUFNLElBQUlFLFlBQU1DLEtBQVYsQ0FBZ0JELFlBQU1DLEtBQU4sQ0FBWUcsZ0JBQTVCLEVBQThDLGtCQUE5QyxDQUFOO0FBQ0Q7O0FBRUQsV0FBT3RCLE1BQU0sQ0FBQ00sY0FBUCxDQUNKaUIsY0FESSxDQUNXdkMsUUFEWCxFQUNxQkQsS0FEckIsRUFDNEJpQyxZQUQ1QixFQUVKVCxJQUZJLENBR0gsTUFBTTtBQUNKLGFBQU9pQixPQUFPLENBQUM3QixPQUFSLENBQWdCO0FBQ3JCOEIsUUFBQUEsT0FBTyxFQUFFO0FBRFksT0FBaEIsQ0FBUDtBQUdELEtBUEUsRUFRSEMsR0FBRyxJQUFJO0FBQ0wsYUFBT0YsT0FBTyxDQUFDN0IsT0FBUixDQUFnQjtBQUNyQjhCLFFBQUFBLE9BQU8sRUFBRSxLQURZO0FBRXJCQyxRQUFBQTtBQUZxQixPQUFoQixDQUFQO0FBSUQsS0FiRSxFQWVKbkIsSUFmSSxDQWVDb0IsTUFBTSxJQUFJO0FBQ2QsVUFBSTVCLEdBQUcsQ0FBQ2tCLEdBQVIsRUFBYTtBQUNYLFlBQUlVLE1BQU0sQ0FBQ0YsT0FBWCxFQUFvQjtBQUNsQixpQkFBT0QsT0FBTyxDQUFDN0IsT0FBUixDQUFnQjtBQUNyQmlDLFlBQUFBLE1BQU0sRUFBRSxHQURhO0FBRXJCQyxZQUFBQSxRQUFRLEVBQUU7QUFGVyxXQUFoQixDQUFQO0FBSUQ7O0FBQ0QsWUFBSUYsTUFBTSxDQUFDRCxHQUFYLEVBQWdCO0FBQ2QsZ0JBQU0sSUFBSVIsWUFBTUMsS0FBVixDQUFnQkQsWUFBTUMsS0FBTixDQUFZRSxXQUE1QixFQUEwQyxHQUFFTSxNQUFNLENBQUNELEdBQUksRUFBdkQsQ0FBTjtBQUNEO0FBQ0Y7O0FBRUQsWUFBTXhCLEtBQUssR0FBR3lCLE1BQU0sQ0FBQ0YsT0FBUCxHQUNWO0FBQ0EsU0FBQzdDLFVBQVUsQ0FBQ0ksUUFBWixHQUF1QkE7QUFEdkIsT0FEVSxHQUlWO0FBQ0EsU0FBQ0osVUFBVSxDQUFDSSxRQUFaLEdBQXVCQSxRQUR2QjtBQUVBLFNBQUNKLFVBQVUsQ0FBQ0csS0FBWixHQUFvQkEsS0FGcEI7QUFHQSxTQUFDSCxVQUFVLENBQUNFLEtBQVosR0FBb0JrQixNQUFNLENBQUNjLGFBSDNCO0FBSUEsU0FBQ2xDLFVBQVUsQ0FBQ0ssS0FBWixHQUFvQjBDLE1BQU0sQ0FBQ0QsR0FKM0I7QUFLQSxTQUFDOUMsVUFBVSxDQUFDQyxPQUFaLEdBQXNCbUIsTUFBTSxDQUFDbkI7QUFMN0IsT0FKSjtBQVdBLFlBQU1pRCxJQUFJLEdBQUdILE1BQU0sQ0FBQ0YsT0FBUCxHQUFpQjNELEtBQUssQ0FBQ08sb0JBQXZCLEdBQThDUCxLQUFLLENBQUNHLGFBQWpFO0FBRUEsYUFBTyxLQUFLb0MsUUFBTCxDQUFjTixHQUFkLEVBQW1CK0IsSUFBbkIsRUFBeUI1QixLQUF6QixFQUFnQyxLQUFoQyxDQUFQO0FBQ0QsS0ExQ0ksQ0FBUDtBQTJDRDtBQUVEOzs7Ozs7Ozs7Ozs7Ozs7OztBQWVBRyxFQUFBQSxRQUFRLENBQUNOLEdBQUQsRUFBTStCLElBQU4sRUFBWXRCLE1BQU0sR0FBRyxFQUFyQixFQUF5QnVCLFlBQXpCLEVBQXVDO0FBQzdDLFVBQU0vQixNQUFNLEdBQUdELEdBQUcsQ0FBQ0MsTUFBbkIsQ0FENkMsQ0FHN0M7O0FBQ0EsVUFBTWdDLFFBQVEsR0FBR2hDLE1BQU0sQ0FBQ2xDLEtBQVAsQ0FBYW1FLGFBQWIsR0FDYixJQURhLEdBRWJGLFlBQVksS0FBS0csU0FBakIsR0FDRUgsWUFERixHQUVFaEMsR0FBRyxDQUFDb0MsTUFBSixJQUFjLE1BSnBCLENBSjZDLENBVTdDOztBQUNBLFVBQU1DLGFBQWEsR0FBRztBQUNwQixPQUFDeEQsVUFBVSxDQUFDRSxLQUFaLEdBQW9Ca0IsTUFBTSxDQUFDbEIsS0FEUDtBQUVwQixPQUFDRixVQUFVLENBQUNDLE9BQVosR0FBc0JtQixNQUFNLENBQUNuQixPQUZUO0FBR3BCLE9BQUNELFVBQVUsQ0FBQ08sZUFBWixHQUE4QmEsTUFBTSxDQUFDVztBQUhqQixLQUF0Qjs7QUFLQSxRQUFJNUMsTUFBTSxDQUFDc0UsTUFBUCxDQUFjRCxhQUFkLEVBQTZCRSxRQUE3QixDQUFzQ0osU0FBdEMsQ0FBSixFQUFzRDtBQUNwRCxhQUFPLEtBQUtLLFFBQUwsRUFBUDtBQUNEOztBQUNEL0IsSUFBQUEsTUFBTSxHQUFHekMsTUFBTSxDQUFDeUUsTUFBUCxDQUFjaEMsTUFBZCxFQUFzQjRCLGFBQXRCLENBQVQsQ0FuQjZDLENBcUI3QztBQUNBO0FBQ0E7O0FBQ0EsVUFBTWxELE1BQU0sR0FDVixDQUFDYSxHQUFHLENBQUNHLEtBQUosSUFBYSxFQUFkLEVBQWtCdEIsVUFBVSxDQUFDTSxNQUE3QixLQUNHLENBQUNhLEdBQUcsQ0FBQ1csSUFBSixJQUFZLEVBQWIsRUFBaUI5QixVQUFVLENBQUNNLE1BQTVCLENBREgsSUFFRyxDQUFDYSxHQUFHLENBQUNTLE1BQUosSUFBYyxFQUFmLEVBQW1CNUIsVUFBVSxDQUFDTSxNQUE5QixDQUZILElBR0csQ0FBQ2EsR0FBRyxDQUFDMEMsT0FBSixJQUFlLEVBQWhCLEVBQW9CckQscUJBQXFCLEdBQUdSLFVBQVUsQ0FBQ00sTUFBdkQsQ0FKTDtBQUtBc0IsSUFBQUEsTUFBTSxDQUFDNUIsVUFBVSxDQUFDTSxNQUFaLENBQU4sR0FBNEJBLE1BQTVCLENBN0I2QyxDQStCN0M7O0FBQ0EsVUFBTWQsV0FBVyxHQUFHMEQsSUFBSSxDQUFDMUQsV0FBekI7QUFDQSxVQUFNc0UsV0FBVyxHQUFHLEtBQUtDLGVBQUwsQ0FBcUJ2RSxXQUFyQixDQUFwQjtBQUNBLFVBQU13RSxVQUFVLEdBQUcsS0FBS0MsY0FBTCxDQUFvQnpFLFdBQXBCLEVBQWlDNEIsTUFBTSxDQUFDVyxlQUF4QyxDQUFuQixDQWxDNkMsQ0FvQzdDOztBQUNBLFVBQU1tQyxTQUFTLEdBQUc5QyxNQUFNLENBQUNsQyxLQUFQLENBQWFpRixVQUFiLENBQXdCakIsSUFBSSxDQUFDM0QsRUFBN0IsQ0FBbEI7O0FBQ0EsUUFBSTJFLFNBQVMsSUFBSSxDQUFDRSxlQUFNQyxNQUFOLENBQWFILFNBQWIsQ0FBbEIsRUFBMkM7QUFDekMsYUFBTyxLQUFLSSxnQkFBTCxDQUFzQkosU0FBdEIsRUFBaUN0QyxNQUFqQyxDQUFQO0FBQ0QsS0F4QzRDLENBMEM3Qzs7O0FBQ0EsUUFBSVIsTUFBTSxDQUFDbEMsS0FBUCxDQUFhcUYsa0JBQWIsSUFBbUNqRSxNQUF2QyxFQUErQztBQUM3QyxhQUFPOEQsZUFBTUksZ0JBQU4sQ0FBdUJWLFdBQXZCLEVBQW9DeEQsTUFBcEMsRUFBNENxQixJQUE1QyxDQUFpRCxDQUFDO0FBQUViLFFBQUFBLElBQUY7QUFBUTJELFFBQUFBO0FBQVIsT0FBRCxLQUN0RHJCLFFBQVEsR0FDSixLQUFLa0IsZ0JBQUwsQ0FBc0IsS0FBS0wsY0FBTCxDQUFvQnpFLFdBQXBCLEVBQWlDNEIsTUFBTSxDQUFDVyxlQUF4QyxFQUF5RDBDLE1BQXpELENBQXRCLEVBQXdGN0MsTUFBeEYsQ0FESSxHQUVKLEtBQUs4QyxZQUFMLENBQWtCNUQsSUFBbEIsRUFBd0JjLE1BQXhCLENBSEMsQ0FBUDtBQUtELEtBTkQsTUFNTztBQUNMLGFBQU93QixRQUFRLEdBQ1gsS0FBS2tCLGdCQUFMLENBQXNCTixVQUF0QixFQUFrQ3BDLE1BQWxDLENBRFcsR0FFWCxLQUFLOEMsWUFBTCxDQUFrQlosV0FBbEIsRUFBK0JsQyxNQUEvQixDQUZKO0FBR0Q7QUFDRjtBQUVEOzs7Ozs7Ozs7QUFPQSxRQUFNOEMsWUFBTixDQUFtQjVELElBQW5CLEVBQXlCNkQsWUFBekIsRUFBdUM7QUFDckM7QUFDQSxRQUFJQyxJQUFKOztBQUNBLFFBQUk7QUFDRkEsTUFBQUEsSUFBSSxHQUFHLE1BQU1DLGFBQUdDLFFBQUgsQ0FBWWhFLElBQVosRUFBa0IsT0FBbEIsQ0FBYjtBQUNELEtBRkQsQ0FFRSxPQUFPaUUsQ0FBUCxFQUFVO0FBQ1YsYUFBTyxLQUFLcEIsUUFBTCxFQUFQO0FBQ0QsS0FQb0MsQ0FTckM7OztBQUNBaUIsSUFBQUEsSUFBSSxHQUFHSSxrQkFBU0MsTUFBVCxDQUFnQkwsSUFBaEIsRUFBc0JELFlBQXRCLENBQVAsQ0FWcUMsQ0FZckM7QUFDQTs7QUFDQSxVQUFNZCxPQUFPLEdBQUcxRSxNQUFNLENBQUMrRixPQUFQLENBQWVQLFlBQWYsRUFBNkJRLE1BQTdCLENBQW9DLENBQUNDLENBQUQsRUFBSUMsQ0FBSixLQUFVO0FBQzVELFVBQUlBLENBQUMsQ0FBQyxDQUFELENBQUQsS0FBUy9CLFNBQWIsRUFBd0I7QUFDdEI4QixRQUFBQSxDQUFDLENBQUUsR0FBRTVFLHFCQUFzQixHQUFFNkUsQ0FBQyxDQUFDLENBQUQsQ0FBRCxDQUFLQyxXQUFMLEVBQW1CLEVBQS9DLENBQUQsR0FBcURELENBQUMsQ0FBQyxDQUFELENBQXREO0FBQ0Q7O0FBQ0QsYUFBT0QsQ0FBUDtBQUNELEtBTGUsRUFLYixFQUxhLENBQWhCO0FBT0EsV0FBTztBQUFFRyxNQUFBQSxJQUFJLEVBQUVYLElBQVI7QUFBY2YsTUFBQUEsT0FBTyxFQUFFQTtBQUF2QixLQUFQO0FBQ0Q7QUFFRDs7Ozs7Ozs7O0FBT0EsUUFBTVMsZ0JBQU4sQ0FBdUJrQixHQUF2QixFQUE0QjVELE1BQTVCLEVBQW9DO0FBQ2xDO0FBQ0FBLElBQUFBLE1BQU0sR0FBR3pDLE1BQU0sQ0FBQytGLE9BQVAsQ0FBZXRELE1BQWYsRUFBdUJ1RCxNQUF2QixDQUE4QixDQUFDQyxDQUFELEVBQUlDLENBQUosS0FBVTtBQUMvQyxVQUFJQSxDQUFDLENBQUMsQ0FBRCxDQUFELEtBQVMvQixTQUFiLEVBQXdCO0FBQ3RCOEIsUUFBQUEsQ0FBQyxDQUFDQyxDQUFDLENBQUMsQ0FBRCxDQUFGLENBQUQsR0FBVUEsQ0FBQyxDQUFDLENBQUQsQ0FBWDtBQUNEOztBQUNELGFBQU9ELENBQVA7QUFDRCxLQUxRLEVBS04sRUFMTSxDQUFULENBRmtDLENBU2xDOztBQUNBLFVBQU1LLFFBQVEsR0FBRyxJQUFJQyxHQUFKLENBQVFGLEdBQVIsQ0FBakI7QUFDQXJHLElBQUFBLE1BQU0sQ0FBQytGLE9BQVAsQ0FBZXRELE1BQWYsRUFBdUIrRCxPQUF2QixDQUErQk4sQ0FBQyxJQUFJSSxRQUFRLENBQUNHLFlBQVQsQ0FBc0JDLEdBQXRCLENBQTBCUixDQUFDLENBQUMsQ0FBRCxDQUEzQixFQUFnQ0EsQ0FBQyxDQUFDLENBQUQsQ0FBakMsQ0FBcEM7QUFDQSxVQUFNUyxjQUFjLEdBQUdMLFFBQVEsQ0FBQ2xFLFFBQVQsRUFBdkIsQ0Faa0MsQ0FjbEM7QUFDQTs7QUFDQSxVQUFNc0MsT0FBTyxHQUFHMUUsTUFBTSxDQUFDK0YsT0FBUCxDQUFldEQsTUFBZixFQUF1QnVELE1BQXZCLENBQThCLENBQUNDLENBQUQsRUFBSUMsQ0FBSixLQUFVO0FBQ3RELFVBQUlBLENBQUMsQ0FBQyxDQUFELENBQUQsS0FBUy9CLFNBQWIsRUFBd0I7QUFDdEI4QixRQUFBQSxDQUFDLENBQUUsR0FBRTVFLHFCQUFzQixHQUFFNkUsQ0FBQyxDQUFDLENBQUQsQ0FBRCxDQUFLQyxXQUFMLEVBQW1CLEVBQS9DLENBQUQsR0FBcURELENBQUMsQ0FBQyxDQUFELENBQXREO0FBQ0Q7O0FBQ0QsYUFBT0QsQ0FBUDtBQUNELEtBTGUsRUFLYixFQUxhLENBQWhCO0FBT0EsV0FBTztBQUNMcEMsTUFBQUEsTUFBTSxFQUFFLEdBREg7QUFFTHlDLE1BQUFBLFFBQVEsRUFBRUssY0FGTDtBQUdMakMsTUFBQUEsT0FBTyxFQUFFQTtBQUhKLEtBQVA7QUFLRDs7QUFFREUsRUFBQUEsZUFBZSxDQUFDZ0MsSUFBRCxFQUFPO0FBQ3BCLFdBQU9qRixjQUFLa0YsSUFBTCxDQUFVLEtBQUtuRixTQUFmLEVBQTBCa0YsSUFBMUIsQ0FBUDtBQUNEOztBQUVEOUIsRUFBQUEsY0FBYyxDQUFDOEIsSUFBRCxFQUFPeEYsZUFBUCxFQUF3QkQsTUFBeEIsRUFBZ0M7QUFDNUMsUUFBSWtGLEdBQUcsR0FBR2pGLGVBQVY7QUFDQWlGLElBQUFBLEdBQUcsSUFBSUEsR0FBRyxDQUFDUyxRQUFKLENBQWEsR0FBYixJQUFvQixFQUFwQixHQUF5QixHQUFoQztBQUNBVCxJQUFBQSxHQUFHLElBQUksS0FBSzVFLGFBQUwsR0FBcUIsR0FBNUI7QUFDQTRFLElBQUFBLEdBQUcsSUFBSWxGLE1BQU0sS0FBS2dELFNBQVgsR0FBdUIsRUFBdkIsR0FBNEJoRCxNQUFNLEdBQUcsR0FBNUM7QUFDQWtGLElBQUFBLEdBQUcsSUFBSU8sSUFBUDtBQUNBLFdBQU9QLEdBQVA7QUFDRDs7QUFFRDdCLEVBQUFBLFFBQVEsR0FBRztBQUNULFdBQU87QUFDTDRCLE1BQUFBLElBQUksRUFBRSxZQUREO0FBRUx2QyxNQUFBQSxNQUFNLEVBQUU7QUFGSCxLQUFQO0FBSUQ7O0FBRUR4QixFQUFBQSxjQUFjLEdBQUc7QUFDZixVQUFNbkIsS0FBSyxHQUFHLElBQUlrQyxLQUFKLEVBQWQ7QUFDQWxDLElBQUFBLEtBQUssQ0FBQzJDLE1BQU4sR0FBZSxHQUFmO0FBQ0EzQyxJQUFBQSxLQUFLLENBQUM2RixPQUFOLEdBQWdCLGNBQWhCO0FBQ0EsVUFBTTdGLEtBQU47QUFDRDs7QUFFRDhGLEVBQUFBLFNBQVMsQ0FBQ2hGLEdBQUQsRUFBTTtBQUNiQSxJQUFBQSxHQUFHLENBQUNDLE1BQUosR0FBYWdGLGdCQUFPQyxHQUFQLENBQVdsRixHQUFHLENBQUNTLE1BQUosQ0FBVzFCLEtBQVgsSUFBb0JpQixHQUFHLENBQUNHLEtBQUosQ0FBVXBCLEtBQXpDLENBQWI7O0FBQ0EsUUFBSSxDQUFDaUIsR0FBRyxDQUFDQyxNQUFULEVBQWlCO0FBQ2YsV0FBS0ksY0FBTDtBQUNEOztBQUNELFdBQU9vQixPQUFPLENBQUM3QixPQUFSLEVBQVA7QUFDRDs7QUFFREUsRUFBQUEsZ0JBQWdCLEdBQUc7QUFDakIsU0FBS3FGLEtBQUwsQ0FDRSxLQURGLEVBRUcsSUFBRyxLQUFLMUYsYUFBYyxzQkFGekIsRUFHRU8sR0FBRyxJQUFJO0FBQ0wsV0FBS2dGLFNBQUwsQ0FBZWhGLEdBQWY7QUFDRCxLQUxILEVBTUVBLEdBQUcsSUFBSTtBQUNMLGFBQU8sS0FBS0QsV0FBTCxDQUFpQkMsR0FBakIsQ0FBUDtBQUNELEtBUkg7QUFXQSxTQUFLbUYsS0FBTCxDQUNFLE1BREYsRUFFRyxJQUFHLEtBQUsxRixhQUFjLG1DQUZ6QixFQUdFTyxHQUFHLElBQUk7QUFDTCxXQUFLZ0YsU0FBTCxDQUFlaEYsR0FBZjtBQUNELEtBTEgsRUFNRUEsR0FBRyxJQUFJO0FBQ0wsYUFBTyxLQUFLVSx1QkFBTCxDQUE2QlYsR0FBN0IsQ0FBUDtBQUNELEtBUkg7QUFXQSxTQUFLbUYsS0FBTCxDQUNFLEtBREYsRUFFRyxJQUFHLEtBQUsxRixhQUFjLGtCQUZ6QixFQUdFTyxHQUFHLElBQUk7QUFDTCxXQUFLZ0YsU0FBTCxDQUFlaEYsR0FBZjtBQUNELEtBTEgsRUFNRUEsR0FBRyxJQUFJO0FBQ0wsYUFBTyxLQUFLOUIsYUFBTCxDQUFtQjhCLEdBQW5CLENBQVA7QUFDRCxLQVJIO0FBV0EsU0FBS21GLEtBQUwsQ0FDRSxNQURGLEVBRUcsSUFBRyxLQUFLMUYsYUFBYyxnQ0FGekIsRUFHRU8sR0FBRyxJQUFJO0FBQ0wsV0FBS2dGLFNBQUwsQ0FBZWhGLEdBQWY7QUFDRCxLQUxILEVBTUVBLEdBQUcsSUFBSTtBQUNMLGFBQU8sS0FBS2dCLGFBQUwsQ0FBbUJoQixHQUFuQixDQUFQO0FBQ0QsS0FSSDtBQVdBLFNBQUttRixLQUFMLENBQ0UsS0FERixFQUVHLElBQUcsS0FBSzFGLGFBQWMsZ0NBRnpCLEVBR0VPLEdBQUcsSUFBSTtBQUNMLFdBQUtnRixTQUFMLENBQWVoRixHQUFmO0FBQ0QsS0FMSCxFQU1FQSxHQUFHLElBQUk7QUFDTCxhQUFPLEtBQUthLG9CQUFMLENBQTBCYixHQUExQixDQUFQO0FBQ0QsS0FSSDtBQVVEOztBQUVEb0YsRUFBQUEsYUFBYSxHQUFHO0FBQ2QsVUFBTUMsTUFBTSxHQUFHQyxpQkFBUUMsTUFBUixFQUFmOztBQUNBRixJQUFBQSxNQUFNLENBQUNHLEdBQVAsQ0FBWSxJQUFHLEtBQUsvRixhQUFjLEVBQWxDLEVBQXFDNkYsaUJBQVFHLE1BQVIsQ0FBZSxLQUFLL0YsU0FBcEIsQ0FBckM7QUFDQTJGLElBQUFBLE1BQU0sQ0FBQ0csR0FBUCxDQUFXLEdBQVgsRUFBZ0IsTUFBTUosYUFBTixFQUFoQjtBQUNBLFdBQU9DLE1BQVA7QUFDRDs7QUF2YTRDOzs7ZUEwYWhDL0YsVzs7QUFDZm9HLE1BQU0sQ0FBQ0MsT0FBUCxHQUFpQjtBQUNmckcsRUFBQUEsV0FEZTtBQUVmVCxFQUFBQSxVQUZlO0FBR2ZkLEVBQUFBO0FBSGUsQ0FBakIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUHJvbWlzZVJvdXRlciBmcm9tICcuLi9Qcm9taXNlUm91dGVyJztcbmltcG9ydCBDb25maWcgZnJvbSAnLi4vQ29uZmlnJztcbmltcG9ydCBleHByZXNzIGZyb20gJ2V4cHJlc3MnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBwcm9taXNlcyBhcyBmcyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IFBhcnNlIH0gZnJvbSAncGFyc2Uvbm9kZSc7XG5pbXBvcnQgVXRpbHMgZnJvbSAnLi4vVXRpbHMnO1xuaW1wb3J0IG11c3RhY2hlIGZyb20gJ211c3RhY2hlJztcbmltcG9ydCBQYWdlIGZyb20gJy4uL1BhZ2UnO1xuXG4vLyBBbGwgcGFnZXMgd2l0aCBjdXN0b20gcGFnZSBrZXkgZm9yIHJlZmVyZW5jZSBhbmQgZmlsZSBuYW1lXG5jb25zdCBwYWdlcyA9IE9iamVjdC5mcmVlemUoe1xuICBwYXNzd29yZFJlc2V0OiBuZXcgUGFnZSh7IGlkOiAncGFzc3dvcmRSZXNldCcsIGRlZmF1bHRGaWxlOiAncGFzc3dvcmRfcmVzZXQuaHRtbCcgfSksXG4gIHBhc3N3b3JkUmVzZXRTdWNjZXNzOiBuZXcgUGFnZSh7IGlkOiAncGFzc3dvcmRSZXNldFN1Y2Nlc3MnLCBkZWZhdWx0RmlsZTogJ3Bhc3N3b3JkX3Jlc2V0X3N1Y2Nlc3MuaHRtbCcgfSksXG4gIHBhc3N3b3JkUmVzZXRMaW5rSW52YWxpZDogbmV3IFBhZ2UoeyBpZDogJ3Bhc3N3b3JkUmVzZXRMaW5rSW52YWxpZCcsIGRlZmF1bHRGaWxlOiAncGFzc3dvcmRfcmVzZXRfbGlua19pbnZhbGlkLmh0bWwnIH0pLFxuICBlbWFpbFZlcmlmaWNhdGlvblN1Y2Nlc3M6IG5ldyBQYWdlKHsgaWQ6ICdlbWFpbFZlcmlmaWNhdGlvblN1Y2Nlc3MnLCBkZWZhdWx0RmlsZTogJ2VtYWlsX3ZlcmlmaWNhdGlvbl9zdWNjZXNzLmh0bWwnIH0pLFxuICBlbWFpbFZlcmlmaWNhdGlvblNlbmRGYWlsOiBuZXcgUGFnZSh7IGlkOiAnZW1haWxWZXJpZmljYXRpb25TZW5kRmFpbCcsIGRlZmF1bHRGaWxlOiAnZW1haWxfdmVyaWZpY2F0aW9uX3NlbmRfZmFpbC5odG1sJyB9KSxcbiAgZW1haWxWZXJpZmljYXRpb25TZW5kU3VjY2VzczogbmV3IFBhZ2UoeyBpZDogJ2VtYWlsVmVyaWZpY2F0aW9uU2VuZFN1Y2Nlc3MnLCBkZWZhdWx0RmlsZTogJ2VtYWlsX3ZlcmlmaWNhdGlvbl9zZW5kX3N1Y2Nlc3MuaHRtbCcgfSksXG4gIGVtYWlsVmVyaWZpY2F0aW9uTGlua0ludmFsaWQ6IG5ldyBQYWdlKHsgaWQ6ICdlbWFpbFZlcmlmaWNhdGlvbkxpbmtJbnZhbGlkJywgZGVmYXVsdEZpbGU6ICdlbWFpbF92ZXJpZmljYXRpb25fbGlua19pbnZhbGlkLmh0bWwnIH0pLFxuICBlbWFpbFZlcmlmaWNhdGlvbkxpbmtFeHBpcmVkOiBuZXcgUGFnZSh7IGlkOiAnZW1haWxWZXJpZmljYXRpb25MaW5rRXhwaXJlZCcsIGRlZmF1bHRGaWxlOiAnZW1haWxfdmVyaWZpY2F0aW9uX2xpbmtfZXhwaXJlZC5odG1sJyB9KSxcbn0pO1xuLy8gQWxsIHBhZ2UgcGFyYW1ldGVycyBmb3IgcmVmZXJlbmNlIHRvIGJlIHVzZWQgYXMgdGVtcGxhdGUgcGxhY2Vob2xkZXJzIG9yIHF1ZXJ5IHBhcmFtc1xuY29uc3QgcGFnZVBhcmFtcyA9IE9iamVjdC5mcmVlemUoe1xuICBhcHBOYW1lOiAnYXBwTmFtZScsXG4gIGFwcElkOiAnYXBwSWQnLFxuICB0b2tlbjogJ3Rva2VuJyxcbiAgdXNlcm5hbWU6ICd1c2VybmFtZScsXG4gIGVycm9yOiAnZXJyb3InLFxuICBsb2NhbGU6ICdsb2NhbGUnLFxuICBwdWJsaWNTZXJ2ZXJVcmw6ICdwdWJsaWNTZXJ2ZXJVcmwnLFxufSk7XG4vLyBUaGUgaGVhZGVyIHByZWZpeCB0byBhZGQgcGFnZSBwYXJhbXMgYXMgcmVzcG9uc2UgaGVhZGVyc1xuY29uc3QgcGFnZVBhcmFtSGVhZGVyUHJlZml4ID0gJ3gtcGFyc2UtcGFnZS1wYXJhbS0nO1xuXG5leHBvcnQgY2xhc3MgUGFnZXNSb3V0ZXIgZXh0ZW5kcyBQcm9taXNlUm91dGVyIHtcbiAgLyoqXG4gICAqIENvbnN0cnVjdHMgYSBQYWdlc1JvdXRlci5cbiAgICogQHBhcmFtIHtPYmplY3R9IHBhZ2VzIFRoZSBwYWdlcyBvcHRpb25zIGZyb20gdGhlIFBhcnNlIFNlcnZlciBjb25maWd1cmF0aW9uLlxuICAgKi9cbiAgY29uc3RydWN0b3IocGFnZXMgPSB7fSkge1xuICAgIHN1cGVyKCk7XG5cbiAgICB0aGlzLnBhZ2VzRW5kcG9pbnQgPSBwYWdlcy5wYWdlc0VuZHBvaW50XG4gICAgICA/IHBhZ2VzLnBhZ2VzRW5kcG9pbnRcbiAgICAgIDogJ2FwcHMnO1xuICAgIHRoaXMucGFnZXNQYXRoID0gcGFnZXMucGFnZXNQYXRoXG4gICAgICA/IHBhdGgucmVzb2x2ZSgnLi8nLCBwYWdlcy5wYWdlc1BhdGgpXG4gICAgICA6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnKTtcbiAgICB0aGlzLm1vdW50UGFnZXNSb3V0ZXMoKTtcbiAgfVxuXG4gIHZlcmlmeUVtYWlsKHJlcSkge1xuICAgIGNvbnN0IGNvbmZpZyA9IHJlcS5jb25maWc7XG4gICAgY29uc3QgeyB1c2VybmFtZSwgdG9rZW46IHJhd1Rva2VuIH0gPSByZXEucXVlcnk7XG4gICAgY29uc3QgdG9rZW4gPSByYXdUb2tlbiAmJiB0eXBlb2YgcmF3VG9rZW4gIT09ICdzdHJpbmcnID8gcmF3VG9rZW4udG9TdHJpbmcoKSA6IHJhd1Rva2VuO1xuXG4gICAgaWYgKCFjb25maWcpIHtcbiAgICAgIHRoaXMuaW52YWxpZFJlcXVlc3QoKTtcbiAgICB9XG5cbiAgICBpZiAoIXRva2VuIHx8ICF1c2VybmFtZSkge1xuICAgICAgcmV0dXJuIHRoaXMuZ29Ub1BhZ2UocmVxLCBwYWdlcy5lbWFpbFZlcmlmaWNhdGlvbkxpbmtJbnZhbGlkKTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyQ29udHJvbGxlciA9IGNvbmZpZy51c2VyQ29udHJvbGxlcjtcbiAgICByZXR1cm4gdXNlckNvbnRyb2xsZXIudmVyaWZ5RW1haWwodXNlcm5hbWUsIHRva2VuKS50aGVuKFxuICAgICAgKCkgPT4ge1xuICAgICAgICBjb25zdCBwYXJhbXMgPSB7XG4gICAgICAgICAgW3BhZ2VQYXJhbXMudXNlcm5hbWVdOiB1c2VybmFtZSxcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ29Ub1BhZ2UocmVxLCBwYWdlcy5lbWFpbFZlcmlmaWNhdGlvblN1Y2Nlc3MsIHBhcmFtcyk7XG4gICAgICB9LFxuICAgICAgKCkgPT4ge1xuICAgICAgICBjb25zdCBwYXJhbXMgPSB7XG4gICAgICAgICAgW3BhZ2VQYXJhbXMudXNlcm5hbWVdOiB1c2VybmFtZSxcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ29Ub1BhZ2UocmVxLCBwYWdlcy5lbWFpbFZlcmlmaWNhdGlvbkxpbmtFeHBpcmVkLCBwYXJhbXMpO1xuICAgICAgfVxuICAgICk7XG4gIH1cblxuICByZXNlbmRWZXJpZmljYXRpb25FbWFpbChyZXEpIHtcbiAgICBjb25zdCBjb25maWcgPSByZXEuY29uZmlnO1xuICAgIGNvbnN0IHVzZXJuYW1lID0gcmVxLmJvZHkudXNlcm5hbWU7XG5cbiAgICBpZiAoIWNvbmZpZykge1xuICAgICAgdGhpcy5pbnZhbGlkUmVxdWVzdCgpO1xuICAgIH1cblxuICAgIGlmICghdXNlcm5hbWUpIHtcbiAgICAgIHJldHVybiB0aGlzLmdvVG9QYWdlKHJlcSwgcGFnZXMuZW1haWxWZXJpZmljYXRpb25MaW5rSW52YWxpZCk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlckNvbnRyb2xsZXIgPSBjb25maWcudXNlckNvbnRyb2xsZXI7XG5cbiAgICByZXR1cm4gdXNlckNvbnRyb2xsZXIucmVzZW5kVmVyaWZpY2F0aW9uRW1haWwodXNlcm5hbWUpLnRoZW4oXG4gICAgICAoKSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLmdvVG9QYWdlKHJlcSwgcGFnZXMuZW1haWxWZXJpZmljYXRpb25TZW5kU3VjY2Vzcyk7XG4gICAgICB9LFxuICAgICAgKCkgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5nb1RvUGFnZShyZXEsIHBhZ2VzLmVtYWlsVmVyaWZpY2F0aW9uU2VuZEZhaWwpO1xuICAgICAgfVxuICAgICk7XG4gIH1cblxuICBwYXNzd29yZFJlc2V0KHJlcSkge1xuICAgIGNvbnN0IGNvbmZpZyA9IHJlcS5jb25maWc7XG4gICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgW3BhZ2VQYXJhbXMuYXBwSWRdOiByZXEucGFyYW1zLmFwcElkLFxuICAgICAgW3BhZ2VQYXJhbXMuYXBwTmFtZV06IGNvbmZpZy5hcHBOYW1lLFxuICAgICAgW3BhZ2VQYXJhbXMudG9rZW5dOiByZXEucXVlcnkudG9rZW4sXG4gICAgICBbcGFnZVBhcmFtcy51c2VybmFtZV06IHJlcS5xdWVyeS51c2VybmFtZSxcbiAgICAgIFtwYWdlUGFyYW1zLnB1YmxpY1NlcnZlclVybF06IGNvbmZpZy5wdWJsaWNTZXJ2ZXJVUkxcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLmdvVG9QYWdlKHJlcSwgcGFnZXMucGFzc3dvcmRSZXNldCwgcGFyYW1zKTtcbiAgfVxuXG4gIHJlcXVlc3RSZXNldFBhc3N3b3JkKHJlcSkge1xuICAgIGNvbnN0IGNvbmZpZyA9IHJlcS5jb25maWc7XG5cbiAgICBpZiAoIWNvbmZpZykge1xuICAgICAgdGhpcy5pbnZhbGlkUmVxdWVzdCgpO1xuICAgIH1cblxuICAgIGNvbnN0IHsgdXNlcm5hbWUsIHRva2VuOiByYXdUb2tlbiB9ID0gcmVxLnF1ZXJ5O1xuICAgIGNvbnN0IHRva2VuID0gcmF3VG9rZW4gJiYgdHlwZW9mIHJhd1Rva2VuICE9PSAnc3RyaW5nJyA/IHJhd1Rva2VuLnRvU3RyaW5nKCkgOiByYXdUb2tlbjtcblxuICAgIGlmICghdXNlcm5hbWUgfHwgIXRva2VuKSB7XG4gICAgICByZXR1cm4gdGhpcy5nb1RvUGFnZShyZXEsIHBhZ2VzLnBhc3N3b3JkUmVzZXRMaW5rSW52YWxpZCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbmZpZy51c2VyQ29udHJvbGxlci5jaGVja1Jlc2V0VG9rZW5WYWxpZGl0eSh1c2VybmFtZSwgdG9rZW4pLnRoZW4oXG4gICAgICAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgICAgICBbcGFnZVBhcmFtcy50b2tlbl06IHRva2VuLFxuICAgICAgICAgIFtwYWdlUGFyYW1zLnVzZXJuYW1lXTogdXNlcm5hbWUsXG4gICAgICAgICAgW3BhZ2VQYXJhbXMuYXBwSWRdOiBjb25maWcuYXBwbGljYXRpb25JZCxcbiAgICAgICAgICBbcGFnZVBhcmFtcy5hcHBOYW1lXTogY29uZmlnLmFwcE5hbWUsXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB0aGlzLmdvVG9QYWdlKHJlcSwgcGFnZXMucGFzc3dvcmRSZXNldCwgcGFyYW1zKTtcbiAgICAgIH0sXG4gICAgICAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgICAgICBbcGFnZVBhcmFtcy51c2VybmFtZV06IHVzZXJuYW1lLFxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gdGhpcy5nb1RvUGFnZShyZXEsIHBhZ2VzLnBhc3N3b3JkUmVzZXRMaW5rSW52YWxpZCwgcGFyYW1zKTtcbiAgICAgIH1cbiAgICApO1xuICB9XG5cbiAgcmVzZXRQYXNzd29yZChyZXEpIHtcbiAgICBjb25zdCBjb25maWcgPSByZXEuY29uZmlnO1xuXG4gICAgaWYgKCFjb25maWcpIHtcbiAgICAgIHRoaXMuaW52YWxpZFJlcXVlc3QoKTtcbiAgICB9XG5cbiAgICBjb25zdCB7IHVzZXJuYW1lLCBuZXdfcGFzc3dvcmQsIHRva2VuOiByYXdUb2tlbiB9ID0gcmVxLmJvZHk7XG4gICAgY29uc3QgdG9rZW4gPSByYXdUb2tlbiAmJiB0eXBlb2YgcmF3VG9rZW4gIT09ICdzdHJpbmcnID8gcmF3VG9rZW4udG9TdHJpbmcoKSA6IHJhd1Rva2VuO1xuXG4gICAgaWYgKCghdXNlcm5hbWUgfHwgIXRva2VuIHx8ICFuZXdfcGFzc3dvcmQpICYmIHJlcS54aHIgPT09IGZhbHNlKSB7XG4gICAgICByZXR1cm4gdGhpcy5nb1RvUGFnZShyZXEsIHBhZ2VzLnBhc3N3b3JkUmVzZXRMaW5rSW52YWxpZCk7XG4gICAgfVxuXG4gICAgaWYgKCF1c2VybmFtZSkge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLlVTRVJOQU1FX01JU1NJTkcsICdNaXNzaW5nIHVzZXJuYW1lJyk7XG4gICAgfVxuXG4gICAgaWYgKCF0b2tlbikge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLk9USEVSX0NBVVNFLCAnTWlzc2luZyB0b2tlbicpO1xuICAgIH1cblxuICAgIGlmICghbmV3X3Bhc3N3b3JkKSB7XG4gICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuUEFTU1dPUkRfTUlTU0lORywgJ01pc3NpbmcgcGFzc3dvcmQnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29uZmlnLnVzZXJDb250cm9sbGVyXG4gICAgICAudXBkYXRlUGFzc3dvcmQodXNlcm5hbWUsIHRva2VuLCBuZXdfcGFzc3dvcmQpXG4gICAgICAudGhlbihcbiAgICAgICAgKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoe1xuICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgZXJyID0+IHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgZXJyLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICApXG4gICAgICAudGhlbihyZXN1bHQgPT4ge1xuICAgICAgICBpZiAocmVxLnhocikge1xuICAgICAgICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh7XG4gICAgICAgICAgICAgIHN0YXR1czogMjAwLFxuICAgICAgICAgICAgICByZXNwb25zZTogJ1Bhc3N3b3JkIHN1Y2Nlc3NmdWxseSByZXNldCcsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHJlc3VsdC5lcnIpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5PVEhFUl9DQVVTRSwgYCR7cmVzdWx0LmVycn1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBxdWVyeSA9IHJlc3VsdC5zdWNjZXNzXG4gICAgICAgICAgPyB7XG4gICAgICAgICAgICBbcGFnZVBhcmFtcy51c2VybmFtZV06IHVzZXJuYW1lLFxuICAgICAgICAgIH1cbiAgICAgICAgICA6IHtcbiAgICAgICAgICAgIFtwYWdlUGFyYW1zLnVzZXJuYW1lXTogdXNlcm5hbWUsXG4gICAgICAgICAgICBbcGFnZVBhcmFtcy50b2tlbl06IHRva2VuLFxuICAgICAgICAgICAgW3BhZ2VQYXJhbXMuYXBwSWRdOiBjb25maWcuYXBwbGljYXRpb25JZCxcbiAgICAgICAgICAgIFtwYWdlUGFyYW1zLmVycm9yXTogcmVzdWx0LmVycixcbiAgICAgICAgICAgIFtwYWdlUGFyYW1zLmFwcE5hbWVdOiBjb25maWcuYXBwTmFtZSxcbiAgICAgICAgICB9O1xuICAgICAgICBjb25zdCBwYWdlID0gcmVzdWx0LnN1Y2Nlc3MgPyBwYWdlcy5wYXNzd29yZFJlc2V0U3VjY2VzcyA6IHBhZ2VzLnBhc3N3b3JkUmVzZXQ7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuZ29Ub1BhZ2UocmVxLCBwYWdlLCBxdWVyeSwgZmFsc2UpO1xuICAgICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBwYWdlIGNvbnRlbnQgaWYgdGhlIHBhZ2UgaXMgYSBsb2NhbCBmaWxlIG9yIHJldHVybnMgYVxuICAgKiByZWRpcmVjdCB0byBhIGN1c3RvbSBwYWdlLlxuICAgKiBAcGFyYW0ge09iamVjdH0gcmVxIFRoZSBleHByZXNzIHJlcXVlc3QuXG4gICAqIEBwYXJhbSB7UGFnZX0gcGFnZSBUaGUgcGFnZSB0byBnbyB0by5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtwYXJhbXM9e31dIFRoZSBxdWVyeSBwYXJhbWV0ZXJzIHRvIGF0dGFjaCB0byB0aGUgVVJMIGluIGNhc2Ugb2ZcbiAgICogSFRUUCByZWRpcmVjdCByZXNwb25zZXMgZm9yIFBPU1QgcmVxdWVzdHMsIG9yIHRoZSBwbGFjZWhvbGRlcnMgdG8gZmlsbCBpbnRvXG4gICAqIHRoZSByZXNwb25zZSBjb250ZW50IGluIGNhc2Ugb2YgSFRUUCBjb250ZW50IHJlc3BvbnNlcyBmb3IgR0VUIHJlcXVlc3RzLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IFtyZXNwb25zZVR5cGVdIElzIHRydWUgaWYgYSByZWRpcmVjdCByZXNwb25zZSBzaG91bGQgYmUgZm9yY2VkLFxuICAgKiBmYWxzZSBpZiBhIGNvbnRlbnQgcmVzcG9uc2Ugc2hvdWxkIGJlIGZvcmNlZCwgdW5kZWZpbmVkIGlmIHRoZSByZXNwb25zZSB0eXBlXG4gICAqIHNob3VsZCBkZXBlbmQgb24gdGhlIHJlcXVlc3QgdHlwZSBieSBkZWZhdWx0OlxuICAgKiAtIEdFVCByZXF1ZXN0IC0+IGNvbnRlbnQgcmVzcG9uc2VcbiAgICogLSBQT1NUIHJlcXVlc3QgLT4gcmVkaXJlY3QgcmVzcG9uc2UgKFBSRyBwYXR0ZXJuKVxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxPYmplY3Q+fSBUaGUgZXhwcmVzcyByZXNwb25zZS5cbiAgICovXG4gIGdvVG9QYWdlKHJlcSwgcGFnZSwgcGFyYW1zID0ge30sIHJlc3BvbnNlVHlwZSkge1xuICAgIGNvbnN0IGNvbmZpZyA9IHJlcS5jb25maWc7XG5cbiAgICAvLyBEZXRlcm1pbmUgcmVkaXJlY3QgZWl0aGVyIGJ5IGZvcmNlLCByZXNwb25zZSBzZXR0aW5nIG9yIHJlcXVlc3QgbWV0aG9kXG4gICAgY29uc3QgcmVkaXJlY3QgPSBjb25maWcucGFnZXMuZm9yY2VSZWRpcmVjdFxuICAgICAgPyB0cnVlXG4gICAgICA6IHJlc3BvbnNlVHlwZSAhPT0gdW5kZWZpbmVkXG4gICAgICAgID8gcmVzcG9uc2VUeXBlXG4gICAgICAgIDogcmVxLm1ldGhvZCA9PSAnUE9TVCc7XG5cbiAgICAvLyBJbmNsdWRlIGRlZmF1bHQgcGFyYW1ldGVyc1xuICAgIGNvbnN0IGRlZmF1bHRQYXJhbXMgPSB7XG4gICAgICBbcGFnZVBhcmFtcy5hcHBJZF06IGNvbmZpZy5hcHBJZCxcbiAgICAgIFtwYWdlUGFyYW1zLmFwcE5hbWVdOiBjb25maWcuYXBwTmFtZSxcbiAgICAgIFtwYWdlUGFyYW1zLnB1YmxpY1NlcnZlclVybF06IGNvbmZpZy5wdWJsaWNTZXJ2ZXJVUkwsXG4gICAgfTtcbiAgICBpZiAoT2JqZWN0LnZhbHVlcyhkZWZhdWx0UGFyYW1zKS5pbmNsdWRlcyh1bmRlZmluZWQpKSB7XG4gICAgICByZXR1cm4gdGhpcy5ub3RGb3VuZCgpO1xuICAgIH1cbiAgICBwYXJhbXMgPSBPYmplY3QuYXNzaWduKHBhcmFtcywgZGVmYXVsdFBhcmFtcyk7XG5cbiAgICAvLyBBZGQgbG9jYWxlIHRvIHBhcmFtcyB0byBlbnN1cmUgaXQgaXMgcGFzc2VkIG9uIHdpdGggZXZlcnkgcmVxdWVzdDtcbiAgICAvLyB0aGF0IG1lYW5zLCBvbmNlIGEgbG9jYWxlIGlzIHNldCwgaXQgaXMgcGFzc2VkIG9uIHRvIGFueSBmb2xsb3ctdXAgcGFnZSxcbiAgICAvLyBlLmcuIHJlcXVlc3RfcGFzc3dvcmRfcmVzZXQgLT4gcGFzc3dvcmRfcmVzZXQgLT4gcGFzc3dvcnRfcmVzZXRfc3VjY2Vzc1xuICAgIGNvbnN0IGxvY2FsZSA9XG4gICAgICAocmVxLnF1ZXJ5IHx8IHt9KVtwYWdlUGFyYW1zLmxvY2FsZV1cbiAgICAgIHx8IChyZXEuYm9keSB8fCB7fSlbcGFnZVBhcmFtcy5sb2NhbGVdXG4gICAgICB8fCAocmVxLnBhcmFtcyB8fCB7fSlbcGFnZVBhcmFtcy5sb2NhbGVdXG4gICAgICB8fCAocmVxLmhlYWRlcnMgfHwge30pW3BhZ2VQYXJhbUhlYWRlclByZWZpeCArIHBhZ2VQYXJhbXMubG9jYWxlXTtcbiAgICBwYXJhbXNbcGFnZVBhcmFtcy5sb2NhbGVdID0gbG9jYWxlO1xuXG4gICAgLy8gQ29tcG9zZSBwYXRocyBhbmQgVVJMc1xuICAgIGNvbnN0IGRlZmF1bHRGaWxlID0gcGFnZS5kZWZhdWx0RmlsZTtcbiAgICBjb25zdCBkZWZhdWx0UGF0aCA9IHRoaXMuZGVmYXVsdFBhZ2VQYXRoKGRlZmF1bHRGaWxlKTtcbiAgICBjb25zdCBkZWZhdWx0VXJsID0gdGhpcy5jb21wb3NlUGFnZVVybChkZWZhdWx0RmlsZSwgY29uZmlnLnB1YmxpY1NlcnZlclVSTCk7XG5cbiAgICAvLyBJZiBjdXN0b20gVVJMIGlzIHNldCByZWRpcmVjdCB0byBpdCB3aXRob3V0IGxvY2FsaXphdGlvblxuICAgIGNvbnN0IGN1c3RvbVVybCA9IGNvbmZpZy5wYWdlcy5jdXN0b21VcmxzW3BhZ2UuaWRdO1xuICAgIGlmIChjdXN0b21VcmwgJiYgIVV0aWxzLmlzUGF0aChjdXN0b21VcmwpKSB7XG4gICAgICByZXR1cm4gdGhpcy5yZWRpcmVjdFJlc3BvbnNlKGN1c3RvbVVybCwgcGFyYW1zKTtcbiAgICB9XG5cbiAgICAvLyBJZiBsb2NhbGl6YXRpb24gaXMgZW5hYmxlZFxuICAgIGlmIChjb25maWcucGFnZXMuZW5hYmxlTG9jYWxpemF0aW9uICYmIGxvY2FsZSkge1xuICAgICAgcmV0dXJuIFV0aWxzLmdldExvY2FsaXplZFBhdGgoZGVmYXVsdFBhdGgsIGxvY2FsZSkudGhlbigoeyBwYXRoLCBzdWJkaXIgfSkgPT5cbiAgICAgICAgcmVkaXJlY3RcbiAgICAgICAgICA/IHRoaXMucmVkaXJlY3RSZXNwb25zZSh0aGlzLmNvbXBvc2VQYWdlVXJsKGRlZmF1bHRGaWxlLCBjb25maWcucHVibGljU2VydmVyVVJMLCBzdWJkaXIpLCBwYXJhbXMpXG4gICAgICAgICAgOiB0aGlzLnBhZ2VSZXNwb25zZShwYXRoLCBwYXJhbXMpXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVkaXJlY3RcbiAgICAgICAgPyB0aGlzLnJlZGlyZWN0UmVzcG9uc2UoZGVmYXVsdFVybCwgcGFyYW1zKVxuICAgICAgICA6IHRoaXMucGFnZVJlc3BvbnNlKGRlZmF1bHRQYXRoLCBwYXJhbXMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgcmVzcG9uc2Ugd2l0aCBmaWxlIGNvbnRlbnQuXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIFRoZSBwYXRoIG9mIHRoZSBmaWxlIHRvIHJldHVybi5cbiAgICogQHBhcmFtIHtPYmplY3R9IHBsYWNlaG9sZGVycyBUaGUgcGxhY2Vob2xkZXJzIHRvIGZpbGwgaW4gdGhlXG4gICAqIGNvbnRlbnQuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFRoZSBQcm9taXNlIFJvdXRlciByZXNwb25zZS5cbiAgICovXG4gIGFzeW5jIHBhZ2VSZXNwb25zZShwYXRoLCBwbGFjZWhvbGRlcnMpIHtcbiAgICAvLyBHZXQgZmlsZSBjb250ZW50XG4gICAgbGV0IGRhdGE7XG4gICAgdHJ5IHtcbiAgICAgIGRhdGEgPSBhd2FpdCBmcy5yZWFkRmlsZShwYXRoLCAndXRmLTgnKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gdGhpcy5ub3RGb3VuZCgpO1xuICAgIH1cblxuICAgIC8vIEZpbGwgcGxhY2Vob2xkZXJzXG4gICAgZGF0YSA9IG11c3RhY2hlLnJlbmRlcihkYXRhLCBwbGFjZWhvbGRlcnMpO1xuXG4gICAgLy8gQWRkIHBsYWNlaG9sZXJzIGluIGhlYWRlciB0byBhbGxvdyBwYXJzaW5nIGZvciBwcm9ncmFtbWF0aWMgdXNlXG4gICAgLy8gb2YgcmVzcG9uc2UsIGluc3RlYWQgb2YgaGF2aW5nIHRvIHBhcnNlIHRoZSBIVE1MIGNvbnRlbnQuXG4gICAgY29uc3QgaGVhZGVycyA9IE9iamVjdC5lbnRyaWVzKHBsYWNlaG9sZGVycykucmVkdWNlKChtLCBwKSA9PiB7XG4gICAgICBpZiAocFsxXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG1bYCR7cGFnZVBhcmFtSGVhZGVyUHJlZml4fSR7cFswXS50b0xvd2VyQ2FzZSgpfWBdID0gcFsxXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtO1xuICAgIH0sIHt9KTtcblxuICAgIHJldHVybiB7IHRleHQ6IGRhdGEsIGhlYWRlcnM6IGhlYWRlcnMgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgcmVzcG9uc2Ugd2l0aCBodHRwIHJlZGlyZXQuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXEgVGhlIGV4cHJlc3MgcmVxdWVzdC5cbiAgICogQHBhcmFtIHtTdHJpbmd9IHBhdGggVGhlIHBhdGggb2YgdGhlIGZpbGUgdG8gcmV0dXJuLlxuICAgKiBAcGFyYW0ge09iamVjdH0gcGFyYW1zIFRoZSBxdWVyeSBwYXJhbWV0ZXJzIHRvIGluY2x1ZGUuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFRoZSBQcm9taXNlIFJvdXRlciByZXNwb25zZS5cbiAgICovXG4gIGFzeW5jIHJlZGlyZWN0UmVzcG9uc2UodXJsLCBwYXJhbXMpIHtcbiAgICAvLyBSZW1vdmUgYW55IHBhcmFtZXRlcnMgd2l0aCB1bmRlZmluZWQgdmFsdWVcbiAgICBwYXJhbXMgPSBPYmplY3QuZW50cmllcyhwYXJhbXMpLnJlZHVjZSgobSwgcCkgPT4ge1xuICAgICAgaWYgKHBbMV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBtW3BbMF1dID0gcFsxXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtO1xuICAgIH0sIHt9KTtcblxuICAgIC8vIENvbXBvc2UgVVJMIHdpdGggcGFyYW1ldGVycyBpbiBxdWVyeVxuICAgIGNvbnN0IGxvY2F0aW9uID0gbmV3IFVSTCh1cmwpO1xuICAgIE9iamVjdC5lbnRyaWVzKHBhcmFtcykuZm9yRWFjaChwID0+IGxvY2F0aW9uLnNlYXJjaFBhcmFtcy5zZXQocFswXSwgcFsxXSkpO1xuICAgIGNvbnN0IGxvY2F0aW9uU3RyaW5nID0gbG9jYXRpb24udG9TdHJpbmcoKTtcblxuICAgIC8vIEFkZCBwYXJhbWV0ZXJzIHRvIGhlYWRlciB0byBhbGxvdyBwYXJzaW5nIGZvciBwcm9ncmFtbWF0aWMgdXNlXG4gICAgLy8gb2YgcmVzcG9uc2UsIGluc3RlYWQgb2YgaGF2aW5nIHRvIHBhcnNlIHRoZSBIVE1MIGNvbnRlbnQuXG4gICAgY29uc3QgaGVhZGVycyA9IE9iamVjdC5lbnRyaWVzKHBhcmFtcykucmVkdWNlKChtLCBwKSA9PiB7XG4gICAgICBpZiAocFsxXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG1bYCR7cGFnZVBhcmFtSGVhZGVyUHJlZml4fSR7cFswXS50b0xvd2VyQ2FzZSgpfWBdID0gcFsxXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtO1xuICAgIH0sIHt9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXM6IDMwMyxcbiAgICAgIGxvY2F0aW9uOiBsb2NhdGlvblN0cmluZyxcbiAgICAgIGhlYWRlcnM6IGhlYWRlcnMsXG4gICAgfTtcbiAgfVxuXG4gIGRlZmF1bHRQYWdlUGF0aChmaWxlKSB7XG4gICAgcmV0dXJuIHBhdGguam9pbih0aGlzLnBhZ2VzUGF0aCwgZmlsZSk7XG4gIH1cblxuICBjb21wb3NlUGFnZVVybChmaWxlLCBwdWJsaWNTZXJ2ZXJVcmwsIGxvY2FsZSkge1xuICAgIGxldCB1cmwgPSBwdWJsaWNTZXJ2ZXJVcmw7XG4gICAgdXJsICs9IHVybC5lbmRzV2l0aCgnLycpID8gJycgOiAnLyc7XG4gICAgdXJsICs9IHRoaXMucGFnZXNFbmRwb2ludCArICcvJztcbiAgICB1cmwgKz0gbG9jYWxlID09PSB1bmRlZmluZWQgPyAnJyA6IGxvY2FsZSArICcvJztcbiAgICB1cmwgKz0gZmlsZTtcbiAgICByZXR1cm4gdXJsO1xuICB9XG5cbiAgbm90Rm91bmQoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRleHQ6ICdOb3QgZm91bmQuJyxcbiAgICAgIHN0YXR1czogNDA0LFxuICAgIH07XG4gIH1cblxuICBpbnZhbGlkUmVxdWVzdCgpIHtcbiAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcigpO1xuICAgIGVycm9yLnN0YXR1cyA9IDQwMztcbiAgICBlcnJvci5tZXNzYWdlID0gJ3VuYXV0aG9yaXplZCc7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cblxuICBzZXRDb25maWcocmVxKSB7XG4gICAgcmVxLmNvbmZpZyA9IENvbmZpZy5nZXQocmVxLnBhcmFtcy5hcHBJZCB8fCByZXEucXVlcnkuYXBwSWQpO1xuICAgIGlmICghcmVxLmNvbmZpZykge1xuICAgICAgdGhpcy5pbnZhbGlkUmVxdWVzdCgpO1xuICAgIH1cbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cblxuICBtb3VudFBhZ2VzUm91dGVzKCkge1xuICAgIHRoaXMucm91dGUoXG4gICAgICAnR0VUJyxcbiAgICAgIGAvJHt0aGlzLnBhZ2VzRW5kcG9pbnR9LzphcHBJZC92ZXJpZnlfZW1haWxgLFxuICAgICAgcmVxID0+IHtcbiAgICAgICAgdGhpcy5zZXRDb25maWcocmVxKTtcbiAgICAgIH0sXG4gICAgICByZXEgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy52ZXJpZnlFbWFpbChyZXEpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICB0aGlzLnJvdXRlKFxuICAgICAgJ1BPU1QnLFxuICAgICAgYC8ke3RoaXMucGFnZXNFbmRwb2ludH0vOmFwcElkL3Jlc2VuZF92ZXJpZmljYXRpb25fZW1haWxgLFxuICAgICAgcmVxID0+IHtcbiAgICAgICAgdGhpcy5zZXRDb25maWcocmVxKTtcbiAgICAgIH0sXG4gICAgICByZXEgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5yZXNlbmRWZXJpZmljYXRpb25FbWFpbChyZXEpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICB0aGlzLnJvdXRlKFxuICAgICAgJ0dFVCcsXG4gICAgICBgLyR7dGhpcy5wYWdlc0VuZHBvaW50fS9jaG9vc2VfcGFzc3dvcmRgLFxuICAgICAgcmVxID0+IHtcbiAgICAgICAgdGhpcy5zZXRDb25maWcocmVxKTtcbiAgICAgIH0sXG4gICAgICByZXEgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXNzd29yZFJlc2V0KHJlcSk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIHRoaXMucm91dGUoXG4gICAgICAnUE9TVCcsXG4gICAgICBgLyR7dGhpcy5wYWdlc0VuZHBvaW50fS86YXBwSWQvcmVxdWVzdF9wYXNzd29yZF9yZXNldGAsXG4gICAgICByZXEgPT4ge1xuICAgICAgICB0aGlzLnNldENvbmZpZyhyZXEpO1xuICAgICAgfSxcbiAgICAgIHJlcSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlc2V0UGFzc3dvcmQocmVxKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgdGhpcy5yb3V0ZShcbiAgICAgICdHRVQnLFxuICAgICAgYC8ke3RoaXMucGFnZXNFbmRwb2ludH0vOmFwcElkL3JlcXVlc3RfcGFzc3dvcmRfcmVzZXRgLFxuICAgICAgcmVxID0+IHtcbiAgICAgICAgdGhpcy5zZXRDb25maWcocmVxKTtcbiAgICAgIH0sXG4gICAgICByZXEgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0UmVzZXRQYXNzd29yZChyZXEpO1xuICAgICAgfVxuICAgICk7XG4gIH1cblxuICBleHByZXNzUm91dGVyKCkge1xuICAgIGNvbnN0IHJvdXRlciA9IGV4cHJlc3MuUm91dGVyKCk7XG4gICAgcm91dGVyLnVzZShgLyR7dGhpcy5wYWdlc0VuZHBvaW50fWAsIGV4cHJlc3Muc3RhdGljKHRoaXMucGFnZXNQYXRoKSk7XG4gICAgcm91dGVyLnVzZSgnLycsIHN1cGVyLmV4cHJlc3NSb3V0ZXIoKSk7XG4gICAgcmV0dXJuIHJvdXRlcjtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQYWdlc1JvdXRlcjtcbm1vZHVsZS5leHBvcnRzID0ge1xuICBQYWdlc1JvdXRlcixcbiAgcGFnZVBhcmFtcyxcbiAgcGFnZXMsXG59O1xuIl19