"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Page = void 0;

/*eslint no-unused-vars: "off"*/

/**
 * @interface Page
 * Page
 * Page content that is returned by PageRouter.
 */
class Page {
  /**
   * @description Creates a page.
   * @param {Object} params The page parameters.
   * @param {String} params.id The page identifier.
   * @param {String} params.defaultFile The page file name.
   * @returns {Page} The page.
   */
  constructor(params = {}) {
    const {
      id,
      defaultFile
    } = params;
    this.id = id;
    this.defaultFile = defaultFile;
  }

}

exports.Page = Page;
var _default = Page;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9QYWdlLmpzIl0sIm5hbWVzIjpbIlBhZ2UiLCJjb25zdHJ1Y3RvciIsInBhcmFtcyIsImlkIiwiZGVmYXVsdEZpbGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7QUFDQTs7Ozs7QUFLTyxNQUFNQSxJQUFOLENBQVc7QUFDaEI7Ozs7Ozs7QUFPQUMsRUFBQUEsV0FBVyxDQUFDQyxNQUFNLEdBQUcsRUFBVixFQUFjO0FBQ3ZCLFVBQU07QUFBRUMsTUFBQUEsRUFBRjtBQUFNQyxNQUFBQTtBQUFOLFFBQXNCRixNQUE1QjtBQUVBLFNBQUtDLEVBQUwsR0FBVUEsRUFBVjtBQUNBLFNBQUtDLFdBQUwsR0FBbUJBLFdBQW5CO0FBQ0Q7O0FBYmU7OztlQWdCSEosSSIsInNvdXJjZXNDb250ZW50IjpbIi8qZXNsaW50IG5vLXVudXNlZC12YXJzOiBcIm9mZlwiKi9cbi8qKlxuICogQGludGVyZmFjZSBQYWdlXG4gKiBQYWdlXG4gKiBQYWdlIGNvbnRlbnQgdGhhdCBpcyByZXR1cm5lZCBieSBQYWdlUm91dGVyLlxuICovXG5leHBvcnQgY2xhc3MgUGFnZSB7XG4gIC8qKlxuICAgKiBAZGVzY3JpcHRpb24gQ3JlYXRlcyBhIHBhZ2UuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBwYXJhbXMgVGhlIHBhZ2UgcGFyYW1ldGVycy5cbiAgICogQHBhcmFtIHtTdHJpbmd9IHBhcmFtcy5pZCBUaGUgcGFnZSBpZGVudGlmaWVyLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gcGFyYW1zLmRlZmF1bHRGaWxlIFRoZSBwYWdlIGZpbGUgbmFtZS5cbiAgICogQHJldHVybnMge1BhZ2V9IFRoZSBwYWdlLlxuICAgKi9cbiAgY29uc3RydWN0b3IocGFyYW1zID0ge30pIHtcbiAgICBjb25zdCB7IGlkLCBkZWZhdWx0RmlsZSB9ID0gcGFyYW1zO1xuXG4gICAgdGhpcy5pZCA9IGlkO1xuICAgIHRoaXMuZGVmYXVsdEZpbGUgPSBkZWZhdWx0RmlsZTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQYWdlO1xuIl19