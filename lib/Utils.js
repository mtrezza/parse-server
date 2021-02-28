"use strict";

/**
 * utils.js
 * @file General purpose utilities
 * @description General purpose utilities.
 */
const path = require('path');

const fs = require('fs').promises;
/**
 * The general purpose utilities.
 */


class Utils {
  /**
   * @function getLocalizedPath
   * @description Returns a localized file path accoring to the locale.
   *
   * Localized files are searched in subfolders of a given path, e.g.
   *
   * root/
   * ├── base/                    // base path to files
   * │   ├── example.html         // default file
   * │   └── de/                  // de language folder
   * │   │   └── example.html     // de localized file
   * │   └── de-AT/               // de-AT locale folder
   * │   │   └── example.html     // de-AT localized file
   *
   * Files are matched with the locale in the following order:
   * 1. Locale match, e.g. locale `de-AT` matches file in folder `de-AT`.
   * 2. Language match, e.g. locale `de-AT` matches file in folder `de`.
   * 3. Default; file in base folder is returned.
   *
   * @param {String} defaultPath The absolute file path, which is also
   * the default path returned if localization is not available.
   * @param {String} locale The locale.
   * @returns {Promise<Object>} The object contains:
   * - `path`: The path to the localized file, or the original path if
   *   localization is not available.
   * - `subdir`: The subdirectory of the localized file, or undefined if
   *   there is no matching localized file.
   */
  static async getLocalizedPath(defaultPath, locale) {
    // Get file name and paths
    const file = path.basename(defaultPath);
    const basePath = path.dirname(defaultPath); // If locale is not set return default file

    if (!locale) {
      return {
        path: defaultPath
      };
    } // Check file for locale exists


    const localePath = path.join(basePath, locale, file);
    const localeFileExists = await Utils.fileExists(localePath); // If file for locale exists return file

    if (localeFileExists) {
      return {
        path: localePath,
        subdir: locale
      };
    } // Check file for language exists


    const language = locale.split('-')[0];
    const languagePath = path.join(basePath, language, file);
    const languageFileExists = await Utils.fileExists(languagePath); // If file for language exists return file

    if (languageFileExists) {
      return {
        path: languagePath,
        subdir: language
      };
    } // Return default file


    return {
      path: defaultPath
    };
  }
  /**
   * @function fileExists
   * @description Checks whether a file exists.
   * @param {String} path The file path.
   * @returns {Promise<Boolean>} Is true if the file can be accessed, false otherwise.
   */


  static async fileExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch (e) {
      return false;
    }
  }
  /**
   * @function isPath
   * @description Evaluates whether a string is a file path (as opposed to a URL for example).
   * @param {String} s The string to evaluate.
   * @returns {Boolean} Returns true if the evaluated string is a path.
   */


  static isPath(s) {
    return /(^\/)|(^\.\/)|(^\.\.\/)/.test(s);
  }
  /**
   * Flattens an object and crates new keys with custom delimiters.
   * @param {Object} obj The object to flatten.
   * @param {String} [delimiter='.'] The delimiter of the newly generated keys.
   * @param {Object} result
   * @returns {Object} The flattened object.
   **/


  static flattenObject(obj, parentKey, delimiter = '.', result = {}) {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const newKey = parentKey ? parentKey + delimiter + key : key;

        if (typeof obj[key] === 'object' && obj[key] !== null) {
          this.flattenObject(obj[key], newKey, delimiter, result);
        } else {
          result[newKey] = obj[key];
        }
      }
    }

    return result;
  }

}

