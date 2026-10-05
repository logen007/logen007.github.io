const base = require('./index.js');
const attempts = require('./attempts.js');
const secureGrading = require('./secure-grading.js');
const integrity = require('./integrity.js');
const concurrency = require('./concurrency.js');
const settings = require('./settings.js');

module.exports = {
  ...base,
  ...attempts,
  ...secureGrading,
  ...integrity,
  ...concurrency,
  ...settings,
};
