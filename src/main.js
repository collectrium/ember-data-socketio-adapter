import serializer from 'socket-adapter/serializer';
import adapter from 'socket-adapter/adapter';
import store from 'socket-adapter/store';

var VERSION = 'SOCKET-ADAPTER-VERSION';
var SA;
if ('undefined' === typeof SA) {

  SA = Ember.Namespace.create({
    VERSION: VERSION,
    Adapter: adapter,
    Serializer: serializer,
    Store: store
  });

  if (Ember.libraries) {
    Ember.libraries.registerCoreLibrary('Socket Adapter', SA.VERSION);
  }
}

export default SA;