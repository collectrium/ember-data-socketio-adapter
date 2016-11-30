/* global io */
/*jshint camelcase: false */
import DS from 'ember-data';
import Ember from 'ember';
import { requestResponseLogger } from './../initializers/socket-request-response-logger';

const {
  get,
  set,
  EnumerableUtils: { forEach },
  computed,
  Logger: { debug }
  } = Ember;

function printRequestStack(requestHash) {
  const e = new Error();
  if (!e.stack) {
    return; // phantomjs for
  }
  const stack = e.stack.replace(/^[^\(]+?[\n$]/gm, '')
    .replace(/^\s+at\s+/gm, '')
    .replace(/^Object.<anonymous>\s*\(/gm, '{anonymous}()@')
    .split('\n');
  stack.shift();
  stack.unshift('\n');
  debug(requestHash, stack.join('\n'));
}

export default DS.RESTAdapter.extend({
  socketAddress: 'http://api.collectrium.websocket:5000',
  socketHandshakeQuery: '',
  bulkOperationsSupport: {
    createRecord: false,
    updateRecord: false,
    deleteRecord: false
  },
  updateAsPatch: true,
  logRequests: true,
  collectRequestResponseLog: true,
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
  generateRequestId() {
    const S4 = function() {
      return Math.floor(Math.random() * 0x10000).toString(16); // 65536
    };

    return (
      S4() + S4() + '-' + S4() + '-' + S4() + '-' + S4() + '-' + S4() + S4() + S4()
    );
  },
  /**
   *
   * @param type
   * @param options
   * @returns {Ember.get|*|Object}
   */
  getConnection(type, options) {
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
    const collectRequestResponseLog = get(this, 'collectRequestResponseLog');

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
              if (collectRequestResponseLog) {
                requestResponseLogger.logResponse(response);
              }
              delete response.request_id;
              delete requestsPool[response.request_id];
              Ember.run(null, resolver, response);
            } else {
              /**
               * Handling PUSH notifications
               * Operations can be only multiple
               */
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
      } else {
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
    hash = this.buildRequest(type, requestType, hash);
    this.onBeforeSendHash(hash);
    const connection = this.getConnection(type);
    const requestsPool = get(this, 'requestsPool');
    const logRequests = get(this, 'logRequests');
    const modelName = type.modelName;
    const collectRequestResponseLog = get(this, 'collectRequestResponseLog');
    const deffered = Ember.RSVP.defer('DS: SocketAdapter#emit ' + requestType + ' to ' + modelName);
    deffered.requestType = requestType;
    if (collectRequestResponseLog) {
      requestResponseLogger.logRequest({
        modelName,
        operation: requestType,
        hash
      });
    }
    requestsPool[hash.request_id] = deffered;
    if (logRequests) {
      printRequestStack(hash);
    }
    connection.emit(requestType, hash);
    return deffered.promise;
  },

  buildRequest(type, requestType, hash) {
    const requestId = this.generateRequestId();
    if (!(hash instanceof Object)) {
      hash = {};
    }
    hash.request_id = requestId;
    return hash;
  },

  onBeforeSendHash(/*hash*/) {

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
   * @param id
   * @returns {Ember.RSVP.Promise}
   */
  findRecord: function(store, type, id) {
    const model = store.modelFor(type.modelName), data = {
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
  createRecord(store, type, snapshot) {
    const serializer = store.serializerFor(type.modelName);
    const data = {};
    serializer.serializeIntoHash(data, type, snapshot, { includeId: true });

    return this.send(type, 'CREATE', data);
  },

  /**
   *
   * @param store
   * @param type
   * @param records
   * @returns {Ember.RSVP.Promise}
   */
  createRecords: function(store, type, snapshots) {
    const serializer = store.serializerFor(type.modelName);
    const data = {};
    serializer.serializeIntoHash(data, type, snapshots, { includeId: true });

    return this.send(type, 'CREATE_LIST', data);
  },

  /**
   *
   * @param store
   * @param type
   * @param record
   * @returns {*|ajax|v.support.ajax|jQuery.ajax|Promise|E.ajax}
   */
  updateRecord: function(store, type, snapshot) {
    const serializer = store.serializerFor(type.modelName);
    const data = {};
    const updateAsPatch = get(this, 'updateAsPatch');
    serializer.serializeIntoHash(data, type, snapshot, {
      includeId: true,
      updateAsPatch
    });

    return this.send(type, 'UPDATE', data);
  },

  /**
   *
   * @param store
   * @param type
   * @param records
   * @returns {Ember.RSVP.Promise}
   */
  updateRecords: function(store, type, snapshots) {
    const serializer = store.serializerFor(type.modelName);
    const updateAsPatch = get(this, 'updateAsPatch');
    const data = {};
    serializer.serializeIntoHash(data, type, snapshots, {
      includeId: true,
      updateAsPatch
    });

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

    return this.send(type, 'DELETE', { id });
  },

  /**
   *
   * @param store
   * @param type
   * @param records
   * @returns {Ember.RSVP.Promise}
   */
  deleteRecords: function(store, type, records) {
    const data = {
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
    var socketHandshakeQuery = get(this, 'socketHandshakeQuery');
    if (socketHandshakeQuery) {
      config.query = socketHandshakeQuery;
    } else if (this.version) {
      config.query = 'version=' + this.version;
    }
    this.getConnection(config);
  })
});
