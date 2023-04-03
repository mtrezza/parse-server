"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.transformClassNameToGraphQL = void 0;
const transformClassNameToGraphQL = className => {
  if (className[0] === '_') {
    className = className.slice(1);
  }
  return className[0].toUpperCase() + className.slice(1);
};
exports.transformClassNameToGraphQL = transformClassNameToGraphQL;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJ0cmFuc2Zvcm1DbGFzc05hbWVUb0dyYXBoUUwiLCJjbGFzc05hbWUiLCJzbGljZSIsInRvVXBwZXJDYXNlIl0sInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL0dyYXBoUUwvdHJhbnNmb3JtZXJzL2NsYXNzTmFtZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB0cmFuc2Zvcm1DbGFzc05hbWVUb0dyYXBoUUwgPSBjbGFzc05hbWUgPT4ge1xuICBpZiAoY2xhc3NOYW1lWzBdID09PSAnXycpIHtcbiAgICBjbGFzc05hbWUgPSBjbGFzc05hbWUuc2xpY2UoMSk7XG4gIH1cbiAgcmV0dXJuIGNsYXNzTmFtZVswXS50b1VwcGVyQ2FzZSgpICsgY2xhc3NOYW1lLnNsaWNlKDEpO1xufTtcblxuZXhwb3J0IHsgdHJhbnNmb3JtQ2xhc3NOYW1lVG9HcmFwaFFMIH07XG4iXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLE1BQU1BLDJCQUEyQixHQUFHQyxTQUFTLElBQUk7RUFDL0MsSUFBSUEsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRTtJQUN4QkEsU0FBUyxHQUFHQSxTQUFTLENBQUNDLEtBQUssQ0FBQyxDQUFDLENBQUM7RUFDaEM7RUFDQSxPQUFPRCxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUNFLFdBQVcsRUFBRSxHQUFHRixTQUFTLENBQUNDLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDeEQsQ0FBQztBQUFDIn0=