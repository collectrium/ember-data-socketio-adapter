/*global io */
var get = Ember.get, set = Ember.set;
var forEach = Ember.EnumerableUtils.forEach;

var SocketAdapter = DS.RESTAdapter.extend({
  socketAddress: 'http://api.collectrium.websocket:5000',
  bulkOperationsSupport: true,

  socketConnections: null,
  requestsPool: null,

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
      S4() + S4() + "-" +
      S4() + "-" +
      S4() + "-" +
      S4() + "-" +
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
    var store = type.typeKey && type.store;
    type = type.typeKey;
    var connections = get(this, 'socketConnections'),
      socketNS = type && get(connections, type),
      address = this.get('socketAddress') + '/',
      requestsPool = this.get('requestsPool');

    if (arguments.length === 1) {
      options = {};
    }
    if (!type) {
      options = arguments[0];
    }

    //if we establish connection for the first time
    if (!socketNS) {
      if (type) {
        address = address + type + '/';
      }
      socketNS = io.connect(address, options);
      if (type) {
        //TODO: when should be reject promise hmmm?
        socketNS.on('message', function(response) {
          if (response.request_id && requestsPool[response.request_id]) {
            var resolver = requestsPool[response.request_id].resolve;
            delete response.request_id;
            Ember.run(null, resolver, response);
            delete requestsPool[response.request_id];
          }
          /**
           * Handling PUSH notifications
           * Operations can be only multiple
           */
          else {
            //if response contains only ids array it means that we receive DELETE
            if (response.ids) {
              //remove all records from store without sending DELETE requests
              store.findByIds(type, response.ids).then(function(records) {
                forEach(records, function(record) {
                  store.unloadRecord(record);
                });
              });
            }
            //we receive CREATE or UPDATE, ember-data will manage data itself
            else {
              store.pushPayload(type, response.payload);
            }
          }
        });
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
      requestsPool = this.get('requestsPool'),
      requestId = this.generateRequestId(),
      deffered = Ember.RSVP.defer("DS: SocketAdapter#emit " + requestType + " to " + type.typeKey);
    if (!(hash instanceof Object)) {
      hash = {};
    }
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
    return this.send(type, 'READ_LIST', {ids: ids});
  },

  /**
   *
   * @param store
   * @param type
   * @param id
   * @returns {Ember.RSVP.Promise}
   */
  find: function(store, type, id) {
    return this.send(type, 'READ', {id: id});
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
    data[type.typeKey] = [];

    data[type.typeKey].push(serializer.serialize(record));
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
    data[type.typeKey] = [];

    forEach(records, function(record) {
      data[type.typeKey].push(serializer.serialize(record));
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
      data = {};
    data[type.typeKey] = [];

    data[type.typeKey].push(serializer.serialize(record, { includeId: true }));
    return this.send(type, 'UPDATE', data);
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
    data[type.typeKey] = [];

    forEach(records, function(record) {
      data[type.typeKey].push(serializer.serialize(record, { includeId: true }));
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
    set(this, 'socketConnections', Ember.Object.create());
    set(this, 'requestsPool', Ember.Object.create());
    this.getConnection({
      resource: 'handshake'
    });
  }.on('init')
});

export default SocketAdapter;