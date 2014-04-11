module.exports = {
  amd: {
    src: ['vendor/loader.js', 'tmp/**/*.amd.js' ],
    dest: 'tmp/socket-adapter.browser.js'
  },
  test: {
    src: [
      'tests/lib/jquery-1.9.1.js',
      'tests/lib/handlebars-v1.2.1.js',
      'tests/lib/ember.js',
      'tests/lib/ember-data.js',
      'tests/lib/jquery.mockjax.js',
      'tests/lib/tmpl.min.js',
      'dist/ember-data-socket-adapter.js',
      'tests/app.js'
    ],
    dest: 'tests/dist/deps.min.js'
  }
};