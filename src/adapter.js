/*global io */
var get = Ember.get, set = Ember.set;
var forEach = Ember.EnumerableUtils.forEach;

var SocketAdapter = DS.RESTAdapter.extend({
  socketAddress: 'http://api.collectrium.websocket:5000',
  socketConnections: null,
  bulkOperationsSupport: true,

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
   * @param root
   * @param options
   * @returns {Ember.get|*|Object}
   */
  getConnection: function(root, options) {
    if (arguments.length === 1) {
      options = {};
    }
    if (root instanceof Object) {
      options = root;
      root = '/';
    }
    var connections = get(this, 'socketConnections'),
      socketNS = get(connections, root),
      address = this.get('socketAddress');

    if (!socketNS) {
      address += '/';
      if (root !== '/') {
        address = address + root + '/';
      }
      socketNS = io.connect(address, options);
      set(connections, root, socketNS);
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
    var connection = this.getConnection(type.typeKey);
    if (!(hash instanceof Object)) {
      hash = {}
    }
    hash.request_id = this.generateRequestId();

    return new Ember.RSVP.Promise(function(resolve, reject) {
      connection.emit(requestType, hash);

      //TODO: when should be reject promise hmmm?
      connection.on(requestType, function(response) {
        //TODO: think about push update
        if ((response.request_id) === hash.request_id) {
          Ember.run(null, resolve, response.payload);
        }
      });

    }, "DS: SocketAdapter#emit " + requestType + " to " + type.typeKey);
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
      data = serializer.serialize(record, { includeId: true });

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
      data = [];

    forEach(records, function(record) {
      data.push(serializer.serialize(record));
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
      data = serializer.serialize(record, { includeId: true });

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
      data = [];

    forEach(records, function(record) {
      data.push(serializer.serialize(record, { includeId: true }));
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
    var data = [];

    forEach(records, function(record) {
      data.push(get(record, 'id'));
    });

    return this.send(type, 'DELETE_LIST', data);
  },


  openSocket: function() {
    set(this, 'socketConnections', Ember.Object.create());
    this.getConnection({
      resource: 'handshake'
    });
  }.on('init')
});

export default SocketAdapter;