module.exports = Utils;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9VdGlscy5qcyJdLCJuYW1lcyI6WyJwYXRoIiwicmVxdWlyZSIsImZzIiwicHJvbWlzZXMiLCJVdGlscyIsImdldExvY2FsaXplZFBhdGgiLCJkZWZhdWx0UGF0aCIsImxvY2FsZSIsImZpbGUiLCJiYXNlbmFtZSIsImJhc2VQYXRoIiwiZGlybmFtZSIsImxvY2FsZVBhdGgiLCJqb2luIiwibG9jYWxlRmlsZUV4aXN0cyIsImZpbGVFeGlzdHMiLCJzdWJkaXIiLCJsYW5ndWFnZSIsInNwbGl0IiwibGFuZ3VhZ2VQYXRoIiwibGFuZ3VhZ2VGaWxlRXhpc3RzIiwiYWNjZXNzIiwiZSIsImlzUGF0aCIsInMiLCJ0ZXN0IiwiZmxhdHRlbk9iamVjdCIsIm9iaiIsInBhcmVudEtleSIsImRlbGltaXRlciIsInJlc3VsdCIsImtleSIsIk9iamVjdCIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiY2FsbCIsIm5ld0tleSIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBLE1BQU1BLElBQUksR0FBR0MsT0FBTyxDQUFDLE1BQUQsQ0FBcEI7O0FBQ0EsTUFBTUMsRUFBRSxHQUFHRCxPQUFPLENBQUMsSUFBRCxDQUFQLENBQWNFLFFBQXpCO0FBRUE7QUFDQTtBQUNBOzs7QUFDQSxNQUFNQyxLQUFOLENBQVk7QUFDVjtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUMrQixlQUFoQkMsZ0JBQWdCLENBQUNDLFdBQUQsRUFBY0MsTUFBZCxFQUFzQjtBQUNqRDtBQUNBLFVBQU1DLElBQUksR0FBR1IsSUFBSSxDQUFDUyxRQUFMLENBQWNILFdBQWQsQ0FBYjtBQUNBLFVBQU1JLFFBQVEsR0FB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bnRlbnQiOlsiLyoqXG4gKiB1dGlscy5qc1xuICogQGZpbGUgR2VuZXJhbCBwdXJwb3NlIHV0aWxpdGllc1xuICogQGRlc2NyaXB0aW9uIEdlbmVyYWwgcHVycG9zZSB1dGlsaXRpZXMuXG4gKi9cblxuY29uc3QgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKTtcbmNvbnN0IGZzID0gcmVxdWlyZSgnZnMnKS5wcm9taXNlcztcblxuLyoqXG4gKiBUaGUgZ2VuZXJhbCBwdXJwb3NlIHV0aWxpdGllcy5cbiAqL1xuY2xhc3MgVXRpbHMge1xuICAvKipcbiAgICogQGZ1bmN0aW9uIGdldExvY2FsaXplZFBhdGhcbiAgICogQGRlc2NyaXB0aW9uIFJldHVybnMgYSBsb2NhbGl6ZWQgZmlsZSBwYXRoIGFjY29yaW5nIHRvIHRoZSBsb2NhbGUuXG4gICAqXG4gICAqIExvY2FsaXplZCBmaWxlcyBhcmUgc2VhcmNoZWQgaW4gc3ViZm9sZGVycyBvZiBhIGdpdmVuIHBhdGgsIGUuZy5cbiAgICpcbiAgICogcm9vdC9cbiAgICog4pSc4pSA4pSAIGJhc2UvICAgICAgICAgICAgICAgICAgICAvLyBiYXNlIHBhdGggdG8gZmlsZXNcbiAgICog4pSCICAg4pSc4pSA4pSAIGV4YW1wbGUuaHRtbCAgICAgICAgIC8vIGRlZmF1bHQgZmlsZVxuICAgKiDilIIgICDilJTilIDilIAgZGUvICAgICAgICAgICAgICAgICAgLy8gZGUgbGFuZ3VhZ2UgZm9sZGVyXG4gICAqIOKUgiAgIOKUgiAgIOKUlOKUgOKUgCBleGFtcGxlLmh0bWwgICAgIC8vIGRlIGxvY2FsaXplZCBmaWxlXG4gICAqIOKUgiAgIOKUlOKUgOKUgCBkZS1BVC8gICAgICAgICAgICAgICAvLyBkZS1BVCBsb2NhbGUgZm9sZGVyXG4gICAqIOKUgiAgIOKUgiAgIOKUlOKUgOKUgCBleGFtcGxlLmh0bWwgICAgIC8vIGRlLUFUIGxvY2FsaXplZCBmaWxlXG4gICAqXG4gICAqIEZpbGVzIGFyZSBtYXRjaGVkIHdpdGggdGhlIGxvY2FsZSBpbiB0aGUgZm9sbG93aW5nIG9yZGVyOlxuICAgKiAxLiBMb2NhbGUgbWF0Y2gsIGUuZy4gbG9jYWxlIGBkZS1BVGAgbWF0Y2hlcyBmaWxlIGluIGZvbGRlciBgZGUtQVRgLlxuICAgKiAyLiBMYW5ndWFnZSBtYXRjaCwgZS5nLiBsb2NhbGUgYGRlLUFUYCBtYXRjaGVzIGZpbGUgaW4gZm9sZGVyIGBkZWAuXG4gICAqIDMuIERlZmF1bHQ7IGZpbGUgaW4gYmFzZSBmb2xkZXIgaXMgcmV0dXJuZWQuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBkZWZhdWx0UGF0aCBUaGUgYWJzb2x1dGUgZmlsZSBwYXRoLCB3aGljaCBpcyBhbHNvXG4gICAqIHRoZSBkZWZhdWx0IHBhdGggcmV0dXJuZWQgaWYgbG9jYWxpemF0aW9uIGlzIG5vdCBhdmFpbGFibGUuXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBsb2NhbGUgVGhlIGxvY2FsZS5cbiAgICogQHJldHVybnMge1Byb21pc2U8T2JqZWN0Pn0gVGhlIG9iamVjdCBjb250YWluczpcbiAgICogLSBgcGF0aGA6IFRoZSBwYXRoIHRvIHRoZSBsb2NhbGl6ZWQgZmlsZSwgb3IgdGhlIG9yaWdpbmFsIHBhdGggaWZcbiAgICogICBsb2NhbGl6YXRpb24gaXMgbm90IGF2YWlsYWJsZS5cbiAgICogLSBgc3ViZGlyYDogVGhlIHN1YmRpcmVjdG9yeSBvZiB0aGUgbG9jYWxpemVkIGZpbGUsIG9yIHVuZGVmaW5lZCBpZlxuICAgKiAgIHRoZXJlIGlzIG5vIG1hdGNoaW5nIGxvY2FsaXplZCBmaWxlLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGdldExvY2FsaXplZFBhdGgoZGVmYXVsdFBhdGgsIGxvY2FsZSkge1xuICAgIC8vIEdldCBmaWxlIG5hbWUgYW5kIHBhdGhzXG4gICAgY29uc3QgZmlsZSA9IHBhdGguYmFzZW5hbWUoZGVmYXVsdFBhdGgpO1xuICAgIGNvbnN0IGJhc2VQYXRoID0gcGF0aC5kaXJuYW1lKGRlZmF1bHRQYXRoKTtcblxuICAgIC8vIElmIGxvY2FsZSBpcyBub3Qgc2V0IHJldHVybiBkZWZhdWx0IGZpbGVcbiAgICBpZiAoIWxvY2FsZSkge1xuICAgICAgcmV0dXJuIHsgcGF0aDogZGVmYXVsdFBhdGggfTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBmaWxlIGZvciBsb2NhbGUgZXhpc3RzXG4gICAgY29uc3QgbG9jYWxlUGF0aCA9IHBhdGguam9pbihiYXNlUGF0aCwgbG9jYWxlLCBmaWxlKTtcbiAgICBjb25zdCBsb2NhbGVGaWxlRXhpc3RzID0gYXdhaXQgVXRpbHMuZmlsZUV4aXN0cyhsb2NhbGVQYXRoKTtcblxuICAgIC8vIElmIGZpbGUgZm9yIGxvY2FsZSBleGlzdHMgcmV0dXJuIGZpbGVcbiAgICBpZiAobG9jYWxlRmlsZUV4aXN0cykge1xuICAgICAgcmV0dXJuIHsgcGF0aDogbG9jYWxlUGF0aCwgc3ViZGlyOiBsb2NhbGUgfTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBmaWxlIGZvciBsYW5ndWFnZSBleGlzdHNcbiAgICBjb25zdCBsYW5ndWFnZSA9IGxvY2FsZS5zcGxpdCgnLScpWzBdO1xuICAgIGNvbnN0IGxhbmd1YWdlUGF0aCA9IHBhdGguam9pbihiYXNlUGF0aCwgbGFuZ3VhZ2UsIGZpbGUpO1xuICAgIGNvbnN0IGxhbmd1YWdlRmlsZUV4aXN0cyA9IGF3YWl0IFV0aWxzLmZpbGVFeGlzdHMobGFuZ3VhZ2VQYXRoKTtcblxuICAgIC8vIElmIGZpbGUgZm9yIGxhbmd1YWdlIGV4aXN0cyByZXR1cm4gZmlsZVxuICAgIGlmIChsYW5ndWFnZUZpbGVFeGlzdHMpIHtcbiAgICAgIHJldHVybiB7IHBhdGg6IGxhbmd1YWdlUGF0aCwgc3ViZGlyOiBsYW5ndWFnZSB9O1xuICAgIH1cblxuICAgIC8vIFJldHVybiBkZWZhdWx0IGZpbGVcbiAgICByZXR1cm4geyBwYXRoOiBkZWZhdWx0UGF0aCB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEBmdW5jdGlvbiBmaWxlRXhpc3RzXG4gICAqIEBkZXNjcmlwdGlvbiBDaGVja3Mgd2hldGhlciBhIGZpbGUgZXhpc3RzLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBUaGUgZmlsZSBwYXRoLlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxCb29sZWFuPn0gSXMgdHJ1ZSBpZiB0aGUgZmlsZSBjYW4gYmUgYWNjZXNzZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBmaWxlRXhpc3RzKHBhdGgpIHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZnMuYWNjZXNzKHBhdGgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAZnVuY3Rpb24gaXNQYXRoXG4gICAqIEBkZXNjcmlwdGlvbiBFdmFsdWF0ZXMgd2hldGhlciBhIHN0cmluZyBpcyBhIGZpbGUgcGF0aCAoYXMgb3Bwb3NlZCB0byBhIFVSTCBmb3IgZXhhbXBsZSkuXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzIFRoZSBzdHJpbmcgdG8gZXZhbHVhdGUuXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIHRydWUgaWYgdGhlIGV2YWx1YXRlZCBzdHJpbmcgaXMgYSBwYXRoLlxuICAgKi9cbiAgc3RhdGljIGlzUGF0aChzKSB7XG4gICAgcmV0dXJuIC8oXlxcLyl8KF5cXC5cXC8pfCheXFwuXFwuXFwvKS8udGVzdChzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGbGF0dGVucyBhbiBvYmplY3QgYW5kIGNyYXRlcyBuZXcga2V5cyB3aXRoIGN1c3RvbSBkZWxpbWl0ZXJzLlxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqIFRoZSBvYmplY3QgdG8gZmxhdHRlbi5cbiAgICogQHBhcmFtIHtTdHJpbmd9IFtkZWxpbWl0ZXI9Jy4nXSBUaGUgZGVsaW1pdGVyIG9mIHRoZSBuZXdseSBnZW5lcmF0ZWQga2V5cy5cbiAgICogQHBhcmFtIHtPYmplY3R9IHJlc3VsdFxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBUaGUgZmxhdHRlbmVkIG9iamVjdC5cbiAgICoqL1xuICBzdGF0aWMgZmxhdHRlbk9iamVjdChvYmosIHBhcmVudEtleSwgZGVsaW1pdGVyID0gJy4nLCByZXN1bHQgPSB7fSkge1xuICAgIGZvciAoY29uc3Qga2V5IGluIG9iaikge1xuICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHtcbiAgICAgICAgY29uc3QgbmV3S2V5ID0gcGFyZW50S2V5ID8gcGFyZW50S2V5ICsgZGVsaW1pdGVyICsga2V5IDoga2V5O1xuXG4gICAgICAgIGlmICh0eXBlb2Ygb2JqW2tleV0gPT09ICdvYmplY3QnICYmIG9ialtrZXldICE9PSBudWxsKSB7XG4gICAgICAgICAgdGhpcy5mbGF0dGVuT2JqZWN0KG9ialtrZXldLCBuZXdLZXksIGRlbGltaXRlciwgcmVzdWx0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHRbbmV3S2V5XSA9IG9ialtrZXldO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBVdGlscztcbiJdfQ==