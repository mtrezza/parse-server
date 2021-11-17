"use strict";

var _Utils = _interopRequireDefault(require("../Utils"));

var _Check = require("./Check");

var CheckGroups = _interopRequireWildcard(require("./CheckGroups/CheckGroups"));

var _logger = _interopRequireDefault(require("../logger"));

var _lodash = require("lodash");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @module SecurityCheck
 */

/**
 * The security check runner.
 */
class CheckRunner {
  /**
   * The security check runner.
   * @param {Object} [config] The configuration options.
   * @param {Boolean} [config.enableCheck=false] Is true if Parse Server should report weak security settings.
   * @param {Boolean} [config.enableCheckLog=false] Is true if the security check report should be written to logs.
   * @param {Object} [config.checkGroups] The check groups to run. Default are the groups defined in `./CheckGroups/CheckGroups.js`.
   */
  constructor(config = {}) {
    this._validateParams(config);

    const {
      enableCheck = false,
      enableCheckLog = false,
      checkGroups = CheckGroups
    } = config;
    this.enableCheck = enableCheck;
    this.enableCheckLog = enableCheckLog;
    this.checkGroups = checkGroups;
  }
  /**
   * Runs all security checks and returns the results.
   * @params
   * @returns {Object} The security check report.
   */


  async run({
    version = '1.0.0'
  } = {}) {
    // Instantiate check groups
    const groups = Object.values(this.checkGroups).filter(c => typeof c === 'function').map(CheckGroup => new CheckGroup()); // Run checks

    groups.forEach(group => group.run()); // Generate JSON report

    const report = this._generateReport({
      groups,
      version
    }); // If report should be written to logs


    if (this.enableCheckLog) {
      this._logReport(report);
    }

    return report;
  }
  /**
   * Generates a security check report in JSON format with schema:
   * ```
   * {
   *    report: {
   *      version: "1.0.0", // The report version, defines the schema
   *      state: "fail"     // The disjunctive indicator of failed checks in all groups.
   *      groups: [         // The check groups
   *        {
   *          name: "House",            // The group name
   *          state: "fail"             // The disjunctive indicator of failed checks in this group.
   *          checks: [                 // The checks
   *            title: "Door locked",   // The check title
   *            state: "fail"           // The check state
   *            warning: "Anyone can enter your house."   // The warning.
   *            solution: "Lock your door."               // The solution.
   *          ]
   *        },
   *        ...
   *      ]
   *    }
   * }
   * ```
   * @param {Object} params The parameters.
   * @param {Array<CheckGroup>} params.groups The check groups.
   * @param {String} params.version: The report schema version.
   * @returns {Object} The report.
   */


  _generateReport({
    groups,
    version
  }) {
    // Create report template
    const report = {
      report: {
        version,
        state: _Check.CheckState.success,
        groups: []
      }
    }; // Identify report version

    switch (version) {
      case '1.0.0':
      default:
        // For each check group
        for (const group of groups) {
          // Create group report
          const groupReport = {
            name: group.name(),
            state: _Check.CheckState.success,
            checks: []
          }; // Create check reports

          groupReport.checks = group.checks().map(check => {
            const checkReport = {
              title: check.title,
              state: check.checkState()
            };

            if (check.checkState() == _Check.CheckState.fail) {
              checkReport.warning = check.warning;
              checkReport.solution = check.solution;
              report.report.state = _Check.CheckState.fail;
              groupReport.state = _Check.CheckState.fail;
            }

            return checkReport;
          });
          report.report.groups.push(groupReport);
        }

    }

    return report;
  }
  /**
   * Logs the security check report.
   * @param {Object} report The report to log.
   */


  _logReport(report) {
    // Determine log level depending on whether any check failed
    const log = report.report.state == _Check.CheckState.success ? s => _logger.default.info(s) : s => _logger.default.warn(s); // Declare output

    const indent = '   ';
    let output = '';
    let checksCount = 0;
    let failedChecksCount = 0;
    let skippedCheckCount = 0; // Traverse all groups and checks for compose output

    for (const group of report.report.groups) {
      output += `\n- ${group.name}`;

      for (const check of group.checks) {
        checksCount++;
        output += `\n${indent}${this._getLogIconForState(check.state)} ${check.title}`;

        if (check.state == _Check.CheckState.fail) {
          failedChecksCount++;
          output += `\n${indent}${indent}Warning: ${check.warning}`;
          output += ` ${check.solution}`;
        } else if (check.state == _Check.CheckState.none) {
          skippedCheckCount++;
          output += `\n${indent}${indent}Test did not execute, this is likely an internal server issue, please report.`;
        }
      }
    }

    output = `\n###################################` + `\n#                                 #` + `\n#   Parse Server Security Check   #` + `\n#                                 #` + `\n###################################` + `\n` + `\n${failedChecksCount > 0 ? 'Warning: ' : ''}${failedChecksCount} weak security setting(s) found${failedChecksCount > 0 ? '!' : ''}` + `\n${checksCount} check(s) executed` + `\n${skippedCheckCount} check(s) skipped` + `\n` + `${output}`; // Write log

    log(output);
  }
  /**
   * Returns an icon for use in the report log output.
   * @param {CheckState} state The check state.
   * @returns {String} The icon.
   */


