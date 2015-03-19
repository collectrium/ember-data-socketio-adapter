'use strict';

module.exports = {
  name: 'ember-data-socketio-adapter',

  included: function(app) {
    this._super.included(app);

    app.import(__dir + '/build/socket-adapter.js');
  }
};
