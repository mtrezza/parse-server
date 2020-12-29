"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.IdempotencyRouter = void 0;

var _ClassesRouter = _interopRequireDefault(require("./ClassesRouter"));

var middleware = _interopRequireWildcard(require("../middlewares"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class IdempotencyRouter extends _ClassesRouter.default {
  className() {
    return '_Idempotency';
  }

  mountRoutes() {
    this.route('POST', '/idempotency', middleware.promiseEnforceMasterKeyAccess, req => {
      return this.handleCreate(req);
    });
  }

}

exports.IdempotencyRouter = IdempotencyRouter;
var _default = IdempotencyRouter;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9Sb3V0ZXJzL0lkZW1wb2RlbmN5Um91dGVyLmpzIl0sIm5hbWVzIjpbIklkZW1wb3RlbmN5Um91dGVyIiwiQ2xhc3Nlc1JvdXRlciIsImNsYXNzTmFtZSIsIm1vdW50Um91dGVzIiwicm91dGUiLCJtaWRkbGV3YXJlIiwicHJvbWlzZUVuZm9yY2VNYXN0ZXJLZXlBY2Nlc3MiLCJyZXEiLCJoYW5kbGVDcmVhdGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7QUFDQTs7Ozs7Ozs7QUFFTyxNQUFNQSxpQkFBTixTQUFnQ0Msc0JBQWhDLENBQThDO0FBQ25EQyxFQUFBQSxTQUFTLEdBQUc7QUFDVixXQUFPLGNBQVA7QUFDRDs7QUFFREMsRUFBQUEsV0FBVyxHQUFHO0FBQ1osU0FBS0MsS0FBTCxDQUNFLE1BREYsRUFFRSxjQUZGLEVBR0VDLFVBQVUsQ0FBQ0MsNkJBSGIsRUFJRUMsR0FBRyxJQUFJO0FBQ0wsYUFBTyxLQUFLQyxZQUFMLENBQWtCRCxHQUFsQixDQUFQO0FBQ0QsS0FOSDtBQVFEOztBQWRrRDs7O2VBaUJ0Q1AsaUIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgQ2xhc3Nlc1JvdXRlciBmcm9tICcuL0NsYXNzZXNSb3V0ZXInO1xuaW1wb3J0ICogYXMgbWlkZGxld2FyZSBmcm9tICcuLi9taWRkbGV3YXJlcyc7XG5cbmV4cG9ydCBjbGFzcyBJZGVtcG90ZW5jeVJvdXRlciBleHRlbmRzIENsYXNzZXNSb3V0ZXIge1xuICBjbGFzc05hbWUoKSB7XG4gICAgcmV0dXJuICdfSWRlbXBvdGVuY3knO1xuICB9XG5cbiAgbW91bnRSb3V0ZXMoKSB7XG4gICAgdGhpcy5yb3V0ZShcbiAgICAgICdQT1NUJyxcbiAgICAgICcvaWRlbXBvdGVuY3knLFxuICAgICAgbWlkZGxld2FyZS5wcm9taXNlRW5mb3JjZU1hc3RlcktleUFjY2VzcyxcbiAgICAgIHJlcSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLmhhbmRsZUNyZWF0ZShyZXEpO1xuICAgICAgfVxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSWRlbXBvdGVuY3lSb3V0ZXI7XG4iXX0=