/*global io */
/*jshint camelcase: false */
var get = Ember.get, set = Ember.set,
  forEach = Ember.EnumerableUtils.forEach;

var SocketAdapter = DS.RESTAdapter.extend({
  socketAddress: 'http://api.collectrium.websocket:5000',
  bulkOperationsSupport: {
    createRecord: true,
    updateRecord: false,
    deleteRecord: true
  },
  updateAsPatch: true,
  coalesceFindRequests: true,
  socketConnections: Ember.Object.create(),
  requestsPool: [],

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
    var store = type.typeKey && type.store,
      address = get(this, 'socketAddress') + '/',
      requestsPool = get(this, 'requestsPool'),
      type = type.typeKey,
      connections = get(this, 'socketConnections'),
      socketNS = type && get(connections, type);

    if (arguments.length === 1) {
      options = {};
    }
    if (!type) {
      options = arguments[0];
    }
    if (socketNS) {
      //TODO: not sure that manually socket reconnecting is required
      if (socketNS.hasOwnProperty('socket') && !socketNS.socket.connected && !socketNS.socket.connecting) {
        socketNS.socket.connect();
      }
    }
    else {
      if (type) {
        address = address + type.decamelize() + '/';
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
              //if response contains only ids array it means that we receive DELETE
              if (response.ids) {
                //remove all records from store without sending DELETE requests
                forEach(response.ids, function(id) {
                  var record = store.getById(type, id);
                  store.unloadRecord(record);
                });
              }
              //we receive CREATE or UPDATE, ember-data will manage data itself
              else {
                if (response.hasOwnProperty('payload')) {
                  store.pushPayload(type, response.payload);
                }
              }
            }
          }
        });
      }
      if (type) {
        set(connections, type, socketNS);
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
      deffered = Ember.RSVP.defer('DS: SocketAdapter#emit ' + requestType + ' to ' + type.typeKey);
    if (!(hash instanceof Object)) {
      hash = {};
    }
    /**
     * Handshake was aborted
     */
    connection.on('error', function () {
        Ember.run(null, deffered.reject, {
          code:'auth-failed',
          name: 'Authentication failed',
          message: 'Invalid session token'
        });
    });
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
    var model = store.modelFor(type),
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
    var serializer = store.serializerFor(type.typeKey),
      data = {};
    data[type.typeKey.decamelize()] = serializer.serialize(record);

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
    var serializer = store.serializerFor(type.typeKey),
      data = {};
    data[type.typeKey.decamelize()] = [];

    forEach(records, function(record) {
      data[type.typeKey.decamelize()].push(serializer.serialize(record));
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
    var serializer = store.serializerFor(type.typeKey),
      data = {}, payload;
    payload = serializer.serialize(record, { includeId: true });

    if(get(this, 'updateAsPatch')) {
      payload = this.filterUnchangedParams(payload, record);
    }

    data[type.typeKey.decamelize()] = payload;

    return this.send(type, 'UPDATE', data);
  },

  filterUnchangedParams: function(hash, record) {
    var originalData = get(record, 'data');
    var id = hash.id;
    var isEmpty = Ember.isEmpty;

    Ember.keys(hash).forEach(function(key) {
      if(hash[key] === originalData[key]) {
        // we won't send data that didn't change
        delete hash[key];
      } else if ((typeof hash[key] === 'object') && isEmpty(hash[key]) && isEmpty(originalData[key])) {
        // and we won't send comples data ( like objects/arrays ) it it's empty and wasn't load
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
    var serializer = store.serializerFor(type.typeKey),
      data = {};
    data[type.typeKey.decamelize()] = [];

    forEach(records, function(record) {
      data[type.typeKey.decamelize()].push(serializer.serialize(record, { includeId: true }));
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


  openSocket: function() {
    this.getConnection({
      resource: 'handshake'
    });
  }.on('init')
});

export default SocketAdapter;
