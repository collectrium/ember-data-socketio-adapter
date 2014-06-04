var forEach = Ember.EnumerableUtils.forEach;

window.setupStore = function(options) {
  var env = {};
  options = options || {};

  var container = env.container = new Ember.Container();

  var adapter = env.adapter = (options.adapter || DS.Adapter);
  delete options.adapter;

  for (var prop in options) {
    container.register('model:' + prop, options[prop]);
  }

  container.register('store:main', SA.Store.extend({
    adapter: adapter
  }));

  container.register('serializer:-default', SA.Serializer);

  container.injection('serializer', 'store', 'store:main');

  env.serializer = container.lookup('serializer:-default');
  env.restSerializer = container.lookup('serializer:-rest');
  env.store = container.lookup('store:main');
  env.adapter = env.store.get('defaultAdapter');
  return env;
};

//copied from ember-data tests core
window.async = function(callback, timeout) {
  stop();

  timeout = setTimeout(function() {
    start();
    ok(false, "Timeout was reached");
  }, timeout || 200);

  return function() {
    clearTimeout(timeout);

    start();

    var args = arguments;
    return Ember.run(function() {
      return callback.apply(this, args);
    });
  };
};
window.io = {};
window.io.connect = function(address, options) {
  //TOOD: create typeFromAddress and addressFromType functions
  var type = address.split('/').reverse()[1];
  return Ember.Object.createWithMixins(Ember.Evented, {

    /**
     * Tests will emit events only for resource namespaces, so requestType and type are always set,
     * hash can be an empty object
     *
     * @param requestType
     * @param hash
     */
    emit: function(requestType, hash) {
      var fix,
        requestId = hash.request_id;
      delete hash.request_id;
      socketRequest = {};
      socketRequest.type = type;
      socketRequest.requestType = requestType;
      socketRequest.hash = hash;
      forEach(fixtures, function(fixture) {
        if (JSON.stringify(fixture.request) === JSON.stringify(socketRequest)) {
          //return fixture deep copy, to save fixture data across all tests
          fix = JSON.stringify(fixture.response);
          fix = JSON.parse(fix);
        }
      });
      if (fix) {
        fix.request_id = requestId;
        this.trigger('message', fix);
      } else {
        console.error('fixture not found', socketRequest);
      }
    }
  });
};