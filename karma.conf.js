module.exports = function(karma) {
  karma.set({
    basePath: 'tests',

    files: [
      '../vendor/jquery/dist/jquery.js',
      '../vendor/handlebars/handlebars.js',
      '../vendor/ember/ember.js',
      '../vendor/ember-data/ember-data.js',
      '../dist/socket-adapter.js',
      "fixtures.js",
      "helper.js",
      "unit.js"
    ],

    logLevel: karma.LOG_ERROR,
    browsers: ['PhantomJS'],
    singleRun: true,
    autoWatch: false,
    /*browsers: ['Chrome'],
    singleRun: false,
    autoWatch: true,*/

    frameworks: ['qunit']
  });
};