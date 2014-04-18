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