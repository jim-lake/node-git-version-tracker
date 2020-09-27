const child_process = require('child_process');
const os = require('os');
const { join: pathJoin } = require('path');
const request = require('request');

exports.init = init;
exports.getGitHash = getGitHash;
exports.sendPhonehome = sendPhonehome;
exports.updateToHash = updateToHash;

const REST_TIMEOUT = 20 * 1000;

let g_gitHash = null;
let errorLog = _defaultErrorLog;

let g_config = {
  url: null,
  repoDir: '.',
  requestExtra: {},
  restartHandler: _defaultRestartHandler,
  interval: 0,
  timeout: REST_TIMEOUT,
};

function init(args, done) {
  Object.extend(g_config, args);
  if (args.errorLog) {
    errorLog = args.errorLog;
  }
  getGitHash((err) => {
    done(err);

    sendPhonehome(_sendLater);
  });
}

function getGitHash(done) {
  if (g_gitHash) {
    done(null, g_gitHash);
  } else {
    var cmd = 'git log -n 1 --pretty=format:"%H"';
    const opts = {
      cwd: g_config.repoDir,
    };
    child_process.exec(cmd, opts, function (err, stdout, stderr) {
      if (err) {
        errorLog('getGitHash: failed with err:', err, stdout, stderr);
      } else {
        g_gitHash = stdout.trim();
      }
      done(err, g_gitHash);
    });
  }
}
function sendPhonehome(done) {
  const opts = {
    url: g_config.url,
    body: {
      package_name: g_config.packageName,
      hostname: os.hostname(),
      git_hash: g_gitHash,
      ip_list: _getIPList(),
    },
    json: true,
    timeout: g_config.timeout,
    ...g_config.requestExtra,
  };
  request(opts, (err, response, body) => {
    const statusCode = response && response.statusCode;
    if (err) {
      errorLog('sendPhonehome: err:', err);
      done(err);
    } else if (statusCode < 200 || statusCode >= 300) {
      errorLog('sendPhonehome: bad status:', statusCode);
      done(statusCode);
    } else {
      if (body && body.git_hash && body.git_hash !== g_gitHash) {
        updateToHash(body.git_hash, done);
      } else {
        done();
      }
    }
  });
}
function updateToHash(git_hash, done) {
  const script = pathJoin(__dirname, '../scripts/git_update_to_hash.sh');
  const cmd = `${script} ${git_hash} ${g_gitHash}`;
  const opts = {
    cwd: g_config.repoDir,
  };
  child_process.exec(cmd, opts, (err, stdout, stderr) => {
    if (err) {
      errorLog(
        'updateToHash: script failed with err:',
        err,
        'stdout:',
        stdout,
        'stderr:',
        stderr
      );
      done(err);
    } else {
      g_config.restartHandler();
    }
  });
}

function _sendLater() {
  if (g_config.interval) {
    const next = sendPhonehome.bind(null, _sendLater);
    setTimeout(next, g_config.interval);
  }
}

function _getIPList() {
  const ip_list = [];
  const map = os.networkInterfaces();
  if (map) {
    for (let key in map) {
      const list = map[key];
      if (list && list.length > 0) {
        list.forEach((iface) => {
          const { internal, address } = iface;
          if (
            !internal &&
            address &&
            !address.startsWith('fe80') &&
            !address.startsWith('169.254')
          ) {
            ip_list.push(address);
          }
        });
      }
    }
  }
  return ip_list;
}
function _defaultErrorLog(...args) {
  console.error(...args);
}
function _defaultRestartHandler() {
  setTimeout(() => {
    process.exit(0);
  }, 100);
}
