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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9QYWdlLmpzIl0sIm5hbWVzIjpbIlBhZ2UiLCJjb25zdHJ1Y3RvciIsInBhcmFtcyIsImlkIiwiZGVmYXVsdEZpbGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUEsSUFBTixDQUFXO0FBQ2hCO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0VDLEVBQUFBLFdBQVcsQ0FBQ0MsTUFBTSxHQUFHLEVBQVYsRUFBYztBQUN2QixVQUFNO0FBQUVDLE1BQUFBLEVBQUY7QUFBTUMsTUFBQUE7QUFBTixRQUFzQkYsTUFBNUI7QUFFQSxTQUFLQyxFQUFMLEdBQVVBLEVBQVY7QUFDQSxTQUFLQyxXQUFMLEdBQW1CQSxXQUFuQjtBQUNEOztBQWJlOzs7ZUFnQkhKLEkiLCJzb3VyY2VzQ29udGVudCI6WyIvKmVzbGludCBuby11bnVzZWQtdmFyczogXCJvZmZcIiovXG4vKipcbiAqIEBpbnRlcmZhY2UgUGFnZVxuICogUGFnZVxuICogUGFnZSBjb250ZW50IHRoYXQgaXMgcmV0dXJuZWQgYnkgUGFnZVJvdXRlci5cbiAqL1xuZXhwb3J0IGNsYXNzIFBhZ2Uge1xuICAvKipcbiAgICogQGRlc2NyaXB0aW9uIENyZWF0ZXMgYSBwYWdlLlxuICAgKiBAcGFyYW0ge09iamVjdH0gcGFyYW1zIFRoZSBwYWdlIHBhcmFtZXRlcnMuXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwYXJhbXMuaWQgVGhlIHBhZ2UgaWRlbnRpZmllci5cbiAgICogQHBhcmFtIHtTdHJpbmd9IHBhcmFtcy5kZWZhdWx0RmlsZSBUaGUgcGFnZSBmaWxlIG5hbWUuXG4gICAqIEByZXR1cm5zIHtQYWdlfSBUaGUgcGFnZS5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHBhcmFtcyA9IHt9KSB7XG4gICAgY29uc3QgeyBpZCwgZGVmYXVsdEZpbGUgfSA9IHBhcmFtcztcblxuICAgIHRoaXMuaWQgPSBpZDtcbiAgICB0aGlzLmRlZmF1bHRGaWxlID0gZGVmYXVsdEZpbGU7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGFnZTtcbiJdfQ==