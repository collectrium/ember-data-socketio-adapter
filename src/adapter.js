/*global io */
/*jshint camelcase: false */
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
      S4() + S4() + '-' +
      S4() + '-' +
      S4() + '-' +
      S4() + '-' +
      S4() + S4() + S4()
      );
  },

  /**
   *
   * @param request
   * @returns {bool}
   */
  validateResponse: function (response, type) {
    var isValid = true;
    /**
     * Validation for responses
     * 'request_id' should be inside 'requestsPool'
     */
    if (response.hasOwnProperty('request_id')) {
      var deffered = this.requestsPool[response.request_id];

      if (!deffered){
        isValid = false;
      }

      var requestType = deffered.requestType;
        /* Validate response by request type */
        // TODO: pluralize
        // TODO: List responses validate

      switch (requestType) {
        case 'READ':
          if (!response.hasOwnProperty(type)) {
            isValid = false;
          }
          break;
        case 'READ_LIST':
          if (!response.hasOwnProperty('payload') || !response.payload.hasOwnProperty(type) || !response.type instanceof Array ) {
            isValid = false;
          }
          break;
        case 'CREATE':
          if (!response.hasOwnProperty(type)) {
            isValid = false;
          }
          break;
        case 'CREATE_LIST':
          /*if (!response.hasOwnProperty('payload') || !response.payload.hasOwnProperty(type) || !response.type instanceof Array ) {
            isValid = false;
          }*/
          break;
        case 'UPDATE':
        if (!response.hasOwnProperty(type)) {
            isValid = false;
          }
          break;
        case 'UPDATE_LIST':
          /*if (!response.hasOwnProperty('payload') || !response.payload.hasOwnProperty(type) || !response.type instanceof Array ) {
            isValid = false;
          }*/
          break;
        case 'DELETE':
          if (Object.keys(response).length !== 1) {
            isValid = false;
          }
          break;
        case 'DELETE_LIST':
          if (Object.keys(response).length !== 1) {
            isValid = false;
          }
          break;
        default:
          isValid = false;
          break;
      }
    }

    /**
     * Validation for push notifications
     * response should contains either 'payload' or 'ids' key
     * 'payload' type should be Object
     * 'ids' type should be Array
     */
    else {
      if (!response.hasOwnProperty('payload') && !response.hasOwnProperty('ids')) {
        isValid = false;
      }
      if (response.hasOwnProperty('ids') && !(response.ids instanceof Array)){
        isValid = false;
      }
      if (response.hasOwnProperty('payload') && !(response.payload instanceof Object)){
        isValid = false;
      }
    }
    return isValid;
  },

  /**
   *
   * @param type
   * @param options
   * @returns {Ember.get|*|Object}
   */
  getConnection: function(type, options) {
    var store = type.typeKey && type.store,
        scope = this;
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
        address = address + type.decamelize() + '/';
      }
      socketNS = io.connect(address, options);
      if (type) {
        //TODO: when should be reject promise hmmm?
        socketNS.on('message', function(response) {
          var isResponseValid = scope.validateResponse(response, type.decamelize());

          if (!isResponseValid) {
            if (response.request_id && requestsPool[response.request_id]) {
              var rejecter = requestsPool[response.request_id].reject;
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
                  forEach(response.ids, function (id) {
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
      deffered = Ember.RSVP.defer('DS: SocketAdapter#emit ' + requestType + ' to ' + type.typeKey);
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
      data = {};
    data[type.typeKey.decamelize()] = serializer.serialize(record, { includeId: true });

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
    set(this, 'socketConnections', Ember.Object.create());
    set(this, 'requestsPool', Ember.A([]));
    this.getConnection({
      resource: 'handshake'
    });
  }.on('init')
});

export default SocketAdapter;