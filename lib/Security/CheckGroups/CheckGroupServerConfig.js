"use strict";

var _Check = require("../Check");

var _CheckGroup = _interopRequireDefault(require("../CheckGroup"));

var _Config = _interopRequireDefault(require("../../Config"));

var _node = _interopRequireDefault(require("parse/node"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @module SecurityCheck
 */

/**
* The security checks group for Parse Server configuration.
* Checks common Parse Server parameters such as access keys.
*/
class CheckGroupServerConfig extends _CheckGroup.default {
  setName() {
    return 'Parse Server Configuration';
  }

  setChecks() {
    const config = _Config.default.get(_node.default.applicationId);

    return [new _Check.Check({
      title: 'Secure master key',
      warning: 'The Parse Server master key is insecure and vulnerable to brute force attacks.',
      solution: 'Choose a longer and/or more complex master key with a combination of upper- and lowercase characters, numbers and special characters.',
      check: () => {
        const masterKey = config.masterKey;
        const hasUpperCase = /[A-Z]/.test(masterKey);
        const hasLowerCase = /[a-z]/.test(masterKey);
        const hasNumbers = /\d/.test(masterKey);
        const hasNonAlphasNumerics = /\W/.test(masterKey); // Ensure length

        if (masterKey.length < 14) {
          throw 1;
        } // Ensure at least 3 out of 4 requirements passed


        if (hasUpperCase + hasLowerCase + hasNumbers + hasNonAlphasNumerics < 3) {
          throw 1;
        }
      }
    }), new _Check.Check({
      title: 'Security log disabled',
      warning: 'Security checks in logs may expose vulnerabilities to anyone access to logs.',
      solution: 'Change Parse Server configuration to \'security.enableCheckLog: false\'.',
      check: () => {
        if (config.security && config.security.enableCheckLog) {
          throw 1;
        }
      }
    }), new _Check.Check({
      title: 'Client class creation disabled',
      warning: 'Attackers are allowed to create new classes without restriction and flood the database.',
      solution: 'Change Parse Server configuration to \'allowClientClassCreation: false\'.',
      check: () => {
        if (config.allowClientClassCreation || config.allowClientClassCreation == null) {
          throw 1;
        }
      }
    })];
  }

}

module.exports = CheckGroupServerConfig;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9TZWN1cml0eS9DaGVja0dyb3Vwcy9DaGVja0dyb3VwU2VydmVyQ29uZmlnLmpzIl0sIm5hbWVzIjpbIkNoZWNrR3JvdXBTZXJ2ZXJDb25maWciLCJDaGVja0dyb3VwIiwic2V0TmFtZSIsInNldENoZWNrcyIsImNvbmZpZyIsIkNvbmZpZyIsImdldCIsIlBhcnNlIiwiYXBwbGljYXRpb25JZCIsIkNoZWNrIiwidGl0bGUiLCJ3YXJuaW5nIiwic29sdXRpb24iLCJjaGVjayIsIm1hc3RlcktleSIsImhhc1VwcGVyQ2FzZSIsInRlc3QiLCJoYXNMb3dlckNhc2UiLCJoYXNOdW1iZXJzIiwiaGFzTm9uQWxwaGFzTnVtZXJpY3MiLCJsZW5ndGgiLCJzZWN1cml0eSIsImVuYWJsZUNoZWNrTG9nIiwiYWxsb3dDbGllbnRDbGFzc0NyZWF0aW9uIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7QUFJQTs7QUFDQTs7QUFDQTs7QUFDQTs7OztBQVBBO0FBQ0E7QUFDQTs7QUFPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLHNCQUFOLFNBQXFDQyxtQkFBckMsQ0FBZ0Q7QUFDOUNDLEVBQUFBLE9BQU8sR0FBRztBQUNSLFdBQU8sNEJBQVA7QUFDRDs7QUFDREMsRUFBQUEsU0FBUyxHQUFHO0FBQ1YsVUFBTUMsTUFBTSxHQUFHQyxnQkFBT0MsR0FBUCxDQUFXQyxjQUFNQyxhQUFqQixDQUFmOztBQUNBLFdBQU8sQ0FDTCxJQUFJQyxZQUFKLENBQVU7QUFDUkMsTUFBQUEsS0FBSyxFQUFFLG1CQURDO0FBRVJDLE1BQUFBLE9BQU8sRUFBRSxnRkFGRDtBQUdSQyxNQUFBQSxRQUFRLEVBQUUsdUlBSEY7QUFJUkMsTUFBQUEsS0FBSyxFQUFFLE1BQU07QUFDWCxjQUFNQyxTQUFTLEdBQUdWLE1BQU0sQ0FBQ1UsU0FBekI7QUFDQSxjQUFNQyxZQUFZLEdBQUcsUUFBUUMsSUFBUixDQUFhRixTQUFiLENBQXJCO0FBQ0EsY0FBTUcsWUFBWSxHQUFHLFFBQVFELElBQVIsQ0FBYUYsU0FBYixDQUFyQjtBQUNBLGNBQU1JLFVBQVUsR0FBRyxLQUFLRixJQUFMLENBQVVGLFNBQVYsQ0FBbkI7QUFDQSxjQUFNSyxvQkFBb0IsR0FBRyxLQUFLSCxJQUFMLENBQVVGLFNBQVYsQ0FBN0IsQ0FMVyxDQU1YOztBQUNBLFlBQUlBLFNBQVMsQ0FBQ00sTUFBVixHQUFtQixFQUF2QixFQUEyQjtBQUN6QixnQkFBTSxDQUFOO0FBQ0QsU0FUVSxDQVVYOzs7QUFDQSxZQUFJTCxZQUFZLEdBQUdFLFlBQWYsR0FBOEJDLFVBQTlCLEdBQTJDQyxvQkFBM0MsR0FBa0UsQ0FBdEUsRUFBeUU7QUFDdkUsZ0JBQU0sQ0FBTjtBQUNEO0FBQ0Y7QUFsQk8sS0FBVixDQURLLEVBcUJMLElBQUlWLFlBQUosQ0FBVTtBQUNSQyxNQUFBQSxLQUFLLEVBQUUsdUJBREM7QUFFUkMsTUFBQUEsT0FBTyxFQUFFLDhFQUZEO0FBR1JDLE1BQUFBLFFBQVEsRUFBRSwwRUFIRjtBQUlSQyxNQUFBQSxLQUFLLEVBQUUsTUFBTTtBQUNYLFlBQUlULE1BQU0sQ0FBQ2lCLFFBQVAsSUFBbUJqQixNQUFNLENBQUNpQixRQUFQLENBQWdCQyxjQUF2QyxFQUF1RDtBQUNyRCxnQkFBTSxDQUFOO0FBQ0Q7QUFDRjtBQVJPLEtBQVYsQ0FyQkssRUErQkwsSUFBSWIsWUFBSixDQUFVO0FBQ1JDLE1BQUFBLEtBQUssRUFBRSxnQ0FEQztBQUVSQyxNQUFBQSxPQUFPLEVBQUUseUZBRkQ7QUFHUkMsTUFBQUEsUUFBUSxFQUFFLDJFQUhGO0FBSVJDLE1BQUFBLEtBQUssRUFBRSxNQUFNO0FBQ1gsWUFBSVQsTUFBTSxDQUFDbUIsd0JBQVAsSUFBbUNuQixNQUFNLENBQUNtQix3QkFBUCxJQUFtQyxJQUExRSxFQUFnRjtBQUM5RSxnQkFBTSxDQUFOO0FBQ0Q7QUFDRjtBQVJPLEtBQVYsQ0EvQkssQ0FBUDtBQTBDRDs7QUFoRDZDOztBQW1EaERDLE1BQU0sQ0FBQ0MsT0FBUCxHQUFpQnpCLHNCQUFqQiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQG1vZHVsZSBTZWN1cml0eUNoZWNrXG4gKi9cblxuaW1wb3J0IHsgQ2hlY2sgfSBmcm9tICcuLi9DaGVjayc7XG5pbXBvcnQgQ2hlY2tHcm91cCBmcm9tICcuLi9DaGVja0dyb3VwJztcbmltcG9ydCBDb25maWcgZnJvbSAnLi4vLi4vQ29uZmlnJztcbmltcG9ydCBQYXJzZSBmcm9tICdwYXJzZS9ub2RlJztcblxuLyoqXG4qIFRoZSBzZWN1cml0eSBjaGVja3MgZ3JvdXAgZm9yIFBhcnNlIFNlcnZlciBjb25maWd1cmF0aW9uLlxuKiBDaGVja3MgY29tbW9uIFBhcnNlIFNlcnZlciBwYXJhbWV0ZXJzIHN1Y2ggYXMgYWNjZXNzIGtleXMuXG4qL1xuY2xhc3MgQ2hlY2tHcm91cFNlcnZlckNvbmZpZyBleHRlbmRzIENoZWNrR3JvdXAge1xuICBzZXROYW1lKCkge1xuICAgIHJldHVybiAnUGFyc2UgU2VydmVyIENvbmZpZ3VyYXRpb24nO1xuICB9XG4gIHNldENoZWNrcygpIHtcbiAgICBjb25zdCBjb25maWcgPSBDb25maWcuZ2V0KFBhcnNlLmFwcGxpY2F0aW9uSWQpO1xuICAgIHJldHVybiBbXG4gICAgICBuZXcgQ2hlY2soe1xuICAgICAgICB0aXRsZTogJ1NlY3VyZSBtYXN0ZXIga2V5JyxcbiAgICAgICAgd2FybmluZzogJ1RoZSBQYXJzZSBTZXJ2ZXIgbWFzdGVyIGtleSBpcyBpbnNlY3VyZSBhbmQgdnVsbmVyYWJsZSB0byBicnV0ZSBmb3JjZSBhdHRhY2tzLicsXG4gICAgICAgIHNvbHV0aW9uOiAnQ2hvb3NlIGEgbG9uZ2VyIGFuZC9vciBtb3JlIGNvbXBsZXggbWFzdGVyIGtleSB3aXRoIGEgY29tYmluYXRpb24gb2YgdXBwZXItIGFuZCBsb3dlcmNhc2UgY2hhcmFjdGVycywgbnVtYmVycyBhbmQgc3BlY2lhbCBjaGFyYWN0ZXJzLicsXG4gICAgICAgIGNoZWNrOiAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgbWFzdGVyS2V5ID0gY29uZmlnLm1hc3RlcktleTtcbiAgICAgICAgICBjb25zdCBoYXNVcHBlckNhc2UgPSAvW0EtWl0vLnRlc3QobWFzdGVyS2V5KTtcbiAgICAgICAgICBjb25zdCBoYXNMb3dlckNhc2UgPSAvW2Etel0vLnRlc3QobWFzdGVyS2V5KTtcbiAgICAgICAgICBjb25zdCBoYXNOdW1iZXJzID0gL1xcZC8udGVzdChtYXN0ZXJLZXkpO1xuICAgICAgICAgIGNvbnN0IGhhc05vbkFscGhhc051bWVyaWNzID0gL1xcVy8udGVzdChtYXN0ZXJLZXkpO1xuICAgICAgICAgIC8vIEVuc3VyZSBsZW5ndGhcbiAgICAgICAgICBpZiAobWFzdGVyS2V5Lmxlbmd0aCA8IDE0KSB7XG4gICAgICAgICAgICB0aHJvdyAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBFbnN1cmUgYXQgbGVhc3QgMyBvdXQgb2YgNCByZXF1aXJlbWVudHMgcGFzc2VkXG4gICAgICAgICAgaWYgKGhhc1VwcGVyQ2FzZSArIGhhc0xvd2VyQ2FzZSArIGhhc051bWJlcnMgKyBoYXNOb25BbHBoYXNOdW1lcmljcyA8IDMpIHtcbiAgICAgICAgICAgIHRocm93IDE7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICBuZXcgQ2hlY2soe1xuICAgICAgICB0aXRsZTogJ1NlY3VyaXR5IGxvZyBkaXNhYmxlZCcsXG4gICAgICAgIHdhcm5pbmc6ICdTZWN1cml0eSBjaGVja3MgaW4gbG9ncyBtYXkgZXhwb3NlIHZ1bG5lcmFiaWxpdGllcyB0byBhbnlvbmUgYWNjZXNzIHRvIGxvZ3MuJyxcbiAgICAgICAgc29sdXRpb246ICdDaGFuZ2UgUGFyc2UgU2VydmVyIGNvbmZpZ3VyYXRpb24gdG8gXFwnc2VjdXJpdHkuZW5hYmxlQ2hlY2tMb2c6IGZhbHNlXFwnLicsXG4gICAgICAgIGNoZWNrOiAoKSA9PiB7XG4gICAgICAgICAgaWYgKGNvbmZpZy5zZWN1cml0eSAmJiBjb25maWcuc2VjdXJpdHkuZW5hYmxlQ2hlY2tMb2cpIHtcbiAgICAgICAgICAgIHRocm93IDE7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICBuZXcgQ2hlY2soe1xuICAgICAgICB0aXRsZTogJ0NsaWVudCBjbGFzcyBjcmVhdGlvbiBkaXNhYmxlZCcsXG4gICAgICAgIHdhcm5pbmc6ICdBdHRhY2tlcnMgYXJlIGFsbG93ZWQgdG8gY3JlYXRlIG5ldyBjbGFzc2VzIHdpdGhvdXQgcmVzdHJpY3Rpb24gYW5kIGZsb29kIHRoZSBkYXRhYmFzZS4nLFxuICAgICAgICBzb2x1dGlvbjogJ0NoYW5nZSBQYXJzZSBTZXJ2ZXIgY29uZmlndXJhdGlvbiB0byBcXCdhbGxvd0NsaWVudENsYXNzQ3JlYXRpb246IGZhbHNlXFwnLicsXG4gICAgICAgIGNoZWNrOiAoKSA9PiB7XG4gICAgICAgICAgaWYgKGNvbmZpZy5hbGxvd0NsaWVudENsYXNzQ3JlYXRpb24gfHwgY29uZmlnLmFsbG93Q2xpZW50Q2xhc3NDcmVhdGlvbiA9PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyAxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgIF07XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBDaGVja0dyb3VwU2VydmVyQ29uZmlnO1xuIl19