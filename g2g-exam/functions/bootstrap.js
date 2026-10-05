const base = require('./index.js');
const attempts = require('./attempts.js');
const secureGrading = require('./secure-grading.js');
const integrity = require('./integrity.js');
const concurrency = require('./concurrency.js');
const settings = require('./settings.js');
const mailer = require('./mailer.js');

module.exports = {
  ...base,
  ...secureGrading,
  ...integrity,
  ...concurrency,
  // attempt lifecycle functions intentionally come last so the hardened
  // deadline-aware start/section/abandon implementations win on name clashes.
  ...attempts,
  ...settings,
  updateSmtpSecret: mailer.updateSmtpSecret,
  getInfrastructureStatus: mailer.getInfrastructureStatus,
  testSmtp: mailer.testSmtp,
};
