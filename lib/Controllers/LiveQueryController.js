"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.LiveQueryController = void 0;

var _ParseCloudCodePublisher = require("../LiveQuery/ParseCloudCodePublisher");

var _Options = require("../Options");

class LiveQueryController {
  constructor(config) {
    // If config is empty, we just assume no classs needs to be registered as LiveQuery
    if (!config || !config.classNames) {
      this.classNames = new Set();
    } else if (config.classNames instanceof Array) {
      this.classNames = new Set(config.classNames);
    } else {
      throw 'liveQuery.classes should be an array of string';
    }

    this.liveQueryPublisher = new _ParseCloudCodePublisher.ParseCloudCodePublisher(config);
  }

  onAfterSave(className, currentObject, originalObject, classLevelPermissions) {
    if (!this.hasLiveQuery(className)) {
      return;
    }

    const req = this._makePublisherRequest(currentObject, originalObject, classLevelPermissions);

    this.liveQueryPublisher.onCloudCodeAfterSave(req);
  }

  onAfterDelete(className, currentObject, originalObject, classLevelPermissions) {
    if (!this.hasLiveQuery(className)) {
      return;
    }

    const req = this._makePublisherRequest(currentObject, originalObject, classLevelPermissions);

    this.liveQueryPublisher.onCloudCodeAfterDelete(req);
  }

  hasLiveQuery(className) {
    return this.classNames.has(className);
  }

  _makePublisherRequest(currentObject, originalObject, classLevelPermissions) {
    const req = {
      object: currentObject
    };

    if (currentObject) {
      req.original = originalObject;
    }

    if (classLevelPermissions) {
      req.classLevelPermissions = classLevelPermissions;
    }

    return req;
  }

}

