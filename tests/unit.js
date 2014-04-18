var env, store, adapter, Post, Comment, io = {}, socketRequest,
  forEach = Ember.EnumerableUtils.forEach;
io.connect = function() {
  return {
    on: function() {
      return true;
    }
  }
};

module('unit - Socket Adapter', {
  setup: function() {
    Post = DS.Model.extend({
      name: DS.attr('string'),
      comments: DS.hasMany('comment')
    });

    Post.toString = function() {
      return 'Post';
    };

    Comment = DS.Model.extend({
      name: DS.attr('string')
    });

    env = setupStore({
      post: Post,
      comment: Comment,
      adapter: SA.Adapter
    });

    store = env.store;
    adapter = env.adapter;
    env.container.register('transform:string', DS.StringTransform);

    socketRequest = null;
  }
});

function socketResponse(value) {
  adapter.send = function(type, requestType, hash) {
    socketRequest = {};
    if (type.typeKey) {
      socketRequest.type = type.typeKey;
    }
    if (requestType) {
      socketRequest.requestType = requestType;
    }
    if (hash) {
      socketRequest.hash = hash;
    }
    return Ember.RSVP.resolve(value);
  };
}


test('Find Post by ID without options', function() {
  expect(2);
  socketResponse({ post: [
    { id: 1, name: 'Socket.io is awesome' }
  ] });
  store.find('post', 1).then(async(function(post) {
    deepEqual(socketRequest, {type: 'post', requestType: 'READ', hash: {id: '1'}},
        'Post READ event socket request should be equal to \n' +
        '{ \n' +
        'type: "post", \n' +
        'requestType: "READ", \n' +
        'hash: {id: "1"} \n' +
        '}');
    ok(post.get('isLoaded'), 'post should be loaded in store correctly');
  }));
});

test('Find All Posts without options', function() {
  expect(2);
  socketResponse({
    meta: {}, payload: {
      post: [
        { id: 1, name: 'Socket.io is awesome' },
        { id: 2, name: 'Ember.js is awesome' }
      ]
    }
  });
  store.find('post').then(async(function(posts) {
    deepEqual(socketRequest, {type: 'post', requestType: 'READ_LIST'},
        'Posts READ_LIST event socket request should be equal to \n' +
        '{ \n' +
        'type: "post", \n' +
        'requestType: "READ_LIST", \n' +
        '}');
    ok(posts.get('isLoaded'), 'posts should be loaded in store correctly');
  }));
});

test('Create Post', function() {
  expect(2);
  socketResponse({ post: [
    { id: 1, name: 'Socket.io is awesome' }
  ] });
  var post = store.createRecord('post', {
    name: 'Socket.io is awesome'
  });
  post.save().then(async(function(post) {
    deepEqual(socketRequest, {
        type: 'post',
        requestType: 'CREATE',
        hash: {post: [
          {name: 'Socket.io is awesome', comments: []}
        ]}
      },
        'Post CREATE event socket request should be equal to \n' +
        '{ \n' +
        'type: "post", \n' +
        'requestType: "CREATE", \n' +
        'hash: {name: "Socket.io is awesome"} \n' +
        '}');
    ok(post.get('isLoaded'), 'post should be loaded in store correctly');
  }));
});

test('Create Posts', function() {
  expect(2);
  socketResponse({ post: [
    { id: 1, name: 'Socket.io is awesome' },
    { id: 2, name: 'Ember.js is awesome' }
  ] });
  var posts = [
    store.createRecord('post', {
      name: 'Socket.io is awesome'
    }),
    store.createRecord('post', {
      name: 'Ember.js is awesome'
    })];
  Ember.RSVP.all(posts.invoke('save')).then(async(function(posts) {
    deepEqual(socketRequest, {
        type: 'post',
        requestType: 'CREATE_LIST',
        hash: {post: [
          {name: 'Socket.io is awesome', comments: []},
          {name: 'Ember.js is awesome', comments: []}
        ]}
      },
        'Post CREATE event socket request should be equal to \n' +
        '{ \n' +
        'type: "post", \n' +
        'requestType: "CREATE", \n' +
        'hash: {post: [ \n' +
        '{name: "Socket.io is awesome", comments: []}, \n' +
        '{name: "Ember.js is awesome", comments: []} \n' +
        ']} \n' +
        '}'
    );
    var loaded = true;
    forEach(posts, function(post) {
      if (!post.get('isLoaded')) {
        loaded = false;
      }
    });
    ok(loaded, 'posts should be loaded in store correctly');
  }));
});