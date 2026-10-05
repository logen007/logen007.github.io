const base = require('./index.js');
const attempts = require('./attempts.js');
const secureGrading = require('./secure-grading.js');

module.exports = {
  ...base,
  ...attempts,
  ...secureGrading,
};
