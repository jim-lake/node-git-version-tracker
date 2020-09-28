const { init: initClient, ...clientOther } = require('./client');
const { setConfig: setConfigServer, ...serverOther } = require('./server');

module.exports = {
  initClient,
  setConfigServer,
  ...clientOther,
  ...serverOther,
};