exports.LiveQueryController = LiveQueryController;
var _default = LiveQueryController;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9Db250cm9sbGVycy9MaXZlUXVlcnlDb250cm9sbGVyLmpzIl0sIm5hbWVzIjpbIkxpdmVRdWVyeUNvbnRyb2xsZXIiLCJjb25zdHJ1Y3RvciIsImNvbmZpZyIsImNsYXNzTmFtZXMiLCJTZXQiLCJBcnJheSIsImxpdmVRdWVyeVB1Ymxpc2hlciIsIlBhcnNlQ2xvdWRDb2RlUHVibGlzaGVyIiwib25BZnRlclNhdmUiLCJjbGFzc05hbWUiLCJjdXJyZW50T2JqZWN0Iiwib3JpZ2luYWxPYmplY3QiLCJjbGFzc0xldmVsUGVybWlzc2lvbnMiLCJoYXNMaXZlUXVlcnkiLCJyZXEiLCJfbWFrZVB1Ymxpc2hlclJlcXVlc3QiLCJvbkNsb3VkQ29kZUFmdGVyU2F2ZSIsIm9uQWZ0ZXJEZWxldGUiLCJvbkNsb3VkQ29kZUFmdGVyRGVsZXRlIiwiaGFzIiwib2JqZWN0Iiwib3JpZ2luYWwiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7QUFDQTs7QUFDTyxNQUFNQSxtQkFBTixDQUEwQjtBQUkvQkMsRUFBQUEsV0FBVyxDQUFDQyxNQUFELEVBQTRCO0FBQ3JDO0FBQ0EsUUFBSSxDQUFDQSxNQUFELElBQVcsQ0FBQ0EsTUFBTSxDQUFDQyxVQUF2QixFQUFtQztBQUNqQyxXQUFLQSxVQUFMLEdBQWtCLElBQUlDLEdBQUosRUFBbEI7QUFDRCxLQUZELE1BRU8sSUFBSUYsTUFBTSxDQUFDQyxVQUFQLFlBQTZCRSxLQUFqQyxFQUF3QztBQUM3QyxXQUFLRixVQUFMLEdBQWtCLElBQUlDLEdBQUosQ0FBUUYsTUFBTSxDQUFDQyxVQUFmLENBQWxCO0FBQ0QsS0FGTSxNQUVBO0FBQ0wsWUFBTSxnREFBTjtBQUNEOztBQUNELFNBQUtHLGtCQUFMLEdBQTBCLElBQUlDLGdEQUFKLENBQTRCTCxNQUE1QixDQUExQjtBQUNEOztBQUVETSxFQUFBQSxXQUFXLENBQ1RDLFNBRFMsRUFFVEMsYUFGUyxFQUdUQyxjQUhTLEVBSVRDLHFCQUpTLEVBS1Q7QUFDQSxRQUFJLENBQUMsS0FBS0MsWUFBTCxDQUFrQkosU0FBbEIsQ0FBTCxFQUFtQztBQUNqQztBQUNEOztBQUNELFVBQU1LLEdBQUcsR0FBRyxLQUFLQyxxQkFBTCxDQUEyQkwsYUFBM0IsRUFBMENDLGNBQTFDLEVBQTBEQyxxQkFBMUQsQ0FBWjs7QUFDQSxTQUFLTixrQkFBTCxDQUF3QlUsb0JBQXhCLENBQTZDRixHQUE3QztBQUNEOztBQUVERyxFQUFBQSxhQUFhLENBQ1hSLFNBRFcsRUFFWEMsYUFGVyxFQUdYQyxjQUhXLEVBSVhDLHFCQUpXLEVBS1g7QUFDQSxRQUFJLENBQUMsS0FBS0MsWUFBTCxDQUFrQkosU0FBbEIsQ0FBTCxFQUFtQztBQUNqQztBQUNEOztBQUNELFVBQU1LLEdBQUcsR0FBRyxLQUFLQyxxQkFBTCxDQUEyQkwsYUFBM0IsRUFBMENDLGNBQTFDLEVBQTBEQyxxQkFBMUQsQ0FBWjs7QUFDQSxTQUFLTixrQkFBTCxDQUF3Qlksc0JBQXhCLENBQStDSixHQUEvQztBQUNEOztBQUVERCxFQUFBQSxZQUFZLENBQUNKLFNBQUQsRUFBNkI7QUFDdkMsV0FBTyxLQUFLTixVQUFMLENBQWdCZ0IsR0FBaEIsQ0FBb0JWLFNBQXBCLENBQVA7QUFDRDs7QUFFRE0sRUFBQUEscUJBQXFCLENBQUNMLGFBQUQsRUFBcUJDLGNBQXJCLEVBQTBDQyxxQkFBMUMsRUFBNEU7QUFDL0YsVUFBTUUsR0FBRyxHQUFHO0FBQ1ZNLE1BQUFBLE1BQU0sRUFBRVY7QUFERSxLQUFaOztBQUdBLFFBQUlBLGFBQUosRUFBbUI7QUFDakJJLE1BQUFBLEdBQUcsQ0FBQ08sUUFBSixHQUFlVixjQUFmO0FBQ0Q7O0FBQ0QsUUFBSUMscUJBQUosRUFBMkI7QUFDekJFLE1BQUFBLEdBQUcsQ0FBQ0YscUJBQUosR0FBNEJBLHFCQUE1QjtBQUNEOztBQUNELFdBQU9FLEdBQVA7QUFDRDs7QUF6RDhCOzs7ZUE0RGxCZCxtQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFBhcnNlQ2xvdWRDb2RlUHVibGlzaGVyIH0gZnJvbSAnLi4vTGl2ZVF1ZXJ5L1BhcnNlQ2xvdWRDb2RlUHVibGlzaGVyJztcbmltcG9ydCB7IExpdmVRdWVyeU9wdGlvbnMgfSBmcm9tICcuLi9PcHRpb25zJztcbmV4cG9ydCBjbGFzcyBMaXZlUXVlcnlDb250cm9sbGVyIHtcbiAgY2xhc3NOYW1lczogYW55O1xuICBsaXZlUXVlcnlQdWJsaXNoZXI6IGFueTtcblxuICBjb25zdHJ1Y3Rvcihjb25maWc6ID9MaXZlUXVlcnlPcHRpb25zKSB7XG4gICAgLy8gSWYgY29uZmlnIGlzIGVtcHR5LCB3ZSBqdXN0IGFzc3VtZSBubyBjbGFzc3MgbmVlZHMgdG8gYmUgcmVnaXN0ZXJlZCBhcyBMaXZlUXVlcnlcbiAgICBpZiAoIWNvbmZpZyB8fCAhY29uZmlnLmNsYXNzTmFtZXMpIHtcbiAgICAgIHRoaXMuY2xhc3NOYW1lcyA9IG5ldyBTZXQoKTtcbiAgICB9IGVsc2UgaWYgKGNvbmZpZy5jbGFzc05hbWVzIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgIHRoaXMuY2xhc3NOYW1lcyA9IG5ldyBTZXQoY29uZmlnLmNsYXNzTmFtZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyAnbGl2ZVF1ZXJ5LmNsYXNzZXMgc2hvdWxkIGJlIGFuIGFycmF5IG9mIHN0cmluZyc7XG4gICAgfVxuICAgIHRoaXMubGl2ZVF1ZXJ5UHVibGlzaGVyID0gbmV3IFBhcnNlQ2xvdWRDb2RlUHVibGlzaGVyKGNvbmZpZyk7XG4gIH1cblxuICBvbkFmdGVyU2F2ZShcbiAgICBjbGFzc05hbWU6IHN0cmluZyxcbiAgICBjdXJyZW50T2JqZWN0OiBhbnksXG4gICAgb3JpZ2luYWxPYmplY3Q6IGFueSxcbiAgICBjbGFzc0xldmVsUGVybWlzc2lvbnM6ID9hbnlcbiAgKSB7XG4gICAgaWYgKCF0aGlzLmhhc0xpdmVRdWVyeShjbGFzc05hbWUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHJlcSA9IHRoaXMuX21ha2VQdWJsaXNoZXJSZXF1ZXN0KGN1cnJlbnRPYmplY3QsIG9yaWdpbmFsT2JqZWN0LCBjbGFzc0xldmVsUGVybWlzc2lvbnMpO1xuICAgIHRoaXMubGl2ZVF1ZXJ5UHVibGlzaGVyLm9uQ2xvdWRDb2RlQWZ0ZXJTYXZlKHJlcSk7XG4gIH1cblxuICBvbkFmdGVyRGVsZXRlKFxuICAgIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgIGN1cnJlbnRPYmplY3Q6IGFueSxcbiAgICBvcmlnaW5hbE9iamVjdDogYW55LFxuICAgIGNsYXNzTGV2ZWxQZXJtaXNzaW9uczogYW55XG4gICkge1xuICAgIGlmICghdGhpcy5oYXNMaXZlUXVlcnkoY2xhc3NOYW1lKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCByZXEgPSB0aGlzLl9tYWtlUHVibGlzaGVyUmVxdWVzdChjdXJyZW50T2JqZWN0LCBvcmlnaW5hbE9iamVjdCwgY2xhc3NMZXZlbFBlcm1pc3Npb25zKTtcbiAgICB0aGlzLmxpdmVRdWVyeVB1Ymxpc2hlci5vbkNsb3VkQ29kZUFmdGVyRGVsZXRlKHJlcSk7XG4gIH1cblxuICBoYXNMaXZlUXVlcnkoY2xhc3NOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5jbGFzc05hbWVzLmhhcyhjbGFzc05hbWUpO1xuICB9XG5cbiAgX21ha2VQdWJsaXNoZXJSZXF1ZXN0KGN1cnJlbnRPYmplY3Q6IGFueSwgb3JpZ2luYWxPYmplY3Q6IGFueSwgY2xhc3NMZXZlbFBlcm1pc3Npb25zOiA/YW55KTogYW55IHtcbiAgICBjb25zdCByZXEgPSB7XG4gICAgICBvYmplY3Q6IGN1cnJlbnRPYmplY3QsXG4gICAgfTtcbiAgICBpZiAoY3VycmVudE9iamVjdCkge1xuICAgICAgcmVxLm9yaWdpbmFsID0gb3JpZ2luYWxPYmplY3Q7XG4gICAgfVxuICAgIGlmIChjbGFzc0xldmVsUGVybWlzc2lvbnMpIHtcbiAgICAgIHJlcS5jbGFzc0xldmVsUGVybWlzc2lvbnMgPSBjbGFzc0xldmVsUGVybWlzc2lvbnM7XG4gICAgfVxuICAgIHJldHVybiByZXE7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTGl2ZVF1ZXJ5Q29udHJvbGxlcjtcbiJdfQ==