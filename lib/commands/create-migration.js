'use strict';

const _assert = require('./helper/assert');
const log = require('db-migrate-shared').log;
const mkdirp = require('mkdirp');
const fs = require('fs');
const optimist = require('optimist');
const util = require('util');

function createMigrationDir (dir, callback) {
  fs.stat(dir, function (err) {
    if (err) {
      mkdirp(dir, callback);
    } else {
      callback();
    }
  });
}

function executeCreateMigration (internals, config, callback) {
  let migrationsDir = internals.argv['migrations-dir'];
  let folder, path;

  internals.runTimestamp = new Date();

  if (internals.migrationMode && internals.migrationMode !== 'all') {
    migrationsDir =
      internals.argv['migrations-dir'] + '/' + internals.migrationMode;
  }

  if (internals.argv._.length === 0) {
    log.error("'migrationName' is required.");
    if (!internals.isModule) {
      optimist.showHelp();
    }

    if (typeof callback !== 'function') {
      process.exit(1);
    } else {
      return callback(new Error("'migrationName' is required."));
    }
  }

  createMigrationDir(migrationsDir, function (err) {
    const Migration = require('../template.js');

    if (err) {
      log.error('Failed to create migration directory at ', migrationsDir, err);
      if (typeof callback !== 'function') {
        process.exit(1);
      } else {
        return callback(new Error('Failed to create migration directory.'));
      }
    }

    internals.argv.title = internals.argv._.shift();
    folder = internals.argv.title.split('/');

    internals.argv.title = folder[folder.length - 2] || folder[0];
    path = migrationsDir;

    if (folder.length > 1) {
      path += '/';

      for (let i = 0; i < folder.length - 1; ++i) {
        path += folder[i] + '/';
      }
    }

    let templateType = Migration.TemplateType.DEFAULT_JS;
    if (
      shouldCreateSqlFiles(internals, config) &&
      shouldCreateCoffeeFile(internals, config)
    ) {
      templateType = Migration.TemplateType.COFFEE_SQL_FILE_LOADER;
    } else if (
      shouldCreateSqlFiles(internals, config) &&
      shouldIgnoreOnInitFiles(internals, config)
    ) {
      templateType = Migration.TemplateType.SQL_FILE_LOADER_IGNORE_ON_INIT;
    } else if (shouldCreateSqlFiles(internals, config)) {
      templateType = Migration.TemplateType.SQL_FILE_LOADER;
    } else if (shouldCreateCoffeeFile(internals, config)) {
      templateType = Migration.TemplateType.DEFAULT_COFFEE;
    }
    const migration = new Migration(
      internals.argv.title +
        (shouldCreateCoffeeFile(internals, config) ? '.coffee' : '.js'),
      path,
      internals.runTimestamp,
      templateType
    );
    migration.write(function (err) {
      if (_assert(err, callback)) {
        log.info(util.format('Created migration at %s', migration.file.path));
        if (shouldCreateSqlFiles(internals, config)) {
          createSqlFiles(internals, config, callback);
        } else {
          if (typeof callback === 'function') {
            return callback();
          }
        }
      }
    });
  });
}

function shouldCreateSqlFiles (internals, config) {
  return internals.argv['sql-file'] || config['sql-file'];
}

function shouldIgnoreOnInitFiles (internals, config) {
  return internals.argv['ignore-on-init'] || config['ignore-on-init'];
}

function shouldCreateCoffeeFile (internals, config) {
  return internals.argv['coffee-file'] || config['coffee-file'];
}

function createSqlFiles (internals, config, callback) {
  let migrationsDir = internals.argv['migrations-dir'];

  if (internals.migrationMode && internals.migrationMode !== 'all') {
    migrationsDir =
      internals.argv['migrations-dir'] + '/' + internals.migrationMode;
  }

  const sqlDir = migrationsDir + '/sqls';
  createMigrationDir(sqlDir, function (err) {
    const Migration = require('../template.js');

    if (err) {
      log.error('Failed to create migration directory at ', sqlDir, err);

      if (typeof callback !== 'function') {
        process.exit(1);
      } else {
        return callback(err);
      }
    }

    let templateTypeDefaultSQL = Migration.TemplateType.DEFAULT_SQL;
    const migrationUpSQL = new Migration(
      internals.argv.title + '-up.sql',
      sqlDir,
      internals.runTimestamp,
      templateTypeDefaultSQL
    );
    migrationUpSQL.write(function (err) {
      if (_assert(err, callback)) {
        log.info(
          util.format(
            'Created migration up sql file at %s',
            migrationUpSQL.file.path
          )
        );

        const migrationDownSQL = new Migration(
          internals.argv.title + '-down.sql',
          sqlDir,
          internals.runTimestamp,
          templateTypeDefaultSQL
        );
        migrationDownSQL.write(function (err) {
          if (_assert(err, callback)) {
            log.info(
              util.format(
                'Created migration down sql file at %s',
                migrationDownSQL.file.path
              )
            );
            if (typeof callback === 'function') callback();
          }
        });
      }
    });
  });
}

module.exports = executeCreateMigration;
