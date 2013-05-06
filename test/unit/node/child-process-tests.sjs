var testUtil = require('../../lib/testUtil')
var testEq = testUtil.test;
var { context, test, assert } = require('sjs:test/suite');

context {||
  var child_process = require('sjs:nodejs/child-process');

  //-------------------------------------------------------------
  // exec (simple string)
  testEq('exec("echo 1")', {stdout: '1\n', stderr: ''}, function() {
    return child_process.exec('echo 1');
  });

  testEq('exec("echo 2 >&2")', {stdout: '', stderr: '2\n'}, function() {
    return child_process.exec('echo 2 >&2');
  });

  //-------------------------------------------------------------
  // run (an array of args)
  testEq('run("echo", ["1  2"]).stdout', '1  2\n', function() {
    // if spaces are interpreted by the shell,
    // the double-space will turn into a single.
    return child_process.run('echo', ['1  2']).stdout;
  });

  testEq('run("bash", ["-c", "echo 2 >&2"]).stderr', '2\n', function() {
    return child_process.run('bash', ['-c', 'echo 2 >&2']).stderr;
  });

  testEq('run returns stdout / stderr', {"code":1,"signal":null,"stdout":"out\n","stderr":"err\n"}, function() {
    var { filter } = require('sjs:sequence');
    var { propertyPairs, pairsToObject } = require('sjs:object');
    try{
      return child_process.run('bash', ['-c', 'echo out; echo err 1>&2; exit 1']);
    } catch(e) {
      return propertyPairs(e) ..
        filter([key,val] => ['stdout', 'stderr', 'code', 'signal'].indexOf(key) != -1) ..
        pairsToObject;
    }
  });

  //-------------------------------------------------------------
  // wait
  testEq('wait()', ['time passed', 'wait returned'], function() {
    var events = [];
    var child = child_process.launch('sleep', ['0.5']);
    try {
      child_process.wait(child);
      events.push('wait returned');
    } or {
      hold(250);
      events.push('time passed');
      hold();
    }
    return events;
  });

  test('wait() throws error on spawn error') {||
    //message differs between node < 0.10 and > 0.10
    assert.raises({message: /spawn EACCES|child process exited with nonzero exit status: 127/},
      -> child_process.run(".")); // "." will be a directory
  }

  testEq('wait() throws error with exit code', {events: [], code: 123}, function() {
    var events = [];
    var child = child_process.launch('bash', ['-c', 'exit 123']);
    try {
      child_process.wait(child);
      events.push('wait returned');
    } catch (e) {
      return {events: events, code: e.code};
    }
    return {events: events, error: 'no error'};
  });

  testEq('wait() throws error with signal', {events: [], signal: 'SIGTERM'}, function() {
    var events = [];
    var child = child_process.launch('sleep', ['0.5']);
    try {
      child_process.wait(child);
      events.push('wait returned');
    } or {
      hold(250);
      child_process.kill(child);
      events.push('child killed');
    } catch (e) {
      return {events: events, signal: e.signal};
    }
    return {events: events, error: 'no error'};
  });
  

  //-------------------------------------------------------------
  // kill
  function bash_exit_after(seconds) {
    return "trap 'echo interrupted; sleep " + seconds + "; exit' SIGINT SIGTERM; while true; do sleep 1; done";
  };

  testEq('kill returning immediately', 'immediately', function() {
    var child = child_process.launch('bash', ['-c', bash_exit_after(1)], {});
    try {
      child_process.kill(child, {wait:false});
      return 'immediately';
    } or {
      hold(500);
      return 'waited'
    }
  });

  testEq('kill waiting for child to exit', ['time passed', 'kill returned'], function() {
    //XXX this test succeeds inconsistently, and it's not a timing issue (raising the
    // timeout doesn't help). Is it an issue with node? or sjs?
    var child = child_process.launch('bash', ['-c', bash_exit_after(0.5)]);
    var events = [];
    try {
      hold(100); // give process time to even start
      child_process.kill(child);
      events.push('kill returned');
    } or {
      hold(250);
      events.push('time passed');
      hold();
    }
    return events;
  });

}.serverOnly();