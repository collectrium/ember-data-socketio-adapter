import Ember from 'ember';
import Adapter from 'dummy/adapters/socket-adapter';
import Serializer from 'dummy/serializers/socket-serializer';
import Store from 'dummy/services/store';

const {
  String: { decamelize }
} = Ember;

export default function(options) {
  var env = {};
  options = options || {};

  var container = env.container = new Ember.Container();

  var adapter = options.adapter || '-socket';
  delete options.adapter;

  for (var prop in options) {
    container.register('model:' + prop, options[prop]);
  }

  container.register('store:main', Store.extend({
    adapter
  }));

  container.register('adapter:-socket', Adapter.extend({
    bulkOperationsSupport: {
      createRecord: true,
      updateRecord: true,
      deleteRecord: true
    },
    socketAddress: 'http://fake-endpoint.com/',
    pathForType(modelName) {
      return decamelize(modelName);
    }
  }));
  container.register('serializer:-default', Serializer);

  container.injection('serializer', 'store', 'store:main');

  env.serializer = container.lookup('serializer:-default');
  env.restSerializer = container.lookup('serializer:-rest');
  env.store = container.lookup('store:main');
  env.adapter = env.store.get('defaultAdapter');
  return env;
}
