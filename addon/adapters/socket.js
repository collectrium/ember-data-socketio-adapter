/* global io */
/*jshint camelcase: false */
import DS from 'ember-data';
import Ember from 'ember';

const {
  get,
  set,
  keys,
  EnumerableUtils: { forEach },
  String: { decamelize },
  computed
} = Ember;

export default DS.RESTAdapter.extend({
  socketAddress: 'http://api.collectrium.websocket:5000',
  bulkOperationsSupport: {
    createRecord: false,
    updateRecord: false,
    deleteRecord: false
  },
  updateAsPatch: true,
  coalesceFindRequests: true,
  socketConnections: computed(function() {
    return Ember.Object.create();
  }),
  requestsPool: computed(function() {
    return [];
  }),

  /**
   * generate unique request id
   * @returns {string}
   */
  generateRequestId: function() {
    var S4 = function() {
      return Math.floor(
          Math.random() * 0x10000 // 65536
      ).toString(16);
    };

    return (
      S4() + S4() + '-' +
      S4() + '-' +
      S4() + '-' +
      S4() + '-' +
      S4() + S4() + S4()
      );
  },
  /**
   *
   * @param type
   * @param options
   * @returns {Ember.get|*|Object}
   */
  getConnection: function(type, options) {
    /*jshint -W004 */
    var address = get(this, 'socketAddress') + '/';
    var requestsPool = get(this, 'requestsPool');
    type = type.modelName;
    var connections = get(this, 'socketConnections');
    var socketNS = type && get(connections, type);
    var onConnectFailed = this.onConnectFailed;
    var onError = this.onError;
    var adapter = this;
    const store = adapter.store;

    if (arguments.length === 1) {
      options = {};
    }
    if (!type) {
      options = arguments[0];
    }
    if (socketNS) {
      // TODO: not sure that manually socket reconnecting is required
      if (socketNS.hasOwnProperty('socket') && !socketNS.socket.connected && !socketNS.socket.connecting) {
        socketNS.socket.connect();
      }
    } else {
      if (type) {
        address = `${address}${this.pathForType(type)}/`;
      }
      socketNS = io.connect(address, options);
      if (type) {
        socketNS.on('message', function(response) {
          if (response.hasOwnProperty('errors')) {
            if (response.request_id && requestsPool[response.request_id]) {
              var rejecter = requestsPool[response.request_id].reject;
              delete response.request_id;
              delete requestsPool[response.request_id];
              Ember.run(null, rejecter, response);
            }
          } else {
            if (response.request_id && requestsPool[response.request_id]) {
              var resolver = requestsPool[response.request_id].resolve;
              delete response.request_id;
              delete requestsPool[response.request_id];
              Ember.run(null, resolver, response);
            }
            /**
             * Handling PUSH notifications
             * Operations can be only multiple
             */
            else {
              store.trigger('notification', response);
              // if response contains only ids array it means that we receive DELETE
              if (response.ids) {
                // remove all records from store without sending DELETE requests
                forEach(response.ids, function(id) {
                  const record = store.getById(type, id);
                  if (record) {
                    store.unloadRecord(record);
                  }
                });
              }
              // we receive CREATE or UPDATE, ember-data will manage data itself
              else {
                if (response.hasOwnProperty('payload')) {
                  store.pushPayload(type, response.payload);
                }
              }
            }
          }
        });
        set(connections, type, socketNS);
      }
      else {
        socketNS.on('connect_failed', function(response) {
          if (onConnectFailed) {
            onConnectFailed.call(adapter, response);
          }
        });
        socketNS.on('error', function(response) {
          if (onError) {
            onError.call(adapter, response);
          }
        });
      }
    }
    return socketNS;
  },

  /**
   *
   * @param type
   * @param requestType
   * @param hash
   * @returns {Ember.RSVP.Promise}
   */
  send: function(type, requestType, hash) {
    var connection = this.getConnection(type),
      requestsPool = get(this, 'requestsPool'),
      requestId = this.generateRequestId(),
      deffered = Ember.RSVP.defer('DS: SocketAdapter#emit ' + requestType + ' to ' + type.modelName);
    if (!(hash instanceof Object)) {
      hash = {};
    }
    deffered.requestType = requestType;
    hash.request_id = requestId;
    requestsPool[requestId] = deffered;
    connection.emit(requestType, hash);
    return deffered.promise;
  },

  /**
   * Fetching all resources of a given type from server, can't be called with params.
   * Returns resources without full relations.
   * @param store
   * @param type
   * @returns {Ember.RSVP.Promise}
   */
  findAll: function(store, type) {
    return this.send(type, 'READ_LIST');
  },

  /**
   *
   * @param store
   * @param type
   * @param query
   * @returns {Ember.RSVP.Promise}
   */
  findQuery: function(store, type, query) {
    return this.send(type, 'READ_LIST', query);
  },

  /**
   *
   * @param store
   * @param type
   * @param ids
   * @returns {Ember.RSVP.Promise}
   */

  findMany: function(store, type, ids) {
    //TODO: hash format TBD, imho should use {ids: ids}
    return this.send(type, 'READ_LIST', {query: {id__in: ids}});
  },

  /**
   *
   * @param store
   * @param type
   * @param id
   * @returns {Ember.RSVP.Promise}
   */
  find: function(store, type, id) {
    const model = store.modelFor(type.modelName),
      data = {
        id: id
      };
    if (model._findByIdParams) {
      if (model._findByIdParams.include) {
        data['include'] = model._findByIdParams.include;
      }
      if (model._findByIdParams.fields) {
        data['fields'] = model._findByIdParams.fields;
      }
    }
    return this.send(type, 'READ', data);
  },

  /**
   *
   * @param store
   * @param type
   * @param record
   * @returns {Ember.RSVP.Promise}
   */
  createRecord: function(store, type, record) {
    var serializer = store.serializerFor(type.modelName),
      data = {};
    data[decamelize(type.modelName)] = serializer.serialize(record);

    return this.send(type, 'CREATE', data);
  },

  /**
   *
   * @param store
   * @param type
   * @param records
   * @returns {Ember.RSVP.Promise}
   */
  createRecords: function(store, type, records) {
    var serializer = store.serializerFor(type.modelName),
      data = {};
    data[decamelize(type.modelName)] = [];

    forEach(records, function(record) {
      data[decamelize(type.modelName)].push(serializer.serialize(record));
    });
    return this.send(type, 'CREATE_LIST', data);
  },

  /**
   *
   * @param store
   * @param type
   * @param record
   * @returns {*|ajax|v.support.ajax|jQuery.ajax|Promise|E.ajax}
   */
  updateRecord: function(store, type, record) {
    var serializer = store.serializerFor(type.modelName),
      data = {}, payload;
    payload = serializer.serialize(record, { includeId: true });

    if(get(this, 'updateAsPatch')) {
      payload = this.filterUnchangedParams(payload, record);
    }

    data[decamelize(type.modelName)] = payload;

    return this.send(type, 'UPDATE', data);
  },

  filterUnchangedParams: function(hash, record) {
    hash = Ember.copy(hash);
    var originalData = get(record, 'data');
    var id = hash.id;

    forEach(keys(originalData), function(key) {
      if(hash[key] === originalData[key]) {
        delete hash[key];
      }
    });

    hash.id = id;

    return hash;
  },

  /**
   *
   * @param store
   * @param type
   * @param records
   * @returns {Ember.RSVP.Promise}
   */
  updateRecords: function(store, type, records) {
    var serializer = store.serializerFor(type.modelName);
    var updateAsPatch = get(this, 'updateAsPatch');
    var data = {};
    var payloads = [];
    data[decamelize(type.modelName)] = payloads;

    forEach(records, function(record) {
      var payload = serializer.serialize(record, { includeId: true });
      if(updateAsPatch) {
        payload = this.filterUnchangedParams(payload, record);
      }
      payloads.push(payload);
    }, this);

    return this.send(type, 'UPDATE_LIST', data);
  },

  /**
   *
   * @param store
   * @param type
   * @param record
   * @returns {Ember.RSVP.Promise}
   */
  deleteRecord: function(store, type, record) {
    var id = get(record, 'id');

    return this.send(type, 'DELETE', {id: id});
  },

  /**
   *
   * @param store
   * @param type
   * @param records
   * @returns {Ember.RSVP.Promise}
   */
  deleteRecords: function(store, type, records) {
    var data = {
      ids: []
    };

    forEach(records, function(record) {
      data.ids.push(get(record, 'id'));
    });

    return this.send(type, 'DELETE_LIST', data);
  },


  openSocket: Ember.on('init', function() {
    var config = {
      resource: 'handshake'
    };
    if (this.version) {
      config.query = 'version=' + this.version;
    }
    this.getConnection(config);
  })
});
