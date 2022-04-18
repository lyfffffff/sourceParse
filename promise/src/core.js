"use strict";
// 源码
var asap = require("asap/raw");

function noop() {} // 空函数

// States: 状态
//
// 0 - pending 待定
// 1 - fulfilled with _value 成功 此时设置 _value 为 resolve 的参数
// 2 - rejected with _value 失败 此时设置 _value 为 reject 的参数
// 3 - adopted the state of another promise, _value 其他的状态
//
// once the state is no longer pending (0) it is immutable 当状态非0 时，不能修改

// All `_` prefixed properties will be reduced to `_{random number}`
// at build time to obfuscate them and discourage their use.
// We don't use symbols or Object.defineProperty to fully hide them
// because the performance isn't good enough.
//

// to avoid using try/catch inside critical functions, we
// extract them to here.
// 避免在函数内部使用try-catch，故所有try-catch提取至此
var LAST_ERROR = null;
var IS_ERROR = {};
function getThen(obj) {
  try {
    return obj.then;
  } catch (ex) {
    LAST_ERROR = ex;
    return IS_ERROR;
  }
}

function tryCallOne(fn, a) {
  try {
    return fn(a);
  } catch (ex) {
    LAST_ERROR = ex;
    return IS_ERROR;
  }
}
function tryCallTwo(fn, a, b) {
  try {
    fn(a, b);
  } catch (ex) {
    LAST_ERROR = ex;
    return IS_ERROR;
  }
}

module.exports = Promise;

function Promise(fn) {
  if (typeof this !== "object") {
    // 即必须使用new调用，当没有使用new构造时，this为undefined
    throw new TypeError("Promises must be constructed via new");
  }
  if (typeof fn !== "function") {
    throw new TypeError("Promise constructor's argument is not a function");
  }
  this._deferredState = 0;
  this._state = 0;
  this._value = null;
  this._deferreds = null;
  if (fn === noop) return;
  doResolve(fn, this); // 调用参数fn，将resovle、reject函数提供给模块外部函数fn
}
Promise._onHandle = null;
Promise._onReject = null;
Promise._noop = noop;

// then方法注册回调函数onFulfilled,onRejected
Promise.prototype.then = function (onFulfilled, onRejected) {
  if (this.constructor !== Promise) {
    return safeThen(this, onFulfilled, onRejected);
  }
  // 以noop空函数创建新的Promise对象，作为返回值获取后续注册的回调函数，供链式调用
  // 以noop创建Promise对象时，doResolve函数将不予执行
  var res = new Promise(noop);
  handle(this, new Handler(onFulfilled, onRejected, res));
  return res;
};

function safeThen(self, onFulfilled, onRejected) {
  return new self.constructor(function (resolve, reject) {
    var res = new Promise(noop);
    res.then(resolve, reject);
    handle(self, new Handler(onFulfilled, onRejected, res));
  });
}
function handle(self, deferred) {
  // 外部函数fn中resovle参数为promise，self改为该promise，以该promise向回调函数传参
  while (self._state === 3) {
    self = self._value;
  }
  // then方法初次调用时，promise添加相关Handler对象
  if (Promise._onHandle) {
    Promise._onHandle(self);
  }
  if (self._state === 0) {
    if (self._deferredState === 0) {
      // 最终变成2
      self._deferredState = 1;
      self._deferreds = deferred;
      return;
    }
    if (self._deferredState === 1) {
      self._deferredState = 2;
      self._deferreds = [self._deferreds, deferred];
      return;
    }
    self._deferreds.push(deferred);
    return;
  }
  handleResolved(self, deferred); // 调用then时使用
}
// deferred为Handler对象，存储有onFulfilled,onRejected回调函数
// deferred.promise为then方法中创建的Promise对象res，同时res作为返回值，拉取后续注册的回调函数
function handleResolved(self, deferred) {
  asap(function () {
    var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
    if (cb === null) {
      if (self._state === 1) {
        resolve(deferred.promise, self._value);
      } else {
        reject(deferred.promise, self._value);
      }
      return;
    }
    var ret = tryCallOne(cb, self._value);
    if (ret === IS_ERROR) {
      reject(deferred.promise, LAST_ERROR);
    } else {
      resolve(deferred.promise, ret);
    }
  });
}
// resolve 函数
function resolve(self, newValue) {
  // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
  if (newValue === self) {
    return reject(
      self,
      new TypeError("A promise cannot be resolved with itself.")
    );
  }
  if (
    newValue &&
    (typeof newValue === "object" || typeof newValue === "function")
  ) {
    var then = getThen(newValue);
    if (then === IS_ERROR) {
      return reject(self, LAST_ERROR);
    }
    if (then === self.then && newValue instanceof Promise) {
      self._state = 3;
      self._value = newValue;
      finale(self);
      return;
    } else if (typeof then === "function") {
      doResolve(then.bind(newValue), self);
      return;
    }
  }
  self._state = 1;
  self._value = newValue;
  finale(self);
}

function reject(self, newValue) {
  self._state = 2;
  self._value = newValue;
  if (Promise._onReject) {
    Promise._onReject(self, newValue);
  }
  finale(self);
}
function finale(self) {
  if (self._deferredState === 1) {
    handle(self, self._deferreds);
    self._deferreds = null;
  }
  if (self._deferredState === 2) {
    for (var i = 0; i < self._deferreds.length; i++) {
      handle(self, self._deferreds[i]);
    }
    self._deferreds = null;
  }
}

function Handler(onFulfilled, onRejected, promise) {
  this.onFulfilled = typeof onFulfilled === "function" ? onFulfilled : null;
  this.onRejected = typeof onRejected === "function" ? onRejected : null;
  this.promise = promise;
}

/**
 * 确保onFulfilled 和 onRejected 只被调用一次。
 *
 * Makes no guarantees about asynchrony.
 */
function doResolve(fn, promise) {
  var done = false;
  var res = tryCallTwo(
    fn,
    function (value) {
      // 调用 fn(参数2,参数3)
      if (done) return;
      done = true;
      resolve(promise, value);
    },
    function (reason) {
      if (done) return;
      done = true;
      reject(promise, reason);
    }
  );
  if (!done && res === IS_ERROR) {
    done = true;
    reject(promise, LAST_ERROR);
  }
}
