"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.SecurityRouter = void 0;

var _PromiseRouter = _interopRequireDefault(require("../PromiseRouter"));

var middleware = _interopRequireWildcard(require("../middlewares"));

var _CheckRunner = _interopRequireDefault(require("../Security/CheckRunner"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class SecurityRouter extends _PromiseRouter.default {
  mountRoutes() {
    this.route('GET', '/security', middleware.promiseEnforceMasterKeyAccess, this._enforceSecurityCheckEnabled, async req => {
      const report = await new _CheckRunner.default(req.config.security).run();
      return {
        status: 200,
        response: report
      };
    });
  }

  async _enforceSecurityCheckEnabled(req) {
    const config = req.config;

    if (!config.security || !config.security.enableCheck) {
      const error = new Error();
      error.status = 409;
      error.message = 'Enable Parse Server option `security.enableCheck` to run security check.';
      throw error;
    }
  }

}

exports.SecurityRouter = SecurityRouter;
var _default = SecurityRouter;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9Sb3V0ZXJzL1NlY3VyaXR5Um91dGVyLmpzIl0sIm5hbWVzIjpbIlNlY3VyaXR5Um91dGVyIiwiUHJvbWlzZVJvdXRlciIsIm1vdW50Um91dGVzIiwicm91dGUiLCJtaWRkbGV3YXJlIiwicHJvbWlzZUVuZm9yY2VNYXN0ZXJLZXlBY2Nlc3MiLCJfZW5mb3JjZVNlY3VyaXR5Q2hlY2tFbmFibGVkIiwicmVxIiwicmVwb3J0IiwiQ2hlY2tSdW5uZXIiLCJjb25maWciLCJzZWN1cml0eSIsInJ1biIsInN0YXR1cyIsInJlc3BvbnNlIiwiZW5hYmxlQ2hlY2siLCJlcnJvciIsIkVycm9yIiwibWVzc2FnZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOztBQUNBOztBQUNBOzs7Ozs7OztBQUVPLE1BQU1BLGNBQU4sU0FBNkJDLHNCQUE3QixDQUEyQztBQUNoREMsRUFBQUEsV0FBVyxHQUFHO0FBQ1osU0FBS0MsS0FBTCxDQUFXLEtBQVgsRUFBa0IsV0FBbEIsRUFDRUMsVUFBVSxDQUFDQyw2QkFEYixFQUVFLEtBQUtDLDRCQUZQLEVBR0UsTUFBT0MsR0FBUCxJQUFlO0FBQ2IsWUFBTUMsTUFBTSxHQUFHLE1BQU0sSUFBSUMsb0JBQUosQ0FBZ0JGLEdBQUcsQ0FBQ0csTUFBSixDQUFXQyxRQUEzQixFQUFxQ0MsR0FBckMsRUFBckI7QUFDQSxhQUFPO0FBQ0xDLFFBQUFBLE1BQU0sRUFBRSxHQURIO0FBRUxDLFFBQUFBLFFBQVEsRUFBRU47QUFGTCxPQUFQO0FBSUQsS0FUSDtBQVdEOztBQUVELFFBQU1GLDRCQUFOLENBQW1DQyxHQUFuQyxFQUF3QztBQUN0QyxVQUFNRyxNQUFNLEdBQUdILEdBQUcsQ0FBQ0csTUFBbkI7O0FBQ0EsUUFBSSxDQUFDQSxNQUFNLENBQUNDLFFBQVIsSUFBb0IsQ0FBQ0QsTUFBTSxDQUFDQyxRQUFQLENBQWdCSSxXQUF6QyxFQUFzRDtBQUNwRCxZQUFNQyxLQUFLLEdBQUcsSUFBSUMsS0FBSixFQUFkO0FBQ0FELE1BQUFBLEtBQUssQ0FBQ0gsTUFBTixHQUFlLEdBQWY7QUFDQUcsTUFBQUEsS0FBSyxDQUFDRSxPQUFOLEdBQWdCLDBFQUFoQjtBQUNBLFlBQU1GLEtBQU47QUFDRDtBQUNGOztBQXZCK0M7OztlQTBCbkNoQixjIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFByb21pc2VSb3V0ZXIgZnJvbSAnLi4vUHJvbWlzZVJvdXRlcic7XG5pbXBvcnQgKiBhcyBtaWRkbGV3YXJlIGZyb20gJy4uL21pZGRsZXdhcmVzJztcbmltcG9ydCBDaGVja1J1bm5lciBmcm9tICcuLi9TZWN1cml0eS9DaGVja1J1bm5lcic7XG5cbmV4cG9ydCBjbGFzcyBTZWN1cml0eVJvdXRlciBleHRlbmRzIFByb21pc2VSb3V0ZXIge1xuICBtb3VudFJvdXRlcygpIHtcbiAgICB0aGlzLnJvdXRlKCdHRVQnLCAnL3NlY3VyaXR5JyxcbiAgICAgIG1pZGRsZXdhcmUucHJvbWlzZUVuZm9yY2VNYXN0ZXJLZXlBY2Nlc3MsXG4gICAgICB0aGlzLl9lbmZvcmNlU2VjdXJpdHlDaGVja0VuYWJsZWQsXG4gICAgICBhc3luYyAocmVxKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlcG9ydCA9IGF3YWl0IG5ldyBDaGVja1J1bm5lcihyZXEuY29uZmlnLnNlY3VyaXR5KS5ydW4oKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdGF0dXM6IDIwMCxcbiAgICAgICAgICByZXNwb25zZTogcmVwb3J0LFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICk7XG4gIH1cblxuICBhc3luYyBfZW5mb3JjZVNlY3VyaXR5Q2hlY2tFbmFibGVkKHJlcSkge1xuICAgIGNvbnN0IGNvbmZpZyA9IHJlcS5jb25maWc7XG4gICAgaWYgKCFjb25maWcuc2VjdXJpdHkgfHwgIWNvbmZpZy5zZWN1cml0eS5lbmFibGVDaGVjaykge1xuICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoKTtcbiAgICAgIGVycm9yLnN0YXR1cyA9IDQwOTtcbiAgICAgIGVycm9yLm1lc3NhZ2UgPSAnRW5hYmxlIFBhcnNlIFNlcnZlciBvcHRpb24gYHNlY3VyaXR5LmVuYWJsZUNoZWNrYCB0byBydW4gc2VjdXJpdHkgY2hlY2suJztcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBTZWN1cml0eVJvdXRlcjtcbiJdfQ==