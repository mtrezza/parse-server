"use strict";

// Helper functions for accessing the meetup API.
var Parse = require('parse/node').Parse;
const httpsRequest = require('./httpsRequest');

// Returns a promise that fulfills iff this user id is valid.
function validateAuthData(authData) {
  return request('member/self', authData.access_token).then(data => {
    if (data && data.id == authData.id) {
      return;
    }
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Meetup auth is invalid for this user.');
  });
}

// Returns a promise that fulfills iff this app id is valid.
function validateAppId() {
  return Promise.resolve();
}

// A promisey wrapper for api requests
function request(path, access_token) {
  return httpsRequest.get({
    host: 'api.meetup.com',
    path: '/2/' + path,
    headers: {
      Authorization: 'bearer ' + access_token
    }
  });
}
module.exports = {
  validateAppId: validateAppId,
  validateAuthData: validateAuthData
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJQYXJzZSIsInJlcXVpcmUiLCJodHRwc1JlcXVlc3QiLCJ2YWxpZGF0ZUF1dGhEYXRhIiwiYXV0aERhdGEiLCJyZXF1ZXN0IiwiYWNjZXNzX3Rva2VuIiwidGhlbiIsImRhdGEiLCJpZCIsIkVycm9yIiwiT0JKRUNUX05PVF9GT1VORCIsInZhbGlkYXRlQXBwSWQiLCJQcm9taXNlIiwicmVzb2x2ZSIsInBhdGgiLCJnZXQiLCJob3N0IiwiaGVhZGVycyIsIkF1dGhvcml6YXRpb24iLCJtb2R1bGUiLCJleHBvcnRzIl0sInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL0FkYXB0ZXJzL0F1dGgvbWVldHVwLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIEhlbHBlciBmdW5jdGlvbnMgZm9yIGFjY2Vzc2luZyB0aGUgbWVldHVwIEFQSS5cbnZhciBQYXJzZSA9IHJlcXVpcmUoJ3BhcnNlL25vZGUnKS5QYXJzZTtcbmNvbnN0IGh0dHBzUmVxdWVzdCA9IHJlcXVpcmUoJy4vaHR0cHNSZXF1ZXN0Jyk7XG5cbi8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgZnVsZmlsbHMgaWZmIHRoaXMgdXNlciBpZCBpcyB2YWxpZC5cbmZ1bmN0aW9uIHZhbGlkYXRlQXV0aERhdGEoYXV0aERhdGEpIHtcbiAgcmV0dXJuIHJlcXVlc3QoJ21lbWJlci9zZWxmJywgYXV0aERhdGEuYWNjZXNzX3Rva2VuKS50aGVuKGRhdGEgPT4ge1xuICAgIGlmIChkYXRhICYmIGRhdGEuaWQgPT0gYXV0aERhdGEuaWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQsICdNZWV0dXAgYXV0aCBpcyBpbnZhbGlkIGZvciB0aGlzIHVzZXIuJyk7XG4gIH0pO1xufVxuXG4vLyBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGZ1bGZpbGxzIGlmZiB0aGlzIGFwcCBpZCBpcyB2YWxpZC5cbmZ1bmN0aW9uIHZhbGlkYXRlQXBwSWQoKSB7XG4gIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbn1cblxuLy8gQSBwcm9taXNleSB3cmFwcGVyIGZvciBhcGkgcmVxdWVzdHNcbmZ1bmN0aW9uIHJlcXVlc3QocGF0aCwgYWNjZXNzX3Rva2VuKSB7XG4gIHJldHVybiBodHRwc1JlcXVlc3QuZ2V0KHtcbiAgICBob3N0OiAnYXBpLm1lZXR1cC5jb20nLFxuICAgIHBhdGg6ICcvMi8nICsgcGF0aCxcbiAgICBoZWFkZXJzOiB7XG4gICAgICBBdXRob3JpemF0aW9uOiAnYmVhcmVyICcgKyBhY2Nlc3NfdG9rZW4sXG4gICAgfSxcbiAgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICB2YWxpZGF0ZUFwcElkOiB2YWxpZGF0ZUFwcElkLFxuICB2YWxpZGF0ZUF1dGhEYXRhOiB2YWxpZGF0ZUF1dGhEYXRhLFxufTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBLElBQUlBLEtBQUssR0FBR0MsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDRCxLQUFLO0FBQ3ZDLE1BQU1FLFlBQVksR0FBR0QsT0FBTyxDQUFDLGdCQUFnQixDQUFDOztBQUU5QztBQUNBLFNBQVNFLGdCQUFnQixDQUFDQyxRQUFRLEVBQUU7RUFDbEMsT0FBT0MsT0FBTyxDQUFDLGFBQWEsRUFBRUQsUUFBUSxDQUFDRSxZQUFZLENBQUMsQ0FBQ0MsSUFBSSxDQUFDQyxJQUFJLElBQUk7SUFDaEUsSUFBSUEsSUFBSSxJQUFJQSxJQUFJLENBQUNDLEVBQUUsSUFBSUwsUUFBUSxDQUFDSyxFQUFFLEVBQUU7TUFDbEM7SUFDRjtJQUNBLE1BQU0sSUFBSVQsS0FBSyxDQUFDVSxLQUFLLENBQUNWLEtBQUssQ0FBQ1UsS0FBSyxDQUFDQyxnQkFBZ0IsRUFBRSx1Q0FBdUMsQ0FBQztFQUM5RixDQUFDLENBQUM7QUFDSjs7QUFFQTtBQUNBLFNBQVNDLGFBQWEsR0FBRztFQUN2QixPQUFPQyxPQUFPLENBQUNDLE9BQU8sRUFBRTtBQUMxQjs7QUFFQTtBQUNBLFNBQVNULE9BQU8sQ0FBQ1UsSUFBSSxFQUFFVCxZQUFZLEVBQUU7RUFDbkMsT0FBT0osWUFBWSxDQUFDYyxHQUFHLENBQUM7SUFDdEJDLElBQUksRUFBRSxnQkFBZ0I7SUFDdEJGLElBQUksRUFBRSxLQUFLLEdBQUdBLElBQUk7SUFDbEJHLE9BQU8sRUFBRTtNQUNQQyxhQUFhLEVBQUUsU0FBUyxHQUFHYjtJQUM3QjtFQUNGLENBQUMsQ0FBQztBQUNKO0FBRUFjLE1BQU0sQ0FBQ0MsT0FBTyxHQUFHO0VBQ2ZULGFBQWEsRUFBRUEsYUFBYTtFQUM1QlQsZ0JBQWdCLEVBQUVBO0FBQ3BCLENBQUMifQ==