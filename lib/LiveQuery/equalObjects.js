"use strict";

var toString = Object.prototype.toString;

/**
 * Determines whether two objects represent the same primitive, special Parse
 * type, or full Parse Object.
 */
function equalObjects(a, b) {
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a !== 'object') {
    return a === b;
  }
  if (a === b) {
    return true;
  }
  if (toString.call(a) === '[object Date]') {
    if (toString.call(b) === '[object Date]') {
      return +a === +b;
    }
    return false;
  }
  if (Array.isArray(a)) {
    if (Array.isArray(b)) {
      if (a.length !== b.length) {
        return false;
      }
      for (var i = 0; i < a.length; i++) {
        if (!equalObjects(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }
    return false;
  }
  if (Object.keys(a).length !== Object.keys(b).length) {
    return false;
  }
  for (var key in a) {
    if (!equalObjects(a[key], b[key])) {
      return false;
    }
  }
  return true;
}
module.exports = equalObjects;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJ0b1N0cmluZyIsIk9iamVjdCIsInByb3RvdHlwZSIsImVxdWFsT2JqZWN0cyIsImEiLCJiIiwiY2FsbCIsIkFycmF5IiwiaXNBcnJheSIsImxlbmd0aCIsImkiLCJrZXlzIiwia2V5IiwibW9kdWxlIiwiZXhwb3J0cyJdLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9MaXZlUXVlcnkvZXF1YWxPYmplY3RzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbInZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogRGV0ZXJtaW5lcyB3aGV0aGVyIHR3byBvYmplY3RzIHJlcHJlc2VudCB0aGUgc2FtZSBwcmltaXRpdmUsIHNwZWNpYWwgUGFyc2VcbiAqIHR5cGUsIG9yIGZ1bGwgUGFyc2UgT2JqZWN0LlxuICovXG5mdW5jdGlvbiBlcXVhbE9iamVjdHMoYSwgYikge1xuICBpZiAodHlwZW9mIGEgIT09IHR5cGVvZiBiKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICh0eXBlb2YgYSAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gYSA9PT0gYjtcbiAgfVxuICBpZiAoYSA9PT0gYikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGlmICh0b1N0cmluZy5jYWxsKGEpID09PSAnW29iamVjdCBEYXRlXScpIHtcbiAgICBpZiAodG9TdHJpbmcuY2FsbChiKSA9PT0gJ1tvYmplY3QgRGF0ZV0nKSB7XG4gICAgICByZXR1cm4gK2EgPT09ICtiO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKEFycmF5LmlzQXJyYXkoYSkpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShiKSkge1xuICAgICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKCFlcXVhbE9iamVjdHMoYVtpXSwgYltpXSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKE9iamVjdC5rZXlzKGEpLmxlbmd0aCAhPT0gT2JqZWN0LmtleXMoYikubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGZvciAodmFyIGtleSBpbiBhKSB7XG4gICAgaWYgKCFlcXVhbE9iamVjdHMoYVtrZXldLCBiW2tleV0pKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGVxdWFsT2JqZWN0cztcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQSxJQUFJQSxRQUFRLEdBQUdDLE1BQU0sQ0FBQ0MsU0FBUyxDQUFDRixRQUFROztBQUV4QztBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNHLFlBQVksQ0FBQ0MsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDMUIsSUFBSSxPQUFPRCxDQUFDLEtBQUssT0FBT0MsQ0FBQyxFQUFFO0lBQ3pCLE9BQU8sS0FBSztFQUNkO0VBQ0EsSUFBSSxPQUFPRCxDQUFDLEtBQUssUUFBUSxFQUFFO0lBQ3pCLE9BQU9BLENBQUMsS0FBS0MsQ0FBQztFQUNoQjtFQUNBLElBQUlELENBQUMsS0FBS0MsQ0FBQyxFQUFFO0lBQ1gsT0FBTyxJQUFJO0VBQ2I7RUFDQSxJQUFJTCxRQUFRLENBQUNNLElBQUksQ0FBQ0YsQ0FBQyxDQUFDLEtBQUssZUFBZSxFQUFFO0lBQ3hDLElBQUlKLFFBQVEsQ0FBQ00sSUFBSSxDQUFDRCxDQUFDLENBQUMsS0FBSyxlQUFlLEVBQUU7TUFDeEMsT0FBTyxDQUFDRCxDQUFDLEtBQUssQ0FBQ0MsQ0FBQztJQUNsQjtJQUNBLE9BQU8sS0FBSztFQUNkO0VBQ0EsSUFBSUUsS0FBSyxDQUFDQyxPQUFPLENBQUNKLENBQUMsQ0FBQyxFQUFFO0lBQ3BCLElBQUlHLEtBQUssQ0FBQ0MsT0FBTyxDQUFDSCxDQUFDLENBQUMsRUFBRTtNQUNwQixJQUFJRCxDQUFDLENBQUNLLE1BQU0sS0FBS0osQ0FBQyxDQUFDSSxNQUFNLEVBQUU7UUFDekIsT0FBTyxLQUFLO01BQ2Q7TUFDQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR04sQ0FBQyxDQUFDSyxNQUFNLEVBQUVDLENBQUMsRUFBRSxFQUFFO1FBQ2pDLElBQUksQ0FBQ1AsWUFBWSxDQUFDQyxDQUFDLENBQUNNLENBQUMsQ0FBQyxFQUFFTCxDQUFDLENBQUNLLENBQUMsQ0FBQyxDQUFDLEVBQUU7VUFDN0IsT0FBTyxLQUFLO1FBQ2Q7TUFDRjtNQUNBLE9BQU8sSUFBSTtJQUNiO0lBQ0EsT0FBTyxLQUFLO0VBQ2Q7RUFDQSxJQUFJVCxNQUFNLENBQUNVLElBQUksQ0FBQ1AsQ0FBQyxDQUFDLENBQUNLLE1BQU0sS0FBS1IsTUFBTSxDQUFDVSxJQUFJLENBQUNOLENBQUMsQ0FBQyxDQUFDSSxNQUFNLEVBQUU7SUFDbkQsT0FBTyxLQUFLO0VBQ2Q7RUFDQSxLQUFLLElBQUlHLEdBQUcsSUFBSVIsQ0FBQyxFQUFFO0lBQ2pCLElBQUksQ0FBQ0QsWUFBWSxDQUFDQyxDQUFDLENBQUNRLEdBQUcsQ0FBQyxFQUFFUCxDQUFDLENBQUNPLEdBQUcsQ0FBQyxDQUFDLEVBQUU7TUFDakMsT0FBTyxLQUFLO0lBQ2Q7RUFDRjtFQUNBLE9BQU8sSUFBSTtBQUNiO0FBRUFDLE1BQU0sQ0FBQ0MsT0FBTyxHQUFHWCxZQUFZIn0=