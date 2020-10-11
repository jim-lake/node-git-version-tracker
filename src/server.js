const async = require('async');

exports.setConfig = setConfig;
exports.phonehomeHandler = phonehomeHandler;
exports.findVersionForHost = findVersionForHost;
exports.fetchClientsByPackage = fetchClientsByPackage;

let g_config = {
  pool: null,
  phonehomeTable: 'ngvt_phonehome',
  versionTable: 'ngvt_version',
};
let errorLog = _defaultErrorLog;

function setConfig(args) {
  Object.assign(g_config, args);
  if (args.errorLog) {
    errorLog = args.errorLog;
  }
}

function phonehomeHandler(req, res) {
  res.header('Cache-Control', 'no-cache,no-store,must-revalidate');
  const package_name = _reqString(req, 'package_name');
  const hostname = _reqString(req, 'hostname');
  const git_hash = _reqString(req, 'git_hash');
  const raw_ip_list = req.body.ip_list;

  let ip_list = '';
  if (Array.isArray(raw_ip_list)) {
    ip_list = raw_ip_list.join(',');
  } else if (typeof raw_ip_list === 'string') {
    ip_list = raw_ip_list;
  }

  if (!package_name) {
    res.status(400).send('package_name is required');
  } else if (!hostname) {
    res.status(400).send('hostname is required');
  } else {
    const body = {};
    async.series(
      [
        (done) => {
          if (git_hash) {
            const sql = `
INSERT INTO ${g_config.phonehomeTable} SET ?
ON DUPLICATE KEY UPDATE last_updated = NOW(), ?
`;
            const new_obj = {
              package_name,
              hostname: hostname.split('.')[0],
              git_hash,
              ip_list,
            };
            const updates = {
              git_hash,
              ip_list,
            };
            const values = [new_obj, updates];
            g_config.pool.query(sql, values, (err) => {
              if (err) {
                errorLog('phonehomeHandler: insert err:', err);
              }
              done(err);
            });
          } else {
            done();
          }
        },
        (done) => {
          const sql = `
SELECT hostname_regex, git_hash
FROM ${g_config.versionTable}
WHERE package_name = ?
ORDER BY match_priority DESC, hostname_regex ASC
`;
          g_config.pool.query(sql, [package_name], (err, results) => {
            if (err) {
              errorLog('phonehomeHandler: find version err:', err);
            } else {
              const found = findVersionForHost(results, hostname);
              if (found) {
                body.git_hash = found.git_hash;
              }
            }
            done(err);
          });
        },
      ],
      (err) => {
        if (err) {
          res.sendStatus(500);
        } else {
          res.send(body);
        }
      }
    );
  }
}

function fetchClientsByPackage(package_name, done) {
  let client_list = [];
  async.series(
    [
      (done) => {
        const sql = `
SELECT hostname, created_time, last_updated, git_hash, ip_list
FROM ${g_config.phonehomeTable}
WHERE package_name = ?
`;
        g_config.pool.query(sql, [package_name], (err, results) => {
          if (err) {
            errorLog('fetchClientsByPackage: phonehome fetch err:', err);
          } else {
            client_list = results;
          }
          done(err);
        });
      },
      (done) => {
        if (client_list.length > 0) {
          const sql = `
SELECT hostname_regex, git_hash
FROM ${g_config.versionTable}
WHERE package_name = ?
ORDER BY match_priority DESC, hostname_regex ASC
`;
          g_config.pool.query(sql, [package_name], (err, results) => {
            if (err) {
              errorLog('fetchClientsByPackage: version fetch err:', err);
            } else {
              client_list.forEach((client) => {
                const found = findVersionForHost(results, client.hostname);
                if (found) {
                  client.needs_update = found.git_hash !== client.git_hash;
                  client.update_git_hash = found.git_hash;
                } else {
                  client.needs_update = false;
                  client.update_git_hash = null;
                }
              });
            }
            done(err);
          });
        } else {
          done();
        }
      },
    ],
    (err) => {
      done(err, client_list);
    }
  );
}

function findVersionForHost(package_version_results, hostname) {
  let ret = package_version_results.find((result) => {
    const { hostname_regex } = result;
    const regex = new RegExp(hostname_regex);
    return regex.test(hostname);
  });
  return ret;
}

function _reqString(req, name) {
  const val = req.body[name];
  let ret;
  if (typeof val === 'string') {
    ret = val;
  }
  return ret;
}
function _defaultErrorLog(...args) {
  console.error(...args);
}
