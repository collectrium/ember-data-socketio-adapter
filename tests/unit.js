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
  var newPosts = [
    store.createRecord('post', {
      name: 'Socket.io is awesome'
    }),
    store.createRecord('post', {
      name: 'Ember.js is awesome'
    })];
  Ember.RSVP.all(newPosts.invoke('save')).then(async(function(posts) {
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

test('Update Post', function () {
  expect(2);
  socketResponse({ post: [
    { id: 1, name: 'Socket.io is awesome' }
  ] });

  var post = store.find('post', 1);
  post.then(async(function (post) {
    ok(post.get('isLoaded'), 'post should be loaded correctly');

    socketResponse({ post: [
      { id: 1, name: 'Javascript is awesome' }
    ] });

    post.set('name', 'Javascript is awesome');
    post.save().then(async(function (post) {
      deepEqual(socketRequest, {
          type: 'post',
          requestType: 'UPDATE',
          hash: { post: [
            { id: '1', name: 'Javascript is awesome', comments: []}
          ]
        }
      },
        'Post UPDATE event socket request should be equal to \n' +
        '  {' +
        '\t type: "post", \n' +
        '\t requestType: "UPDATE", \n' +
        '\t hash: { post: [ \n' +
        '\t\t { id: "1", name: "Javascript is awesome", comments: [] } \n' +
        '\t ]}\n' +
        '  }'
      );
    }));
  }));
});

test('Update Posts', function () {
  expect(2);
  socketResponse({
    meta: {}, payload: { post: [
      {id: 1, name: 'Socket.io is awesome'},
      {id: 2, name: 'Ember.js is awesome'},
      {id: 3, name: 'Javascript is awesome'}
    ]}
  });

  store.find('post').then(async(function (posts) {
    ok(posts.get('isLoaded'), 'posts should be loaded in store correctly');
    var updatedPosts = [posts.objectAt(0),posts.objectAt(1)];
    updatedPosts.setEach('name', 'Javascript is awesome');

    socketResponse({
      post: [
        { id: 1, name: 'Javascript is awesome' },
        { id: 2, name: 'Javascript is awesome' }
      ]
    });
    Ember.RSVP.all(updatedPosts.invoke('save')).then(async(function (posts) {
      deepEqual(socketRequest, {
        type: 'post',
        requestType: 'UPDATE_LIST',
        hash: { post: [
          { id: '1', name: 'Javascript is awesome', comments: [] },
          { id: '2', name: 'Javascript is awesome', comments: [] }
        ]}
      },
        'Post UPDATE_LIST event socket request should be equal to \n' +
        '  {' +
        '\t type: "post", \n' +
        '\t requestType: "UPDATE_LIST", \n' +
        '\t hash: { post: [ \n' +
        '\t\t { id: "1", name: "Javascript is awesome", comments: [] } \n' +
        '\t\t { id: "2", name: "Javascript is awesome", comments: [] } \n' +
        '\t ]}\n' +
        '  }'
      );
    }));

  }));

});

test('Delete Post', function () {
  socketResponse({
    meta: {}, payload: {
      post: [
        {id: 1, name: 'Socket.io is awesome'},
        {id: 2, name: 'Ember.js is awesome'}
      ]
    }
  });

  store.find('post').then(async(function (posts){
    equal(posts.get('length'), 2, 'posts length should be equal 2');
    var post = posts.get('lastObject');
    post.deleteRecord();
    socketResponse({
      post: {
        id: 2
      }
    });

    post.save().then(async(function (response) {
      deepEqual(socketRequest, {
        type: 'post',
        requestType: 'DELETE',
        hash: { id: '2' }
      },
        'Post DELETE event socket request should be equal to \n' +
        '  {' +
        '\t type: "post", \n' +
        '\t requestType: "DELETE", \n' +
        '\t hash: { id: "2" }\n' +
        '\t ]}\n' +
        '  }'
      );
      equal(response.get('id'), 2, 'post id should be equal 2');
    }));
  }));
});

test('Delete Posts', function () {
  expect(2);
  socketResponse({
    meta: {}, payload: {
      post: [
        { id: 1, name: 'Socket.io is awesome' },
        { id: 2, name: 'Ember.js is awesome' },
        { id: 3, name: 'Javascript is awesome' }
      ]
    }
  });

  store.find('post').then(async(function (posts) {
    equal(posts.get('length'), 3, 'posts length equal should be equal 3');
    var deletedPosts = [posts.objectAt(0), posts.objectAt(1)];
    forEach(deletedPosts, function(post){
      post.deleteRecord();
    });
    socketResponse({
      post: {
        id: [1, 2]
      }
    });
    Ember.RSVP.all(deletedPosts.invoke('save')).then(async(function () {
      //TODO: socketRequest type equal UPDATE, but should be equal DELETE_LIST if 
      //TODO: store has a records after delete records
      deepEqual(socketRequest, {
        type: 'post',
        requestType: 'DELETE_LIST',
        hash: {
          ids: ['1', '2']
        }
      },
        'Posts DELETE_IST event socket request should be equal to \n' +
        '  {' +
        '\t type: "post", \n' +
        '\t requestType: "DELETE_LIST", \n' +
        '\t hash: { ids: ["1", "2"] } \n' +
        '\t ]} \n' +
        '  }'
      );
    }));
  }));
});

test('Find Posts with relations', function () {
  expect(3);
  socketResponse({
    meta: {}, payload: {
      post: [
        { id: 1, name: 'Javascript is awesome', comments: [1] },
        { id: 2, name: 'Socket.io is awesome', comments: [] },
        { id: 3, name: 'Ember.js is awesome', comments: [2] }
      ],
      comments: [
        {id: 1, name: 'I think so.'},
        {id: 2, name: 'I <3 MVC.'}
      ]
    }
  });

  store.find('post', {include: 'comments'}).then(async(function (posts) {
    equal(posts.get('length'), 3, 'posts length should be equal 3');
    equal(posts.get('firstObject').get('comments').findBy('id', '1').get('name'),
      'I think so.',
      'first comment to first post should be equal "I think so."');
    equal(posts.get('lastObject').get('comments').findBy('id', '2').get('name'),
      'I <3 MVC.',
      'first comment to last post should be equal "I <3 MVC."');
  }));
});
