module.exports = function(grunt) {
  grunt.loadTasks('tasks');
  var config = require('load-grunt-config')(grunt, {
    configPath: __dirname + '/tasks/options',
    init: false
  });

  config.pkg = require('./package');
  config.env = process.env;

  grunt.initConfig(config);
  grunt.task.registerTask('release',
    ['bump-only', 'dist', 'usebanner:bump', 'copy:bump', 'bump-commit']
  );
  /*grunt.task.registerTask('test',
    ['dist', 'usebanner:distBanner', 'jshint', 'emberhandlebars', 'concat:test', 'karma']
  );*/
  grunt.task.registerTask('build',
    ['clean', 'transpile:amd', 'concat:amd', 'browser:dist', 'replace:update_version']
  );
  grunt.task.registerTask('dist',
    ['build', 'replace:strip_debug_messages_production', 'uglify:dist', 'get_git_rev']
  );
};