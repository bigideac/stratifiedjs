var testUtil = require('../lib/testUtil')
var test = testUtil.test;
var collection = require('apollo:collection');

// return a function that sleeps for a smaller increment
// each time it's called (and then calls the wrapped function),
// to effectively reverse the return order
// when run multiple times in parallel.
var withDecreasingTimeout = function(fn) {
  var amount = 100;
  return function() {
    hold(amount-=20);
    return fn.apply(this, arguments);
  };
};

test('identity(1)', 1, function() { return collection.identity(1); });

test('toArray on an array does nothing', true, function() {
  var a = [1,2,3];
  return a === collection.toArray(a);
});

test('toArray on `arguments`', {wasArray: false, isArray: true, value: [1,2,3]}, function() {
  var args = null;
  (function() {
    args = arguments;
  })(1,2,3);
  var arr = collection.toArray(args);
  return {
    wasArray: args instanceof Array,
    isArray: arr instanceof Array,
    value: arr
  }
});

test('items() on an object', [['a',1], ['b',2], ['c',3]], function() {
  var obj = {a: 1, b:2, c:3};
  var keys = collection.items(obj);
  keys.sort(); // ensure ordering
  return keys;
});

test('items() on an array', [[0,'zero'],[1,'one'],[2,'two']], function() {
  return collection.items(['zero','one','two']);
});

test('keys() on an object', ['a','b','c'], function() {
  var obj = {a: 1, b:2, c:3};
  var keys = collection.keys(obj);
  keys.sort(); // ensure ordering
  return keys;
});

test('keys() on an array', [0,1,2], function() {
  return collection.keys(["one", "two", "three"]);
});

test('values() on an object', ['one', 'two'], function() {
  var vals = collection.values({k1: 'one', k2: 'two'});
  vals.sort();
  return vals;
});

test('eachSeq is ordered', [1,2,3], function() {
  var res = [];
  collection.eachSeq([1,2,3],
    withDecreasingTimeout(function(elem) { res.push(elem); }));
  return res;
});

test('each supports object properties', {key1: 2, key2: 4}, function() {
  items = {};
  collection.eachSeq({key1: 1, key2: 2}, function(v, k) {
    items[k] = v * 2;
  });
  return items;
});

test('each ignores prototype properties', {"instance":2}, function() {
  items = {};
  var Obj = function() {
  };
  Obj.prototype.parent = 2;
  var obj = new Obj();
  obj.instance = 1;
  collection.eachSeq(obj, function(v, k) {
    items[k] = v * 2;
  });
  return items;
});

test('each is run in parallel', [3,2,1], function() {
  var res = [];
  collection.each([1,2,3],
    withDecreasingTimeout(function(elem) { res.push(elem); }));
  return res;
});

test('each aborts early', [3,2], function() {
  var checked = [];
  collection.each([1,2,3],
    withDecreasingTimeout(function(elem) {
      checked.push(elem);
      if(elem == 2) {
        throw collection.stopIteration;
      }
    }));
  return checked;
});

test('eachSeq aborts early', [1,2], function() {
  var checked = [];
  collection.eachSeq([1,2,3],
    withDecreasingTimeout(function(elem) {
      checked.push(elem);
      if(elem == 2) {
        throw collection.stopIteration;
      }
    }));
  return checked;
});

test('each / eachSeq don\'t swallow all exceptions (only stopIteration)', 'expected error', function() {
  try {
    collection.each([1,2,3], function() { throw new Error("expected error"); });
    return "no error thrown!"
  } catch (e) {
    return e.message;
  }
});


test('map', {order: [3,2,1], result: [2,4,6]}, function() {
  var order = [];
  var result = collection.map([1,2,3],
    withDecreasingTimeout(function(elem) {
      order.push(elem);
      return elem * 2;
    }));
  return {order: order, result: result};
});

test('mapSeq', {order: [1,2,3], result: [2,4,6]}, function() {
  var order = [];
  var result = collection.mapSeq([1,2,3],
    withDecreasingTimeout(function(elem) {
      order.push(elem);
      return elem * 2;
    }));
  return {order: order, result: result};
});

test('map on an object', {one: 2}, function() {
  return collection.mapSeq({one:1}, function(n) { return n * 2; });
});

test('findSeq returns early', {checked: [1,2], result: 2}, function() {
  var order = [];
  var result = collection.findSeq([1,2,3],
    withDecreasingTimeout(function(elem) {
      order.push(elem);
      return elem == 2;
    }));
  return {checked: order, result: result};
});

test('find returns early', {checked: [3,2], result: 2}, function() {
  var order = [];
  var result = collection.find([1,2,3],
    withDecreasingTimeout(function(elem) {
      order.push(elem);
      return elem == 2;
    }));
  return {checked: order, result: result};
});