  _getLogIconForState(state) {
    switch (state) {
      case _Check.CheckState.success:
        return '✅';

      case _Check.CheckState.fail:
        return '❌';

      default:
        return 'ℹ️';
    }
  }
  /**
   * Validates the constructor parameters.
   * @param {Object} params The parameters to validate.
   */


  _validateParams(params) {
    _Utils.default.validateParams(params, {
      enableCheck: {
        t: 'boolean',
        v: _lodash.isBoolean,
        o: true
      },
      enableCheckLog: {
        t: 'boolean',
        v: _lodash.isBoolean,
        o: true
      },
      checkGroups: {
        t: 'array',
        v: _lodash.isArray,
        o: true
      }
    });
  }

}

module.exports = CheckRunner;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9TZWN1cml0eS9DaGVja1J1bm5lci5qcyJdLCJuYW1lcyI6WyJDaGVja1J1bm5lciIsImNvbnN0cnVjdG9yIiwiY29uZmlnIiwiX3ZhbGlkYXRlUGFyYW1zIiwiZW5hYmxlQ2hlY2siLCJlbmFibGVDaGVja0xvZyIsImNoZWNrR3JvdXBzIiwiQ2hlY2tHcm91cHMiLCJydW4iLCJ2ZXJzaW9uIiwiZ3JvdXBzIiwiT2JqZWN0IiwidmFsdWVzIiwiZmlsdGVyIiwiYyIsIm1hcCIsIkNoZWNrR3JvdXAiLCJmb3JFYWNoIiwiZ3JvdXAiLCJyZXBvcnQiLCJfZ2VuZXJhdGVSZXBvcnQiLCJfbG9nUmVwb3J0Iiwic3RhdGUiLCJDaGVja1N0YXRlIiwic3VjY2VzcyIsImdyb3VwUmVwb3J0IiwibmFtZSIsImNoZWNrcyIsImNoZWNrIiwiY2hlY2tSZXBvcnQiLCJ0aXRsZSIsImNoZWNrU3RhdGUiLCJmYWlsIiwid2FybmluZyIsInNvbHV0aW9uIiwicHVzaCIsImxvZyIsInMiLCJsb2dnZXIiLCJpbmZvIiwid2FybiIsImluZGVudCIsIm91dHB1dCIsImNoZWNrc0NvdW50IiwiZmFpbGVkQ2hlY2tzQ291bnQiLCJza2lwcGVkQ2hlY2tDb3VudCIsIl9nZXRMb2dJY29uRm9yU3RhdGUiLCJub25lIiwicGFyYW1zIiwiVXRpbHMiLCJ2YWxpZGF0ZVBhcmFtcyIsInQiLCJ2IiwiaXNCb29sZWFuIiwibyIsImlzQXJyYXkiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOztBQUlBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOzs7Ozs7OztBQVJBO0FBQ0E7QUFDQTs7QUFRQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxXQUFOLENBQWtCO0FBQ2hCO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0VDLEVBQUFBLFdBQVcsQ0FBQ0MsTUFBTSxHQUFHLEVBQVYsRUFBYztBQUN2QixTQUFLQyxlQUFMLENBQXFCRCxNQUFyQjs7QUFDQSxVQUFNO0FBQUVFLE1BQUFBLFdBQVcsR0FBRyxLQUFoQjtBQUF1QkMsTUFBQUEsY0FBYyxHQUFHLEtBQXhDO0FBQStDQyxNQUFBQSxXQUFXLEdBQUdDO0FBQTdELFFBQTZFTCxNQUFuRjtBQUNBLFNBQUtFLFdBQUwsR0FBbUJBLFdBQW5CO0FBQ0EsU0FBS0MsY0FBTCxHQUFzQkEsY0FBdEI7QUFDQSxTQUFLQyxXQUFMLEdBQW1CQSxXQUFuQjtBQUNEO0FBRUQ7QUFDRjtBQUNBO0FBQ0E7QUFDQTs7O0FBQ0UsUUFBTUUsR0FBTixDQUFVO0FBQUVDLElBQUFBLE9BQU8sR0FBRztBQUFaLE1BQXdCLEVBQWxDLEVBQXNDO0FBQ3BDO0FBQ0EsVUFBTUMsTUFBTSxHQUFHQyxNQUFNLENBQUNDLE1BQVAsQ0FBYyxLQUFLTixXQUFuQixFQUNaTyxNQURZLENBQ0xDLENBQUMsSUFBSSxPQUFPQSxDQUFQLEtBQWEsVUFEYixFQUVaQyxHQUZZLENBRVJDLFVBQVUsSUFBSSxJQUFJQSxVQUFKLEVBRk4sQ0FBZixDQUZvQyxDQU1wQzs7QUFDQU4sSUFBQUEsTUFBTSxDQUFDTyxPQUFQLENBQWVDLEtBQUssSUFBSUEsS0FBSyxDQUFDVixHQUFOLEVBQXhCLEVBUG9DLENBU3BDOztBQUNBLFVBQU1XLE1BQU0sR0FBRyxLQUFLQyxlQUFMLENBQXFCO0FBQUVWLE1BQUFBLE1BQUY7QUFBVUQsTUFBQUE7QUFBVixLQUFyQixDQUFmLENBVm9DLENBWXBDOzs7QUFDQSxRQUFJLEtBQUtKLGNBQVQsRUFBeUI7QUFDdkIsV0FBS2dCLFVBQUwsQ0FBZ0JGLE1BQWhCO0FBQ0Q7O0FBQ0QsV0FBT0EsTUFBUDtBQUNEO0FBRUQ7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNFQyxFQUFBQSxlQUFlLENBQUM7QUFBRVYsSUFBQUEsTUFBRjtBQUFVRCxJQUFBQTtBQUFWLEdBQUQsRUFBc0I7QUFDbkM7QUFDQSxVQUFNVSxNQUFNLEdBQUc7QUFDYkEsTUFBQUEsTUFBTSxFQUFFO0FBQ05WLFFBQUFBLE9BRE07QUFFTmEsUUFBQUEsS0FBSyxFQUFFQyxrQkFBV0MsT0FGWjtBQUdOZCxRQUFBQSxNQUFNLEVBQUU7QUFIRjtBQURLLEtBQWYsQ0FGbUMsQ0FVbkM7O0FBQ0EsWUFBUUQsT0FBUjtBQUNFLFdBQUssT0FBTDtBQUNBO0FBQ0U7QUFDQSxhQUFLLE1BQU1TLEtBQVgsSUFBb0JSLE1BQXBCLEVBQTRCO0FBRTFCO0FBQ0EsZ0JBQU1lLFdBQVcsR0FBRztBQUNsQkMsWUFBQUEsSUFBSSxFQUFFUixLQUFLLENBQUNRLElBQU4sRUFEWTtBQUVsQkosWUFBQUEsS0FBSyxFQUFFQyxrQkFBV0MsT0FGQTtBQUdsQkcsWUFBQUEsTUFBTSxFQUFFO0FBSFUsV0FBcEIsQ0FIMEIsQ0FTMUI7O0FBQ0FGLFVBQUFBLFdBQVcsQ0FBQ0UsTUFBWixHQUFxQlQsS0FBSyxDQUFDUyxNQUFOLEdBQWVaLEdBQWYsQ0FBbUJhLEtBQUssSUFBSTtBQUMvQyxrQkFBTUMsV0FBVyxHQUFHO0FBQ2xCQyxjQUFBQSxLQUFLLEVBQUVGLEtBQUssQ0FBQ0UsS0FESztBQUVsQlIsY0FBQUEsS0FBSyxFQUFFTSxLQUFLLENBQUNHLFVBQU47QUFGVyxhQUFwQjs7QUFJQSxnQkFBSUgsS0FBSyxDQUFDRyxVQUFOLE1BQXNCUixrQkFBV1MsSUFBckMsRUFBMkM7QUFDekNILGNBQUFBLFdBQVcsQ0FBQ0ksT0FBWixHQUFzQkwsS0FBSyxDQUFDSyxPQUE1QjtBQUNBSixjQUFBQSxXQUFXLENBQUNLLFFBQVosR0FBdUJOLEtBQUssQ0FBQ00sUUFBN0I7QUFDQWYsY0FBQUEsTUFBTSxDQUFDQSxNQUFQLENBQWNHLEtBQWQsR0FBc0JDLGtCQUFXUyxJQUFqQztBQUNBUCxjQUFBQSxXQUFXLENBQUNILEtBQVosR0FBb0JDLGtCQUFXUyxJQUEvQjtBQUNEOztBQUNELG1CQUFPSCxXQUFQO0FBQ0QsV0Fab0IsQ0FBckI7QUFjQVYsVUFBQUEsTUFBTSxDQUFDQSxNQUFQLENBQWNULE1BQWQsQ0FBcUJ5QixJQUFyQixDQUEwQlYsV0FBMUI7QUFDRDs7QUE3Qkw7O0FBK0JBLFdBQU9OLE1BQVA7QUFDRDtBQUVEO0FBQ0Y7QUFDQTtBQUNBOzs7QUFDRUUsRUFBQUEsVUFBVSxDQUFDRixNQUFELEVBQVM7QUFFakI7QUFDQSxVQUFNaUIsR0FBRyxHQUFHakIsTUFBTSxDQUFDQSxNQUFQLENBQWNHLEtBQWQsSUFBdUJDLGtCQUFXQyxPQUFsQyxHQUE2Q2EsQ0FBRCxJQUFPQyxnQkFBT0MsSUFBUCxDQUFZRixDQUFaLENBQW5ELEdBQXFFQSxDQUFELElBQU9DLGdCQUFPRSxJQUFQLENBQVlILENBQVosQ0FBdkYsQ0FIaUIsQ0FLakI7O0FBQ0EsVUFBTUksTUFBTSxHQUFHLEtBQWY7QUFDQSxRQUFJQyxNQUFNLEdBQUcsRUFBYjtBQUNBLFFBQUlDLFdBQVcsR0FBRyxDQUFsQjtBQUNBLFFBQUlDLGlCQUFpQixHQUFHLENBQXhCO0FBQ0EsUUFBSUMsaUJBQWlCLEdBQUcsQ0FBeEIsQ0FWaUIsQ0FZakI7O0FBQ0EsU0FBSyxNQUFNM0IsS0FBWCxJQUFvQkMsTUFBTSxDQUFDQSxNQUFQLENBQWNULE1BQWxDLEVBQTBDO0FBQ3hDZ0MsTUFBQUEsTUFBTSxJQUFLLE9BQU14QixLQUFLLENBQUNRLElBQUssRUFBNUI7O0FBRUEsV0FBSyxNQUFNRSxLQUFYLElBQW9CVixLQUFLLENBQUNTLE1BQTFCLEVBQWtDO0FBQ2hDZ0IsUUFBQUEsV0FBVztBQUNYRCxRQUFBQSxNQUFNLElBQUssS0FBSUQsTUFBTyxHQUFFLEtBQUtLLG1CQUFMLENBQXlCbEIsS0FBSyxDQUFDTixLQUEvQixDQUFzQyxJQUFHTSxLQUFLLENBQUNFLEtBQU0sRUFBN0U7O0FBRUEsWUFBSUYsS0FBSyxDQUFDTixLQUFOLElBQWVDLGtCQUFXUyxJQUE5QixFQUFvQztBQUNsQ1ksVUFBQUEsaUJBQWlCO0FBQ2pCRixVQUFBQSxNQUFNLElBQUssS0FBSUQsTUFBTyxHQUFFQSxNQUFPLFlBQVdiLEtBQUssQ0FBQ0ssT0FBUSxFQUF4RDtBQUNBUyxVQUFBQSxNQUFNLElBQUssSUFBR2QsS0FBSyxDQUFDTSxRQUFTLEVBQTdCO0FBQ0QsU0FKRCxNQUlPLElBQUlOLEtBQUssQ0FBQ04sS0FBTixJQUFlQyxrQkFBV3dCLElBQTlCLEVBQW9DO0FBQ3pDRixVQUFBQSxpQkFBaUI7QUFDakJILFVBQUFBLE1BQU0sSUFBSyxLQUFJRCxNQUFPLEdBQUVBLE1BQU8sK0VBQS9CO0FBQ0Q7QUFDRjtBQUNGOztBQUVEQyxJQUFBQSxNQUFNLEdBQ0gsdUNBQUQsR0FDQyx1Q0FERCxHQUVDLHVDQUZELEdBR0MsdUNBSEQsR0FJQyx1Q0FKRCxHQUtDLElBTEQsR0FNQyxLQUFJRSxpQkFBaUIsR0FBRyxDQUFwQixHQUF3QixXQUF4QixHQUFzQyxFQUFHLEdBQUVBLGlCQUFrQixrQ0FBaUNBLGlCQUFpQixHQUFHLENBQXBCLEdBQXdCLEdBQXhCLEdBQThCLEVBQUcsRUFOcEksR0FPQyxLQUFJRCxXQUFZLG9CQVBqQixHQVFDLEtBQUlFLGlCQUFrQixtQkFSdkIsR0FTQyxJQVRELEdBVUMsR0FBRUgsTUFBTyxFQVhaLENBL0JpQixDQTRDakI7O0FBQ0FOLElBQUFBLEdBQUcsQ0FBQ00sTUFBRCxDQUFIO0FBQ0Q7QUFFRDtBQUNGO0FBQ0E7QUFDQTtBQUNBOzs7QUFDRUksRUFBQUEsbUJBQW1CLENBQUN4QixLQUFELEVBQVE7QUFDekIsWUFBUUEsS0FBUjtBQUNFLFdBQUtDLGtCQUFXQyxPQUFoQjtBQUF5QixlQUFPLEdBQVA7O0FBQ3pCLFdBQUtELGtCQUFXUyxJQUFoQjtBQUFzQixlQUFPLEdBQVA7O0FBQ3RCO0FBQVMsZUFBTyxJQUFQO0FBSFg7QUFLRDtBQUVEO0FBQ0Y7QUFDQTtBQUNBOzs7QUFDRTdCLEVBQUFBLGVBQWUsQ0FBQzZDLE1BQUQsRUFBUztBQUN0QkMsbUJBQU1DLGNBQU4sQ0FBcUJGLE1BQXJCLEVBQTZCO0FBQzNCNUMsTUFBQUEsV0FBVyxFQUFFO0FBQUUrQyxRQUFBQSxDQUFDLEVBQUUsU0FBTDtBQUFnQkMsUUFBQUEsQ0FBQyxFQUFFQyxpQkFBbkI7QUFBOEJDLFFBQUFBLENBQUMsRUFBRTtBQUFqQyxPQURjO0FBRTNCakQsTUFBQUEsY0FBYyxFQUFFO0FBQUU4QyxRQUFBQSxDQUFDLEVBQUUsU0FBTDtBQUFnQkMsUUFBQUEsQ0FBQyxFQUFFQyxpQkFBbkI7QUFBOEJDLFFBQUFBLENBQUMsRUFBRTtBQUFqQyxPQUZXO0FBRzNCaEQsTUFBQUEsV0FBVyxFQUFFO0FBQUU2QyxRQUFBQSxDQUFDLEVBQUUsT0FBTDtBQUFjQyxRQUFBQSxDQUFDLEVBQUVHLGVBQWpCO0FBQTBCRCxRQUFBQSxDQUFDLEVBQUU7QUFBN0I7QUFIYyxLQUE3QjtBQUtEOztBQTVMZTs7QUErTGxCRSxNQUFNLENBQUNDLE9BQVAsR0FBaUJ6RCxXQUFqQiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQG1vZHVsZSBTZWN1cml0eUNoZWNrXG4gKi9cblxuaW1wb3J0IFV0aWxzIGZyb20gJy4uL1V0aWxzJztcbmltcG9ydCB7IENoZWNrU3RhdGUgfSBmcm9tICcuL0NoZWNrJztcbmltcG9ydCAqIGFzIENoZWNrR3JvdXBzIGZyb20gJy4vQ2hlY2tHcm91cHMvQ2hlY2tHcm91cHMnO1xuaW1wb3J0IGxvZ2dlciBmcm9tICcuLi9sb2dnZXInO1xuaW1wb3J0IHsgaXNBcnJheSwgaXNCb29sZWFuIH0gZnJvbSAnbG9kYXNoJztcblxuLyoqXG4gKiBUaGUgc2VjdXJpdHkgY2hlY2sgcnVubmVyLlxuICovXG5jbGFzcyBDaGVja1J1bm5lciB7XG4gIC8qKlxuICAgKiBUaGUgc2VjdXJpdHkgY2hlY2sgcnVubmVyLlxuICAgKiBAcGFyYW0ge09iamVjdH0gW2NvbmZpZ10gVGhlIGNvbmZpZ3VyYXRpb24gb3B0aW9ucy5cbiAgICogQHBhcmFtIHtCb29sZWFufSBbY29uZmlnLmVuYWJsZUNoZWNrPWZhbHNlXSBJcyB0cnVlIGlmIFBhcnNlIFNlcnZlciBzaG91bGQgcmVwb3J0IHdlYWsgc2VjdXJpdHkgc2V0dGluZ3MuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gW2NvbmZpZy5lbmFibGVDaGVja0xvZz1mYWxzZV0gSXMgdHJ1ZSBpZiB0aGUgc2VjdXJpdHkgY2hlY2sgcmVwb3J0IHNob3VsZCBiZSB3cml0dGVuIHRvIGxvZ3MuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbY29uZmlnLmNoZWNrR3JvdXBzXSBUaGUgY2hlY2sgZ3JvdXBzIHRvIHJ1bi4gRGVmYXVsdCBhcmUgdGhlIGdyb3VwcyBkZWZpbmVkIGluIGAuL0NoZWNrR3JvdXBzL0NoZWNrR3JvdXBzLmpzYC5cbiAgICovXG4gIGNvbnN0cnVjdG9yKGNvbmZpZyA9IHt9KSB7XG4gICAgdGhpcy5fdmFsaWRhdGVQYXJhbXMoY29uZmlnKTtcbiAgICBjb25zdCB7IGVuYWJsZUNoZWNrID0gZmFsc2UsIGVuYWJsZUNoZWNrTG9nID0gZmFsc2UsIGNoZWNrR3JvdXBzID0gQ2hlY2tHcm91cHMgfSA9IGNvbmZpZztcbiAgICB0aGlzLmVuYWJsZUNoZWNrID0gZW5hYmxlQ2hlY2s7XG4gICAgdGhpcy5lbmFibGVDaGVja0xvZyA9IGVuYWJsZUNoZWNrTG9nO1xuICAgIHRoaXMuY2hlY2tHcm91cHMgPSBjaGVja0dyb3VwcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSdW5zIGFsbCBzZWN1cml0eSBjaGVja3MgYW5kIHJldHVybnMgdGhlIHJlc3VsdHMuXG4gICAqIEBwYXJhbXNcbiAgICogQHJldHVybnMge09iamVjdH0gVGhlIHNlY3VyaXR5IGNoZWNrIHJlcG9ydC5cbiAgICovXG4gIGFzeW5jIHJ1bih7IHZlcnNpb24gPSAnMS4wLjAnIH0gPSB7fSkge1xuICAgIC8vIEluc3RhbnRpYXRlIGNoZWNrIGdyb3Vwc1xuICAgIGNvbnN0IGdyb3VwcyA9IE9iamVjdC52YWx1ZXModGhpcy5jaGVja0dyb3VwcylcbiAgICAgIC5maWx0ZXIoYyA9PiB0eXBlb2YgYyA9PT0gJ2Z1bmN0aW9uJylcbiAgICAgIC5tYXAoQ2hlY2tHcm91cCA9PiBuZXcgQ2hlY2tHcm91cCgpKTtcblxuICAgIC8vIFJ1biBjaGVja3NcbiAgICBncm91cHMuZm9yRWFjaChncm91cCA9PiBncm91cC5ydW4oKSk7XG5cbiAgICAvLyBHZW5lcmF0ZSBKU09OIHJlcG9ydFxuICAgIGNvbnN0IHJlcG9ydCA9IHRoaXMuX2dlbmVyYXRlUmVwb3J0KHsgZ3JvdXBzLCB2ZXJzaW9uIH0pO1xuXG4gICAgLy8gSWYgcmVwb3J0IHNob3VsZCBiZSB3cml0dGVuIHRvIGxvZ3NcbiAgICBpZiAodGhpcy5lbmFibGVDaGVja0xvZykge1xuICAgICAgdGhpcy5fbG9nUmVwb3J0KHJlcG9ydClcbiAgICB9XG4gICAgcmV0dXJuIHJlcG9ydDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZXMgYSBzZWN1cml0eSBjaGVjayByZXBvcnQgaW4gSlNPTiBmb3JtYXQgd2l0aCBzY2hlbWE6XG4gICAqIGBgYFxuICAgKiB7XG4gICAqICAgIHJlcG9ydDoge1xuICAgKiAgICAgIHZlcnNpb246IFwiMS4wLjBcIiwgLy8gVGhlIHJlcG9ydCB2ZXJzaW9uLCBkZWZpbmVzIHRoZSBzY2hlbWFcbiAgICogICAgICBzdGF0ZTogXCJmYWlsXCIgICAgIC8vIFRoZSBkaXNqdW5jdGl2ZSBpbmRpY2F0b3Igb2YgZmFpbGVkIGNoZWNrcyBpbiBhbGwgZ3JvdXBzLlxuICAgKiAgICAgIGdyb3VwczogWyAgICAgICAgIC8vIFRoZSBjaGVjayBncm91cHNcbiAgICogICAgICAgIHtcbiAgICogICAgICAgICAgbmFtZTogXCJIb3VzZVwiLCAgICAgICAgICAgIC8vIFRoZSBncm91cCBuYW1lXG4gICAqICAgICAgICAgIHN0YXRlOiBcImZhaWxcIiAgICAgICAgICAgICAvLyBUaGUgZGlzanVuY3RpdmUgaW5kaWNhdG9yIG9mIGZhaWxlZCBjaGVja3MgaW4gdGhpcyBncm91cC5cbiAgICogICAgICAgICAgY2hlY2tzOiBbICAgICAgICAgICAgICAgICAvLyBUaGUgY2hlY2tzXG4gICAqICAgICAgICAgICAgdGl0bGU6IFwiRG9vciBsb2NrZWRcIiwgICAvLyBUaGUgY2hlY2sgdGl0bGVcbiAgICogICAgICAgICAgICBzdGF0ZTogXCJmYWlsXCIgICAgICAgICAgIC8vIFRoZSBjaGVjayBzdGF0ZVxuICAgKiAgICAgICAgICAgIHdhcm5pbmc6IFwiQW55b25lIGNhbiBlbnRlciB5b3VyIGhvdXNlLlwiICAgLy8gVGhlIHdhcm5pbmcuXG4gICAqICAgICAgICAgICAgc29sdXRpb246IFwiTG9jayB5b3VyIGRvb3IuXCIgICAgICAgICAgICAgICAvLyBUaGUgc29sdXRpb24uXG4gICAqICAgICAgICAgIF1cbiAgICogICAgICAgIH0sXG4gICAqICAgICAgICAuLi5cbiAgICogICAgICBdXG4gICAqICAgIH1cbiAgICogfVxuICAgKiBgYGBcbiAgICogQHBhcmFtIHtPYmplY3R9IHBhcmFtcyBUaGUgcGFyYW1ldGVycy5cbiAgICogQHBhcmFtIHtBcnJheTxDaGVja0dyb3VwPn0gcGFyYW1zLmdyb3VwcyBUaGUgY2hlY2sgZ3JvdXBzLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gcGFyYW1zLnZlcnNpb246IFRoZSByZXBvcnQgc2NoZW1hIHZlcnNpb24uXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFRoZSByZXBvcnQuXG4gICAqL1xuICBfZ2VuZXJhdGVSZXBvcnQoeyBncm91cHMsIHZlcnNpb24gfSkge1xuICAgIC8vIENyZWF0ZSByZXBvcnQgdGVtcGxhdGVcbiAgICBjb25zdCByZXBvcnQgPSB7XG4gICAgICByZXBvcnQ6IHtcbiAgICAgICAgdmVyc2lvbixcbiAgICAgICAgc3RhdGU6IENoZWNrU3RhdGUuc3VjY2VzcyxcbiAgICAgICAgZ3JvdXBzOiBbXVxuICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBJZGVudGlmeSByZXBvcnQgdmVyc2lvblxuICAgIHN3aXRjaCAodmVyc2lvbikge1xuICAgICAgY2FzZSAnMS4wLjAnOlxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgLy8gRm9yIGVhY2ggY2hlY2sgZ3JvdXBcbiAgICAgICAgZm9yIChjb25zdCBncm91cCBvZiBncm91cHMpIHtcblxuICAgICAgICAgIC8vIENyZWF0ZSBncm91cCByZXBvcnRcbiAgICAgICAgICBjb25zdCBncm91cFJlcG9ydCA9IHtcbiAgICAgICAgICAgIG5hbWU6IGdyb3VwLm5hbWUoKSxcbiAgICAgICAgICAgIHN0YXRlOiBDaGVja1N0YXRlLnN1Y2Nlc3MsXG4gICAgICAgICAgICBjaGVja3M6IFtdLFxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIENyZWF0ZSBjaGVjayByZXBvcnRzXG4gICAgICAgICAgZ3JvdXBSZXBvcnQuY2hlY2tzID0gZ3JvdXAuY2hlY2tzKCkubWFwKGNoZWNrID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGNoZWNrUmVwb3J0ID0ge1xuICAgICAgICAgICAgICB0aXRsZTogY2hlY2sudGl0bGUsXG4gICAgICAgICAgICAgIHN0YXRlOiBjaGVjay5jaGVja1N0YXRlKCksXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKGNoZWNrLmNoZWNrU3RhdGUoKSA9PSBDaGVja1N0YXRlLmZhaWwpIHtcbiAgICAgICAgICAgICAgY2hlY2tSZXBvcnQud2FybmluZyA9IGNoZWNrLndhcm5pbmc7XG4gICAgICAgICAgICAgIGNoZWNrUmVwb3J0LnNvbHV0aW9uID0gY2hlY2suc29sdXRpb247XG4gICAgICAgICAgICAgIHJlcG9ydC5yZXBvcnQuc3RhdGUgPSBDaGVja1N0YXRlLmZhaWw7XG4gICAgICAgICAgICAgIGdyb3VwUmVwb3J0LnN0YXRlID0gQ2hlY2tTdGF0ZS5mYWlsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNoZWNrUmVwb3J0O1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgcmVwb3J0LnJlcG9ydC5ncm91cHMucHVzaChncm91cFJlcG9ydCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlcG9ydDtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2dzIHRoZSBzZWN1cml0eSBjaGVjayByZXBvcnQuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXBvcnQgVGhlIHJlcG9ydCB0byBsb2cuXG4gICAqL1xuICBfbG9nUmVwb3J0KHJlcG9ydCkge1xuXG4gICAgLy8gRGV0ZXJtaW5lIGxvZyBsZXZlbCBkZXBlbmRpbmcgb24gd2hldGhlciBhbnkgY2hlY2sgZmFpbGVkXG4gICAgY29uc3QgbG9nID0gcmVwb3J0LnJlcG9ydC5zdGF0ZSA9PSBDaGVja1N0YXRlLnN1Y2Nlc3MgPyAocykgPT4gbG9nZ2VyLmluZm8ocykgOiAocykgPT4gbG9nZ2VyLndhcm4ocyk7XG5cbiAgICAvLyBEZWNsYXJlIG91dHB1dFxuICAgIGNvbnN0IGluZGVudCA9ICcgICAnO1xuICAgIGxldCBvdXRwdXQgPSAnJztcbiAgICBsZXQgY2hlY2tzQ291bnQgPSAwO1xuICAgIGxldCBmYWlsZWRDaGVja3NDb3VudCA9IDA7XG4gICAgbGV0IHNraXBwZWRDaGVja0NvdW50ID0gMDtcblxuICAgIC8vIFRyYXZlcnNlIGFsbCBncm91cHMgYW5kIGNoZWNrcyBmb3IgY29tcG9zZSBvdXRwdXRcbiAgICBmb3IgKGNvbnN0IGdyb3VwIG9mIHJlcG9ydC5yZXBvcnQuZ3JvdXBzKSB7XG4gICAgICBvdXRwdXQgKz0gYFxcbi0gJHtncm91cC5uYW1lfWBcblxuICAgICAgZm9yIChjb25zdCBjaGVjayBvZiBncm91cC5jaGVja3MpIHtcbiAgICAgICAgY2hlY2tzQ291bnQrKztcbiAgICAgICAgb3V0cHV0ICs9IGBcXG4ke2luZGVudH0ke3RoaXMuX2dldExvZ0ljb25Gb3JTdGF0ZShjaGVjay5zdGF0ZSl9ICR7Y2hlY2sudGl0bGV9YDtcblxuICAgICAgICBpZiAoY2hlY2suc3RhdGUgPT0gQ2hlY2tTdGF0ZS5mYWlsKSB7XG4gICAgICAgICAgZmFpbGVkQ2hlY2tzQ291bnQrKztcbiAgICAgICAgICBvdXRwdXQgKz0gYFxcbiR7aW5kZW50fSR7aW5kZW50fVdhcm5pbmc6ICR7Y2hlY2sud2FybmluZ31gO1xuICAgICAgICAgIG91dHB1dCArPSBgICR7Y2hlY2suc29sdXRpb259YDtcbiAgICAgICAgfSBlbHNlIGlmIChjaGVjay5zdGF0ZSA9PSBDaGVja1N0YXRlLm5vbmUpIHtcbiAgICAgICAgICBza2lwcGVkQ2hlY2tDb3VudCsrO1xuICAgICAgICAgIG91dHB1dCArPSBgXFxuJHtpbmRlbnR9JHtpbmRlbnR9VGVzdCBkaWQgbm90IGV4ZWN1dGUsIHRoaXMgaXMgbGlrZWx5IGFuIGludGVybmFsIHNlcnZlciBpc3N1ZSwgcGxlYXNlIHJlcG9ydC5gO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgb3V0cHV0ID1cbiAgICAgIGBcXG4jIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjI2AgK1xuICAgICAgYFxcbiMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjYCArXG4gICAgICBgXFxuIyAgIFBhcnNlIFNlcnZlciBTZWN1cml0eSBDaGVjayAgICNgICtcbiAgICAgIGBcXG4jICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI2AgK1xuICAgICAgYFxcbiMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjYCArXG4gICAgICBgXFxuYCArXG4gICAgICBgXFxuJHtmYWlsZWRDaGVja3NDb3VudCA+IDAgPyAnV2FybmluZzogJyA6ICcnfSR7ZmFpbGVkQ2hlY2tzQ291bnR9IHdlYWsgc2VjdXJpdHkgc2V0dGluZyhzKSBmb3VuZCR7ZmFpbGVkQ2hlY2tzQ291bnQgPiAwID8gJyEnIDogJyd9YCArXG4gICAgICBgXFxuJHtjaGVja3NDb3VudH0gY2hlY2socykgZXhlY3V0ZWRgICtcbiAgICAgIGBcXG4ke3NraXBwZWRDaGVja0NvdW50fSBjaGVjayhzKSBza2lwcGVkYCArXG4gICAgICBgXFxuYCArXG4gICAgICBgJHtvdXRwdXR9YDtcblxuICAgIC8vIFdyaXRlIGxvZ1xuICAgIGxvZyhvdXRwdXQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYW4gaWNvbiBmb3IgdXNlIGluIHRoZSByZXBvcnQgbG9nIG91dHB1dC5cbiAgICogQHBhcmFtIHtDaGVja1N0YXRlfSBzdGF0ZSBUaGUgY2hlY2sgc3RhdGUuXG4gICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBpY29uLlxuICAgKi9cbiAgX2dldExvZ0ljb25Gb3JTdGF0ZShzdGF0ZSkge1xuICAgIHN3aXRjaCAoc3RhdGUpIHtcbiAgICAgIGNhc2UgQ2hlY2tTdGF0ZS5zdWNjZXNzOiByZXR1cm4gJ+KchSc7XG4gICAgICBjYXNlIENoZWNrU3RhdGUuZmFpbDogcmV0dXJuICfinYwnO1xuICAgICAgZGVmYXVsdDogcmV0dXJuICfihLnvuI8nO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZXMgdGhlIGNvbnN0cnVjdG9yIHBhcmFtZXRlcnMuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBwYXJhbXMgVGhlIHBhcmFtZXRlcnMgdG8gdmFsaWRhdGUuXG4gICAqL1xuICBfdmFsaWRhdGVQYXJhbXMocGFyYW1zKSB7XG4gICAgVXRpbHMudmFsaWRhdGVQYXJhbXMocGFyYW1zLCB7XG4gICAgICBlbmFibGVDaGVjazogeyB0OiAnYm9vbGVhbicsIHY6IGlzQm9vbGVhbiwgbzogdHJ1ZSB9LFxuICAgICAgZW5hYmxlQ2hlY2tMb2c6IHsgdDogJ2Jvb2xlYW4nLCB2OiBpc0Jvb2xlYW4sIG86IHRydWUgfSxcbiAgICAgIGNoZWNrR3JvdXBzOiB7IHQ6ICdhcnJheScsIHY6IGlzQXJyYXksIG86IHRydWUgfSxcbiAgICB9KTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IENoZWNrUnVubmVyO1xuIl19