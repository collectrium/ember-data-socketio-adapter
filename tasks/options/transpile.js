function nameFor(path) {
  //TODO: get name from package
  return 'socket-adapter/' + path;
}

module.exports = {
  amd: {
    type: 'amd',
    moduleName: nameFor,
    files: [
      {
        expand: true,
        cwd: 'src/',
        src: [ '**/*.js'],
        dest: 'tmp',
        ext: '.amd.js'
      }
    ]
  }
};