test('find* return undefined if not found',
    [undefined, undefined, undefined, undefined],
    function() {
  var fn = function() { return false; };
  var c = [1,2,3];
  return [
    collection.find(c, fn),
    collection.findSeq(c, fn),
    collection.findKey(c, fn),
    collection.findKeySeq(c, fn)
  ];
});

test('findKey on an array', 1, function() {
  return collection.findKeySeq(['zero','one','two'],
    function(el) { return el == 'one' });
});
test('findKey on an object', 'foo', function() {
  return collection.findKeySeq({foo:1, bar:2},
    function(el) { return el == 1 });
});

test('filterSeq', {checked: [1,2,3], result: [1,3]}, function() {
  var checked = [];
  var result = collection.filterSeq([1,2,3],
    withDecreasingTimeout(function(elem) {
      checked.push(elem);
      return elem != 2;
    }));
  return {checked:checked, result:result};
});

test('filter', {checked: [3,2,1], result: [1,3]}, function() {
  var checked = [];
  var result = collection.filter([1,2,3],
    withDecreasingTimeout(function(elem) {
      checked.push(elem);
      return elem != 2;
    }));
  return {checked:checked, result:result};
});

test('filterSeq on an object', {include:true}, function() {
  return collection.filterSeq({include: true, exclude: false},
    function(v, k) {
      return k == 'include';
    });
});

test('filter on an object', {include:true}, function() {
  return collection.filter({include: true, exclude: false},
    function(v, k) {
      return k == 'include';
    });
});

test('reduce', 6, function() {
  return collection.reduce([1,2,3], 0, function(accum, el) { return accum + el; });
});
test('reduce1', 6, function() {
  return collection.reduce1([1,2,3], function(accum, el) { return accum + el; });
});

test('reduce fails on an object', 'reduce on non-array', function() {
  try {
    return collection.reduce(0, {one: 1}, function() { return 'should not be run'; });
  } catch(e) {
    return e.message;
  }
});
test('reduce1 fails on empty array', 'reduce1 on empty collection', function() {
  try {
    return collection.reduce1([], function() { return 'should not be run'; });
  } catch(e) {
    return e.message;
  }
});

test('any returns early', {checked: [3, 2], result: true}, function() {
  var checked = [];
  var result = collection.any([1,2,3],
    withDecreasingTimeout(function(elem) {
      checked.push(elem);
      return elem == 2;
    }));
  return {checked:checked, result:result};
});
test('anySeq returns early', {checked: [1, 2], result: true}, function() {
  var checked = [];
  var result = collection.anySeq([1,2,3],
    withDecreasingTimeout(function(elem) {
      checked.push(elem);
      return elem == 2;
    }));
  return {checked:checked, result:result};
});

test('any* returns false when there is no match', [false, false], function() {
  var c = [1,2,3];
  var fn = function() { return false; };
  return [collection.any(c, fn), collection.anySeq(c, fn)];
});

test('all returns early', {checked: [3, 2], result: false}, function() {
  var checked = [];
  var result = collection.all([1,2,3],
    withDecreasingTimeout(function(elem) {
      checked.push(elem);
      return elem != 2;
    }));
  return {checked:checked, result:result};
});

test('allSeq returns early', {checked: [1, 2], result: false}, function() {
  var checked = [];
  var result = collection.allSeq([1,2,3],
    withDecreasingTimeout(function(elem) {
      checked.push(elem);
      return elem != 2;
    }));
  return {checked:checked, result:result};
});

test('all* returns true when all match', [true, true], function() {
  var c = [1,2,3];
  var fn = function() { return true; };
  return [collection.all(c, fn), collection.allSeq(c, fn)];
});


// all the `this` binding tests
var testThis = function(fnName /*, otherArgs */) {
  var _arguments = arguments;
  test('`this` binding for ' + fnName, 'this', function() {
    var expectedThis = 'this';
    var actualThis = 'not set';
    var cb = function() {
      // javascript promotion messes with strings as `this`, so we coerce them back to strings
      actualThis = this + '';
      return null;
    };

    var args = Array.prototype.slice.call(_arguments, 1);
    // first arg is always collection
    args.unshift([1,2,3]);

    // after otherArgs, add callacbk and this_obj:
    args.push(cb);
    args.push(expectedThis);
    collection[fnName].apply(null, args);
    return actualThis;
  });
};

testThis('each');
testThis('eachSeq');
testThis('map');
testThis('mapSeq');
testThis('find');
testThis('findSeq');
testThis('filter');
testThis('filterSeq');
testThis('reduce', 0);
testThis('reduce1');
testThis('any');
testThis('anySeq');
testThis('all');
testThis('allSeq');
testThis('findKey');
testThis('findKeySeq');
