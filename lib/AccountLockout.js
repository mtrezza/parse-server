"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.AccountLockout = void 0;

var _node = _interopRequireDefault(require("parse/node"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// This class handles the Account Lockout Policy settings.
class AccountLockout {
  constructor(user, config) {
    this._user = user;
    this._config = config;
  }
  /**
   * set _failed_login_count to value
   */


  _setFailedLoginCount(value) {
    const query = {
      username: this._user.username
    };
    const updateFields = {
      _failed_login_count: value
    };
    return this._config.database.update('_User', query, updateFields);
  }
  /**
   * check if the _failed_login_count field has been set
   */


  _isFailedLoginCountSet() {
    const query = {
      username: this._user.username,
      _failed_login_count: {
        $exists: true
      }
    };
    return this._config.database.find('_User', query).then(users => {
      if (Array.isArray(users) && users.length > 0) {
        return true;
      } else {
        return false;
      }
    });
  }
  /**
   * if _failed_login_count is NOT set then set it to 0
   * else do nothing
   */


  _initFailedLoginCount() {
    return this._isFailedLoginCountSet().then(failedLoginCountIsSet => {
      if (!failedLoginCountIsSet) {
        return this._setFailedLoginCount(0);
      }
    });
  }
  /**
   * increment _failed_login_count by 1
   */


  _incrementFailedLoginCount() {
    const query = {
      username: this._user.username
    };
    const updateFields = {
      _failed_login_count: {
        __op: 'Increment',
        amount: 1
      }
    };
    return this._config.database.update('_User', query, updateFields);
  }
  /**
   * if the failed login count is greater than the threshold
   * then sets lockout expiration to 'currenttime + accountPolicy.duration', i.e., account is locked out for the next 'accountPolicy.duration' minutes
   * else do nothing
   */


  _setLockoutExpiration() {
    const query = {
      username: this._user.username,
      _failed_login_count: {
        $gte: this._config.accountLockout.threshold
      }
    };
    const now = new Date();
    const updateFields = {
      _account_lockout_expires_at: _node.default._encode(new Date(now.getTime() + this._config.accountLockout.duration * 60 * 1000))
    };
    return this._config.database.update('_User', query, updateFields).catch(err => {
      if (err && err.code && err.message && err.code === 101 && err.message === 'Object not found.') {
        return; // nothing to update so we are good
      } else {
        throw err; // unknown error
      }
    });
  }
  /**
   * if _account_lockout_expires_at > current_time and _failed_login_count > threshold
   *   reject with account locked error
   * else
   *   resolve
   */


  _notLocked() {
    const query = {
      username: this._user.username,
      _account_lockout_expires_at: {
        $gt: _node.default._encode(new Date())
      },
      _failed_login_count: {
        $gte: this._config.accountLockout.threshold
      }
    };
    return this._config.database.find('_User', query).then(users => {
      if (Array.isArray(users) && users.length > 0) {
        throw new _node.default.Error(_node.default.Error.OBJECT_NOT_FOUND, 'Your account is locked due to multiple failed login attempts. Please try again after ' + this._config.accountLockout.duration + ' minute(s)');
      }
    });
  }
  /**
   * set and/or increment _failed_login_count
   * if _failed_login_count > threshold
   *   set the _account_lockout_expires_at to current_time + accountPolicy.duration
   * else
   *   do nothing
   */


  _handleFailedLoginAttempt() {
    return this._initFailedLoginCount().then(() => {
      return this._incrementFailedLoginCount();
    }).then(() => {
      return this._setLockoutExpiration();
    });
  }
  /**
   * handle login attempt if the Account Lockout Policy is enabled
   */


  handleLoginAttempt(loginSuccessful) {
    if (!this._config.accountLockout) {
      return Promise.resolve();
    }

    return this._notLocked().then(() => {
      if (loginSuccessful) {
        return this._setFailedLoginCount(0);
      } else {
        return this._handleFailedLoginAttempt();
      }
    });
  }

}

exports.AccountLockout = AccountLockout;
var _default = AccountLockout;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9BY2NvdW50TG9ja291dC5qcyJdLCJuYW1lcyI6WyJBY2NvdW50TG9ja291dCIsImNvbnN0cnVjdG9yIiwidXNlciIsImNvbmZpZyIsIl91c2VyIiwiX2NvbmZpZyIsIl9zZXRGYWlsZWRMb2dpbkNvdW50IiwidmFsdWUiLCJxdWVyeSIsInVzZXJuYW1lIiwidXBkYXRlRmllbGRzIiwiX2ZhaWxlZF9sb2dpbl9jb3VudCIsImRhdGFiYXNlIiwidXBkYXRlIiwiX2lzRmFpbGVkTG9naW5Db3VudFNldCIsIiRleGlzdHMiLCJmaW5kIiwidGhlbiIsInVzZXJzIiwiQXJyYXkiLCJpc0FycmF5IiwibGVuZ3RoIiwiX2luaXRGYWlsZWRMb2dpbkNvdW50IiwiZmFpbGVkTG9naW5Db3VudElzU2V0IiwiX2luY3JlbWVudEZhaWxlZExvZ2luQ291bnQiLCJfX29wIiwiYW1vdW50IiwiX3NldExvY2tvdXRFeHBpcmF0aW9uIiwiJGd0ZSIsImFjY291bnRMb2Nrb3V0IiwidGhyZXNob2xkIiwibm93IiwiRGF0ZSIsIl9hY2NvdW50X2xvY2tvdXRfZXhwaXJlc19hdCIsIlBhcnNlIiwiX2VuY29kZSIsImdldFRpbWUiLCJkdXJhdGlvbiIsImNhdGNoIiwiZXJyIiwiY29kZSIsIm1lc3NhZ2UiLCJfbm90TG9ja2VkIiwiJGd0IiwiRXJyb3IiLCJPQkpFQ1RfTk9UX0ZPVU5EIiwiX2hhbmRsZUZhaWxlZExvZ2luQXR0ZW1wdCIsImhhbmRsZUxvZ2luQXR0ZW1wdCIsImxvZ2luU3VjY2Vzc2Z1bCIsIlByb21pc2UiLCJyZXNvbHZlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQ0E7Ozs7QUFEQTtBQUdPLE1BQU1BLGNBQU4sQ0FBcUI7QUFDMUJDLEVBQUFBLFdBQVcsQ0FBQ0MsSUFBRCxFQUFPQyxNQUFQLEVBQWU7QUFDeEIsU0FBS0MsS0FBTCxHQUFhRixJQUFiO0FBQ0EsU0FBS0csT0FBTCxHQUFlRixNQUFmO0FBQ0Q7QUFFRDtBQUNGO0FBQ0E7OztBQUNFRyxF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MEJBQUwsRUFBUDtBQUNELEtBSEksRUFJSlAsSUFKSSxDQUlDLE1BQU07QUFDVixhQUFPLEtBQUtVLHFCQUFMLEVBQVA7QUFDRCxLQU5JLENBQVA7QUFPRDtBQUVEO0FBQ0Y7QUFDQTs7O0FBQ0VvQixFQUFBQSxrQkFBa0IsQ0FBQ0MsZUFBRCxFQUFrQjtBQUNsQyxRQUFJLENBQUMsS0FBSzNDLE9BQUwsQ0FBYXdCLGNBQWxCLEVBQWtDO0FBQ2hDLGFBQU9vQixPQUFPLENBQUNDLE9BQVIsRUFBUDtBQUNEOztBQUNELFdBQU8sS0FBS1IsVUFBTCxHQUFrQnpCLElBQWxCLENBQXVCLE1BQU07QUFDbEMsVUFBSStCLGVBQUosRUFBcUI7QUFDbkIsZUFBTyxLQUFLMUMsb0JBQUwsQ0FBMEIsQ0FBMUIsQ0FBUDtBQUNELE9BRkQsTUFFTztBQUNMLGVBQU8sS0FBS3dDLHlCQUFMLEVBQVA7QUFDRDtBQUNGLEtBTk0sQ0FBUDtBQU9EOztBQTVKeUI7OztlQStKYjlDLGMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBUaGlzIGNsYXNzIGhhbmRsZXMgdGhlIEFjY291bnQgTG9ja291dCBQb2xpY3kgc2V0dGluZ3MuXG5pbXBvcnQgUGFyc2UgZnJvbSAncGFyc2Uvbm9kZSc7XG5cbmV4cG9ydCBjbGFzcyBBY2NvdW50TG9ja291dCB7XG4gIGNvbnN0cnVjdG9yKHVzZXIsIGNvbmZpZykge1xuICAgIHRoaXMuX3VzZXIgPSB1c2VyO1xuICAgIHRoaXMuX2NvbmZpZyA9IGNvbmZpZztcbiAgfVxuXG4gIC8qKlxuICAgKiBzZXQgX2ZhaWxlZF9sb2dpbl9jb3VudCB0byB2YWx1ZVxuICAgKi9cbiAgX3NldEZhaWxlZExvZ2luQ291bnQodmFsdWUpIHtcbiAgICBjb25zdCBxdWVyeSA9IHtcbiAgICAgIHVzZXJuYW1lOiB0aGlzLl91c2VyLnVzZXJuYW1lLFxuICAgIH07XG5cbiAgICBjb25zdCB1cGRhdGVGaWVsZHMgPSB7XG4gICAgICBfZmFpbGVkX2xvZ2luX2NvdW50OiB2YWx1ZSxcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMuX2NvbmZpZy5kYXRhYmFzZS51cGRhdGUoJ19Vc2VyJywgcXVlcnksIHVwZGF0ZUZpZWxkcyk7XG4gIH1cblxuICAvKipcbiAgICogY2hlY2sgaWYgdGhlIF9mYWlsZWRfbG9naW5fY291bnQgZmllbGQgaGFzIGJlZW4gc2V0XG4gICAqL1xuICBfaXNGYWlsZWRMb2dpbkNvdW50U2V0KCkge1xuICAgIGNvbnN0IHF1ZXJ5ID0ge1xuICAgICAgdXNlcm5hbWU6IHRoaXMuX3VzZXIudXNlcm5hbWUsXG4gICAgICBfZmFpbGVkX2xvZ2luX2NvdW50OiB7ICRleGlzdHM6IHRydWUgfSxcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMuX2NvbmZpZy5kYXRhYmFzZS5maW5kKCdfVXNlcicsIHF1ZXJ5KS50aGVuKHVzZXJzID0+IHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHVzZXJzKSAmJiB1c2Vycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIGlmIF9mYWlsZWRfbG9naW5fY291bnQgaXMgTk9UIHNldCB0aGVuIHNldCBpdCB0byAwXG4gICAqIGVsc2UgZG8gbm90aGluZ1xuICAgKi9cbiAgX2luaXRGYWlsZWRMb2dpbkNvdW50KCkge1xuICAgIHJldHVybiB0aGlzLl9pc0ZhaWxlZExvZ2luQ291bnRTZXQoKS50aGVuKGZhaWxlZExvZ2luQ291bnRJc1NldCA9PiB7XG4gICAgICBpZiAoIWZhaWxlZExvZ2luQ291bnRJc1NldCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2V0RmFpbGVkTG9naW5Db3VudCgwKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBpbmNyZW1lbnQgX2ZhaWxlZF9sb2dpbl9jb3VudCBieSAxXG4gICAqL1xuICBfaW5jcmVtZW50RmFpbGVkTG9naW5Db3VudCgpIHtcbiAgICBjb25zdCBxdWVyeSA9IHtcbiAgICAgIHVzZXJuYW1lOiB0aGlzLl91c2VyLnVzZXJuYW1lLFxuICAgIH07XG5cbiAgICBjb25zdCB1cGRhdGVGaWVsZHMgPSB7XG4gICAgICBfZmFpbGVkX2xvZ2luX2NvdW50OiB7IF9fb3A6ICdJbmNyZW1lbnQnLCBhbW91bnQ6IDEgfSxcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMuX2NvbmZpZy5kYXRhYmFzZS51cGRhdGUoJ19Vc2VyJywgcXVlcnksIHVwZGF0ZUZpZWxkcyk7XG4gIH1cblxuICAvKipcbiAgICogaWYgdGhlIGZhaWxlZCBsb2dpbiBjb3VudCBpcyBncmVhdGVyIHRoYW4gdGhlIHRocmVzaG9sZFxuICAgKiB0aGVuIHNldHMgbG9ja291dCBleHBpcmF0aW9uIHRvICdjdXJyZW50dGltZSArIGFjY291bnRQb2xpY3kuZHVyYXRpb24nLCBpLmUuLCBhY2NvdW50IGlzIGxvY2tlZCBvdXQgZm9yIHRoZSBuZXh0ICdhY2NvdW50UG9saWN5LmR1cmF0aW9uJyBtaW51dGVzXG4gICAqIGVsc2UgZG8gbm90aGluZ1xuICAgKi9cbiAgX3NldExvY2tvdXRFeHBpcmF0aW9uKCkge1xuICAgIGNvbnN0IHF1ZXJ5ID0ge1xuICAgICAgdXNlcm5hbWU6IHRoaXMuX3VzZXIudXNlcm5hbWUsXG4gICAgICBfZmFpbGVkX2xvZ2luX2NvdW50OiB7ICRndGU6IHRoaXMuX2NvbmZpZy5hY2NvdW50TG9ja291dC50aHJlc2hvbGQgfSxcbiAgICB9O1xuXG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcblxuICAgIGNvbnN0IHVwZGF0ZUZpZWxkcyA9IHtcbiAgICAgIF9hY2NvdW50X2xvY2tvdXRfZXhwaXJlc19hdDogUGFyc2UuX2VuY29kZShcbiAgICAgICAgbmV3IERhdGUobm93LmdldFRpbWUoKSArIHRoaXMuX2NvbmZpZy5hY2NvdW50TG9ja291dC5kdXJhdGlvbiAqIDYwICogMTAwMClcbiAgICAgICksXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLl9jb25maWcuZGF0YWJhc2UudXBkYXRlKCdfVXNlcicsIHF1ZXJ5LCB1cGRhdGVGaWVsZHMpLmNhdGNoKGVyciA9PiB7XG4gICAgICBpZiAoXG4gICAgICAgIGVyciAmJlxuICAgICAgICBlcnIuY29kZSAmJlxuICAgICAgICBlcnIubWVzc2FnZSAmJlxuICAgICAgICBlcnIuY29kZSA9PT0gMTAxICYmXG4gICAgICAgIGVyci5tZXNzYWdlID09PSAnT2JqZWN0IG5vdCBmb3VuZC4nXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuOyAvLyBub3RoaW5nIHRvIHVwZGF0ZSBzbyB3ZSBhcmUgZ29vZFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZXJyOyAvLyB1bmtub3duIGVycm9yXG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogaWYgX2FjY291bnRfbG9ja291dF9leHBpcmVzX2F0ID4gY3VycmVudF90aW1lIGFuZCBfZmFpbGVkX2xvZ2luX2NvdW50ID4gdGhyZXNob2xkXG4gICAqICAgcmVqZWN0IHdpdGggYWNjb3VudCBsb2NrZWQgZXJyb3JcbiAgICogZWxzZVxuICAgKiAgIHJlc29sdmVcbiAgICovXG4gIF9ub3RMb2NrZWQoKSB7XG4gICAgY29uc3QgcXVlcnkgPSB7XG4gICAgICB1c2VybmFtZTogdGhpcy5fdXNlci51c2VybmFtZSxcbiAgICAgIF9hY2NvdW50X2xvY2tvdXRfZXhwaXJlc19hdDogeyAkZ3Q6IFBhcnNlLl9lbmNvZGUobmV3IERhdGUoKSkgfSxcbiAgICAgIF9mYWlsZWRfbG9naW5fY291bnQ6IHsgJGd0ZTogdGhpcy5fY29uZmlnLmFjY291bnRMb2Nrb3V0LnRocmVzaG9sZCB9LFxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5fY29uZmlnLmRhdGFiYXNlLmZpbmQoJ19Vc2VyJywgcXVlcnkpLnRoZW4odXNlcnMgPT4ge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkodXNlcnMpICYmIHVzZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgIFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQsXG4gICAgICAgICAgJ1lvdXIgYWNjb3VudCBpcyBsb2NrZWQgZHVlIHRvIG11bHRpcGxlIGZhaWxlZCBsb2dpbiBhdHRlbXB0cy4gUGxlYXNlIHRyeSBhZ2FpbiBhZnRlciAnICtcbiAgICAgICAgICAgIHRoaXMuX2NvbmZpZy5hY2NvdW50TG9ja291dC5kdXJhdGlvbiArXG4gICAgICAgICAgICAnIG1pbnV0ZShzKSdcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBzZXQgYW5kL29yIGluY3JlbWVudCBfZmFpbGVkX2xvZ2luX2NvdW50XG4gICAqIGlmIF9mYWlsZWRfbG9naW5fY291bnQgPiB0aHJlc2hvbGRcbiAgICogICBzZXQgdGhlIF9hY2NvdW50X2xvY2tvdXRfZXhwaXJlc19hdCB0byBjdXJyZW50X3RpbWUgKyBhY2NvdW50UG9saWN5LmR1cmF0aW9uXG4gICAqIGVsc2VcbiAgICogICBkbyBub3RoaW5nXG4gICAqL1xuICBfaGFuZGxlRmFpbGVkTG9naW5BdHRlbXB0KCkge1xuICAgIHJldHVybiB0aGlzLl9pbml0RmFpbGVkTG9naW5Db3VudCgpXG4gICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbmNyZW1lbnRGYWlsZWRMb2dpbkNvdW50KCk7XG4gICAgICB9KVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2V0TG9ja291dEV4cGlyYXRpb24oKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIGhhbmRsZSBsb2dpbiBhdHRlbXB0IGlmIHRoZSBBY2NvdW50IExvY2tvdXQgUG9saWN5IGlzIGVuYWJsZWRcbiAgICovXG4gIGhhbmRsZUxvZ2luQXR0ZW1wdChsb2dpblN1Y2Nlc3NmdWwpIHtcbiAgICBpZiAoIXRoaXMuX2NvbmZpZy5hY2NvdW50TG9ja291dCkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fbm90TG9ja2VkKCkudGhlbigoKSA9PiB7XG4gICAgICBpZiAobG9naW5TdWNjZXNzZnVsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zZXRGYWlsZWRMb2dpbkNvdW50KDApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2hhbmRsZUZhaWxlZExvZ2luQXR0ZW1wdCgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFjY291bnRMb2Nrb3V0O1xuIl19