window.fixtures = [
  
];

window.addFixture = function (request, response) {
  var obj = {};
  if (request.type) {
    obj.type = request.type;
  }
  if (request.requestType) {
    obj.requestType = request.requestType;
  }
  if (request.hash) {
    obj.hash = request.hash;
  }
 
  window.fixtures.push({
    request: obj,
    response: response
  }); 
};

// Find Post by ID without options
addFixture({
  type: 'post',
  requestType: 'READ',
  hash: {id: "1"}
}, { post: [
    { id: 1, name: 'Socket.io is awesome' }
  ] 
});

addFixture({
  type: 'post',
  requestType: 'READ',
  hash: {id: "2"}
}, { post: [
    { id: 2, name: 'Ember.js is awesome' }
  ] 
});

// Find All Posts without options
addFixture({
  type: 'post',
  requestType: 'READ_LIST'
}, {
  meta: {},
  payload: {
    post: [
      { id: 1, name: 'Socket.io is awesome' },
      { id: 2, name: 'Ember.js is awesome' }
    ]
  }
});

// Create Post
addFixture({
  type: 'post',
  requestType: 'CREATE',
  hash: {
    post: [
      { name: 'Socket.io is awesome', comments: [] }
    ]
  }
}, {
  post: [
    { id: 1, name: 'Socket.io is awesome' }
  ]
});

// Create Posts
addFixture({
  type: 'post',
  requestType: 'CREATE_LIST',
  hash: {
    post: [
      { name: 'Socket.io is awesome', comments: [] },
      { name: 'Ember.js is awesome', comments: [] }
    ]
  }
}, {
  post: [
    { id: 1, name: 'Socket.io is awesome' },
    { id: 2, name: 'Ember.js is awesome' }
  ]
});

// Update Post
addFixture({
  type: 'post',
  requestType: 'UPDATE',
  hash: {
    post: [
      { id: '1', name: 'Javascript is awesome', comments: []}
    ]
  }
}, {
  post: [
    { id: 1, name: 'Javascript is awesome' }
  ]
});

// Update Posts
addFixture({
  type: 'post',
  requestType: 'UPDATE_LIST',
  hash: {
    post: [
      { id: '1', name: 'Javascript is awesome', comments: [] },
      { id: '2', name: 'Javascript is awesome', comments: [] }
    ]
  }  
}, {
  post: [
    { id: 1, name: 'Javascript is awesome', comments: [] },
    { id: 2, name: 'Javascript is awesome', comments: [] }
  ]  
});

// Delete Post
addFixture({
  type: 'post',
  requestType: 'DELETE',
  hash: { id: '2' }
}, {
  post: {
    id: 2
  }
});

// Delete Posts
addFixture({
  type: 'post',
  requestType: 'DELETE_LIST',
  hash: {
    ids: ['1', '2']
  }
}, {
  post: {
    id: [1, 2]
  }
});

// Read Posts with releations
addFixture({
  type: 'post',
  requestType: 'READ_LIST',
  hash: {
    include: 'comments'
  }
}, {
  meta: {},
  payload: {
    post: [
      { id: 1, name: 'Javascript is awesome', comments: [1] },
      { id: 2, name: 'Socket.io is awesome', comments: [] },
      { id: 3, name: 'Ember.js is awesome', comments: [2] }
    ],
    comments: [
      { id: 1, name: 'This good.' },
      { id: 2, name: 'And angular.js too.' }
    ]
  }
});