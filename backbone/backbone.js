/**
 * 库:underscore.js JQuery
 * js 知识:模块化、原型链和继承、this指向、MVC模式
 * 模块:Events 和 MVC 和 Router 和 history
 * 代码顺序:初始化(31-90) -> Events(90-491) -> Model(493-940) -> Collection(940-1476) -> View(1478-1645)
 * -> Model/Collection的公共部分(1647-1827) -> Router(1828-1932) -> History(1934-2239)-> Backbone辅助(2241-end)
 * 缺点:混入的外部方法没有区分,例如混入underscore的方法在this上,最好还是加个前缀this.sort => this.u_sort
 */
(function(factory) {

  // 定义全局对象 root 变量，在浏览器环境下为 window(self)，在 服务器 环境下为 global, self 指向 window
  // 使用 self 代替 window 对象，为了兼容 'webWorker' 环境
  var root = typeof self == 'object' && self.self === self && self ||
            typeof global == 'object' && global.global === global && global;

  // 定义一个 AMD 模块，该模块依赖 'underscore'、'jquery','expoerts'
  if (typeof define === 'function' && define.amd) {
    define(['underscore', 'jquery', 'exports'], function(_, $, exports) {.
      // 在 AMD 中导出全局事件
      root.Backbone = factory(root, exports, _, $);
    });

  // 默认是 CommonJS 规范时， exports 是用于导出模块的对象
  } else if (typeof exports !== 'undefined') {
    var _ = require('underscore'), $;
    try { $ = require('jquery'); } catch (e) {}
    factory(root, exports, _, $);

  // 最后，啥也不是，纯的浏览器全局对象
  } else {
    root.Backbone = factory(root, {}, root._, root.jQuery || root.Zepto || root.ender || root.$);
  }

})(function(root, Backbone, _, $) {

  // 初始化操作
  
  // 缓存 Backbone，防止命名冲突
  var previousBackbone = root.Backbone;

  // 缓存数组的 slice 方法
  var slice = Array.prototype.slice;

  // 版本号
  Backbone.VERSION = '1.4.0';

  // 若想使用 backBone，需先支持的库包括 jQuery、Zepto
  // `$` 变量是 jquery
  Backbone.$ = $;

  // 若全局已存在过 Backbone，调用此函数更换变量名称
  // let backbone_new = Back.onConflict() // 此时backbone_new 就是BackBone的代名词,拥有所有功能
  Backbone.noConflict = function() {
    root.Backbone = previousBackbone;
    return this;
  };

  /****************** 请求兼容 其实一般用不上 *************/
  // 对于不支持默认 REST / HTTP 方法的旧式服务器时， 可以设置 emulateHTTP = true，服务器请求将使用 HTTP POST 伪造 PUT，PATCH 和 DELETE 请求
  Backbone.emulateHTTP = false;


  // 对于不支持 application/json 编码的旧式服务器， 可以设置 emulateJSON = true，将请求类型设置为 application/x-www-form-urlencoded
  Backbone.emulateJSON = false;

  /****************** 请求兼容 end *************/
  
  /****************** Event  *****************/

  // Events在任一模块中都有混入,例如Backbone、Backbone.Model、Backbone.Collection.以便为其提供自定义事件通道。 
  // 使用 `on` 将回调绑定到事件或使用 `off` 移除事件； `trigger` - 触发事件连续触发所有回调。
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  
  // 将 Events 初始化为空对象
  var Events = Backbone.Events = {};

  // 正则表达式，表示匹配一个或多个空白符
  var eventSplitter = /\s+/;

  // A 通过 listening 监听对象 B，记录 listening
  var _listening;


  // 遍历标准的迭代事件'事件 回调函数'，也将
  // 空格分割事件形式：'"事件 1 事件 2" 回调函数'，
  // JQ 形式 '{事件:回调函数}' 
  // 转为标准迭代事件

  /**
   * @param {function} iteratee 迭代函数
   * @param {*} events 事件，初始化为{}
   * @param {Oject,'','xxx xxx'} name 事件
   * @param {function} callback 回调函数
   * @param {Object} opts 参数
   * @returns 
   */
  var eventsApi = function(iteratee, events, name, callback, opts) {
    var i = 0, names;
    if (name && typeof name === 'object') {
      // 当 name 为对象时，且 context 没有被赋值，即调用 Events.on 时传两个参数，callback 被当做是 context 使用，在 Events.once 时调用
      if (callback !== void 0 && 'context' in opts && opts.context === void 0) opts.context = callback;
      // underscore _.keys 返回对象的键迭代器，遍历事件绑定回调
      for (names = _.keys(name); i < names.length ; i++) {
        events = eventsApi(iteratee, events, names[i], name[names[i]], opts);
      }
    } else if (name && eventSplitter.test(name)) {
      // 若事件名称为空格衔接的字符串，如'click enter'，切割为数组后遍历调用
      for (names = name.split(eventSplitter); i < names.length; i++) {
        events = iteratee(events, names[i], callback, opts);
      }
    } else {
      // 最终状态
      events = iteratee(events, name, callback, opts);
    }
    return events;
  };

  // ctx 与 context 差不多，ctx 可以保证有值，在 trigger 方法中需要给 callback 指定上下文，这个时候就要用到 ctx 而非 context
  // 但是在 off 方法中 要与用户绑定时的 context 进行对比，所以使用的是 context 而不是 ctx

  /**
   * 给事件绑定回调函数，传递 'all' 事件时，将回调绑定到所有触发的事件上
   * Events.listenTo 中的 on 也是调用此方法来绑定事件
   * 例：A.listenTo(B, 'b', callback) -> B.on('b',callback) -> _listening = this.listeningTo[B._listenId]
   * Events.once/listenOnce 也要调用此方法绑定事件
   * 例：A.once('a',callback) -> A.on({'a':{_callback:callback}}) ->
   * @param {String | Obejct} name 事件名，传递 'all' 时
   * @param {Function} callback 回调函数（当为对象时，将事件名和回调函数结合）
   * @param {Object} context 上下文 可选
   * @returns this
   */
  Events.on = function(name, callback, context) {
    // 所有事件回调都存储在 this._events 
    this._events = eventsApi(onApi, this._events || {}, name, callback, {
      context: context, // 传入的上下文
      ctx: this, // 当没有传上下文时充当上下文
      listening: _listening // 当是通过listenOn绑定的on方法,此时_listening有值,_listening == this._listeningTo[‘l1’],否则 undefined
    });
    

    // this._listeners 在此处赋值 this._listeners[_listening.id] = _listening
    if (_listening) {
      var listeners = this._listeners || (this._listeners = {});
      listeners[_listening.id] = _listening;
      // 允许 listening 使用计数器
      _listening.interop = false;
    }

    return this;
  };



  /**
   * this._listeningTo {Object} eg:{'l1':{count,id,interop,listener,obj,events}...} 每一项都存储一个监听对象信息
   * this._listenId  {String} 生成一个标识 id
   * _listening 一个全局变量，存储着 this._listeningTo[obj._listrnId],即某被监听对象的信息
   */

  /**
   * 对象A监听对象B上触发的事件，但本质on事件绑定在B上面。
   * A.listenTo(B, “b”, callback); // B 对象上面发生 b 事件的时候，通知调用回调函数。
   * 调用栈：B.listenTo -> (Listening) -> tryCatchOn -> A.On
   * @param {Object} obj 想要监听的对象
   * @param {String} name 所监听的事件名
   * @param {Function} callback 监听事件触发时的回调函数
   * @returns this
   */
  Events.listenTo = function(obj, name, callback) {
    if (!obj) return this; // 若没有对象B，返回
    // underscore _.uniqueId：生成一个全局唯一的 id，若有参数则将参数拼接在 id 前，这个 id 以 l 开头
    var id = obj._listenId || (obj._listenId = _.uniqueId('l')); // 对象 B 的 _listenId 属性，不存在则通过 _.uniqueId('l') 生成唯一 id 
    var listeningTo = this._listeningTo || (this._listeningTo = {}); // 全局变量 _listeningTo 存放对象B的信息，若没有则先定义
    var listening = _listening = listeningTo[id]; // 通过对象B的 _listenId 属性在 _listeningTo 中查找监听信息
    
    // !listening 表示首次监听对象B，需初始化 listeningTo[B._listenId]
    // Listening() 可以实例化一个 listeningTo 键值的构造函数
    if (!listening) {
      this._listenId || (this._listenId = _.uniqueId('l')); // 对象A自身的_listenId属性
      listening = _listening = listeningTo[id] = new Listening(this, obj);
    }

    // 对象B应是 Events 对象，并在其 on 事件上绑定事件 'b'，否则返回报错
    var error = tryCatchOn(obj, name, callback, this);
    _listening = void 0; // 已在on事件中进行绑定,设为 undefined

    if (error) throw error;
     // 若对象B不是 Backbone.Events，则手动追踪
    if (listening.interop) listening.on(name, callback);
    return this;
  };

  /**
   * 给事件添加回调函数
   * @param {*} events 事件
   * @param {*} name 事件名称
   * @param {*} callback 回调函数
   * @param {*} options 
   * @returns events
   */
  var onApi = function(events, name, callback, options) {
    if (callback) {// 当有回调时执行，当 once 绑定时，没有 callback,直接返回 events
      var handlers = events[name] || (events[name] = []); // 事件名
      var context = options.context, ctx = options.ctx, listening = options.listening;
      if (listening) listening.count++;

      handlers.push({callback: callback, context: context, ctx: context || ctx, listening: listening}); // 一个事件不止一个回调
    }
    return events;
  };



    /**
     * 使用 try-ctach 保护 on 方法，以防止污染全局 _listening 变量。
     * 等同于 Events.on(name, callback, context)
     * @param {Object} obj 
     * @param {String} name 
     * @param {Function} callback 
     * @param {Object} context 
     * @returns 
     */
  var tryCatchOn = function(obj, name, callback, context) {
    try {
      obj.on(name, callback, context);
    } catch (e) {
      return e;
    }
  };

  /**
   * 移除一个或多个回调，根据参数分别移除，最终调用 offApi 函数
   * 1,当没有参数时 移除所有事件监听
   * 2,当只有 name 参数时 移除 name 事件的所有事件监听
   * 3,当参数齐全时 移除 name 事件所绑定的 callback 回调并将 context 作为上下文
   * @param {String} name 事件名
   * @param {Function} callback 回调函数
   * @param {Object} context 上下文
   * @returns 
   */
  Events.off = function(name, callback, context) {
    if (!this._events) return this; // 当没有回调栈时，返回
    this._events = eventsApi(offApi, this._events, name, callback, {
      context: context,
      listeners: this._listeners // this._listeners存储了所有因为对象A用listenTo逼我,才绑定的事件
    });

    return this;
  };

  /**
   * 解除对象A对对象B的事件'b'的监听
   * 调用栈：stopListening -> B.off -> eventsApi -> offApi
   * @param {Object} obj 当为 undefined 时，表示解除对所有对象的监听
   * @param {String} name 事件名
   * @param {Function} callback 回调函数
   * @returns this
   */
  Events.stopListening = function(obj, name, callback) {
    var listeningTo = this._listeningTo; // 对对象进行监听时创建，若找不到this._listeningTo，证明没有对其他对象进行监听，返回
    if (!listeningTo) return this;

    var ids = obj ? [obj._listenId] : _.keys(listeningTo); // B 中存储了一个_listenId 属性， 若没有传 B,获取 listeningTo 所有监听的对象

    for (var i = 0; i < ids.length; i++) {
      var listening = listeningTo[ids[i]]; // listeningTo[obj._listenId] || listeningTo[ _.keys(listeningTo)] 后者当没有内容时直接 delete 必然不会返回 undefined

      if (!listening) break; // 若 listeningTo[obj._listenId] 不存在，则退出循环

      listening.obj.off(name, callback, this); // obj 中存储着对象 B,调用 B.off()
      if (listening.interop) listening.off(name, callback); // TODO
    }
    if (_.isEmpty(listeningTo)) this._listeningTo = void 0; // 若是将 this._listeningTo清空了，直接赋值为 undefined

    return this;
  };

  /**
   * 移除事件的回调函数
   * 回调栈：offApi -> Listening.prototype.cleanup
   * @param {Object} events 所有事件绑定都在此
   * @param {String} name 事件名
   * @param {Function} callback 回调函数
   * @param {Object} options 上下文
   * @returns 
   */
  var offApi = function(events, name, callback, options) {
    if (!events) return;// 当没有任何回调时，返回

    var context = options.context, listeners = options.listeners; // options.listeners 存储所有被迫绑定的事件
    var i = 0, names;

    // 当没有传事件名、回调函数和上下文时，移除回调栈中所有事件,首当其冲就是被迫绑定的事件
    if (!name && !context && !callback) {
      for (names = _.keys(listeners); i < names.length; i++) {
        listeners[names[i]].cleanup(); // Listening.prototype.cleanup,在监管者A中移除绑定记录,在自身移除被绑定过的痕迹
      }
      return;
    }

    // 获取要移除的事件名，无则移除所有事件名
    names = name ? [name] : _.keys(events);
    for (; i < names.length; i++) {
      name = names[i];
      var handlers = events[name];

      // 获取该事件名对应的回调数组，若无则返回
      if (!handlers) break;

      // 最终该事件名绑定的事件数组
      var remaining = [];
      for (var j = 0; j < handlers.length; j++) {
        var handler = handlers[j];
        // 要求上下文和回调函数全等，否则保留在 remaining
        if (
          callback && callback !== handler.callback &&
            callback !== handler.callback._callback ||
              context && context !== handler.context
        ) {
          remaining.push(handler);
        } else {
            // 否则，获取监听方，移除监听方的回调
          var listening = handler.listening;
          if (listening) listening.off(name, callback);
        }
      }

      // 若该事件仍有其他回调，赋值，否则移除该属性
      if (remaining.length) {
        events[name] = remaining;
      } else {
        delete events[name];
      }
    }

    return events;
  };

  /**
   * 与on的功能类似,但是绑定事件只触发一次，触发一次后，移除此监听器
   * 调用栈：A.once -> eventsApi -> A.off -> onceMap -> A.on
   * @param {Object} name 事件名
   * @param {Function} callback  回调函数
   * @param {Object} context 上下文
   * @returns this.on()
   */
  Events.once = function(name, callback, context) {
    // 本来为 event 的参数 2 设为{}
    var events = eventsApi(onceMap, {}, name, callback, this.off.bind(this)); // this.off() 函数，this始终指向本对象A,此时已经将callback存储在events._callback中
    // 若事件名是字符串且上下文为空，回调函数设为 undefined
    // 因为在onceMap中,已经调用过一次的事件，会将上下文设为空
    if (typeof name === 'string' && context == null) callback = void 0; 
    return this.on(events, callback, context); // 调用 on 方法绑定事件
  };

  /**
   * 也是A监听B上的'b'事件，只不过只触发一次
   * 调用栈：A.listenToOnce -> eventsApi -> onceMap -> A.stopListening -> A.listenTo
   * @param {Object} obj 
   * @param {String} name 
   * @param {Function} callback 
   * @returns this.listenTo()
   */
  Events.listenToOnce = function(obj, name, callback) {
    var events = eventsApi(onceMap, {}, name, callback, this.stopListening.bind(this, obj));
    return this.listenTo(obj, events);
  };

  /**
   * 将回调化为形如 {event:onceWrapper}, offer 在被调用后解除了 onceWrapper 的绑定。
   * @param {Object} map  
   * @param {String} name 
   * @param {Function} callback 
   * @param {Function} offer Events.off()
   * @returns 
   */
  var onceMap = function(map, name, callback, offer) {
      // 当有 callback 时，表示还没有调用过
    if (callback) {
        // underscore _.once(function) 创建一个只能调用一次的函数。重复调用该方法也没有效果，只会返回第一次执行时的结果。
        // 最终触发 trigger 时，调用此函数，触发解绑 off 和执行 callback
      var once = map[name] = _.once(function() {
        offer(name, once); //  A.off(name,once)
        callback.apply(this, arguments); // 最终 callback = map[name] ,调用时，callback 回调函数被执行，并将执行上下文指定在 this
      });
      once._callback = callback; // 此时，map[name]._callback == callback
    }
    return map;
  };

  // 触发一个或多个事件，参数 1 是事件名，和绑定一样，可以传字符串和对象，回调所有绑定函数。
  // 当有名为 'all' 的事件时，每调用一次其他事件，都会触发 'all' 事件。
  Events.trigger = function(name) {
    if (!this._events) return this; // 当没有任何绑定时，直接返回

    var length = Math.max(0, arguments.length - 1);
    var args = Array(length);
    for (var i = 0; i < length; i++) args[i] = arguments[i + 1];// 触发事件时，可以给回调函数传参数，因为参数个数不确定，故在 arguments 中进行查找和保存

    eventsApi(triggerApi, this._events, name, void 0, args); // callback 传 undefined，opts 传 后面的参数
    return this;
  };

  /**
   * 找出事件的回调函数数组，当有'all'事件时，额外再触发
   * @param {Object} objEvents 
   * @param {String} name 
   * @param {undefined} callback 
   * @param {Array} args 
   * @returns objEvents 
   */
  var triggerApi = function(objEvents, name, callback, args) {
    if (objEvents) {
      var events = objEvents[name];
      var allEvents = objEvents.all; // 找出名为 all 的事件
      if (events && allEvents) allEvents = allEvents.slice();
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, [name].concat(args));
    }
    return objEvents;
  };

  /**
   * 遍历回调函数数组，并将 args 作为参数传入
   * @param {Array} events 
   * @param {Array} args 
   * @returns 
   */
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {// 根据参数个数使用 switch
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
    }
  };

  /**
   * 一个构造函数，保护当前对象所监听的对象，并且拥有绑定、移除绑定、移除所有绑定的功能
   * @param {Object} listener 表示监听者 A
   * @param {Obejct} obj 表示被监听者 B
   */
   var Listening = function(listener, obj) {
    this.id = listener._listenId; // 监听者的 _listenId
    this.listener = listener; // 监听者 A
    this.obj = obj; // 被监听者 B
    this.interop = true;
    this.count = 0; // 监听了几个事件
    this._events = void 0; // 监听事件的回调函数序列
  };

  // 拥有和 Events.on 一样的绑定 on 方法
  Listening.prototype.on = Events.on;

  /**
   * 解除监听的回调，暂时没看到调用处
   * @param {String} name 事件名
   * @param {Function} callback 回调函数
   */
    Listening.prototype.off = function(name, callback) {
    var cleanup;
    if (this.interop) {// 初始化时 this.interop设为true，但是仍不知道有啥用 TODO
      this._events = eventsApi(offApi, this._events, name, callback, {
        context: void 0,
        listeners: void 0
      });
      cleanup = !this._events;
    } else {
      this.count--;
      cleanup = this.count === 0;
    }
    if (cleanup) this.cleanup();
  };

  // 清除绑定
  Listening.prototype.cleanup = function() {
    delete this.listener._listeningTo[this.obj._listenId]; // 在监管者A中删掉B的绑定记录
    if (!this.interop) delete this.obj._listeners[this.id]; // this.interop 为 false,即会触发，删除对象B的 B._listeners[A._listenId]
  };

  // 等价函数命名
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // 将 Events 的属性设置在 Backbone 里，即直接使用 Backbone.on 可以做到 Backbone.Events.on 的功能
  // underscore:_.extend(obj, sources,...) 
  // 复制 source 对象中的所有属性覆盖到对象obj上，并且返回对象obj. 复制是按顺序的， 即后面的对象属性可把前面重复的对象属性覆盖掉。且复制是浅拷贝
  _.extend(Backbone, Events);

  /**************************************** Model 493-938 *****************************************************/


  // Bcakbone 重写了 MVC 模式
  // 以Model为例子,使用:let model = Model.extend({},{}); let obj = new model()
  // 第一步创建MVC的构造函数(需先了解 extend 辅助函数),第二步创建MVC的实例
  // this.preinitialize // 预初始化，构造MVC函数时需作为参数1的同名属性传入,被放置在MVC函数的prototype中,在 new MVC 实例时首先触发
  // this.initialize // 初始化
  // Model.prototype 上置入了 Backbone.Events 的所有方法和属性，即在new实例函数内部和原型中,都可以使用this访问Events的属性和方法,若需设置监听类方法，直接使用 model.prototype.on('xxx',function)

  /**
   * Model
   * 构造函数构造 Model，该model具有特殊属性，一个自动分配的客户端id（cid）
   * Model 在框架中是基本数据对象，通常表示服务器上数据库的某一行
   * 一块离散的数据和一堆有用的相关方法，用于对该数据执行计算和转换
   * this.defaults // 构造MVC函数时需作为参数1的同名属性传入
   * 调用栈：Backbone.Model -> Bcakbone.Model.prototype.set()
   */
  var Model = Backbone.Model = function(attributes, options) {
    // 初始化参数为对象，防止传 undefined
    var attrs = attributes || {}; 
    options || (options = {});

    // 预初始化 
    this.preinitialize.apply(this, arguments);

    // cid表示实例的id
    this.cid = _.uniqueId(this.cidPrefix); // this.cidPrefix 默认为'c'
    // 实例中的数据
    this.attributes = {};
    // 若options中有collection参数,将其保存
    if (options.collection) this.collection = options.collection;
    // 若options中有parse参数,若为json数据需格式化
    if (options.parse) attrs = this.parse(attrs, options) || {};


    /** 将attributes和default结合 */
    // _.result(object, property)：若对象 object 中的属性 property 是函数， 则调用它， 否则， 返回它。
    var defaults = _.result(this, 'defaults');
    // 双重覆盖，以防_.extend使用undefined覆盖this.defaults 中的属性值
    // _.defaults(object, *defaults)：用 defaults 对象填充object中属性,但是对于已存在属性且属性值不为undefined的,不进行覆盖
    attrs = _.defaults(_.extend({}, defaults, attrs), defaults);

    // 调用原型上的方法 prototype.set() 将 attrs和options 置于 this.attributes 
    this.set(attrs, options); 
    this.changed = {}; // 保存上一次 set 后的数据字段

    // 初始化
    this.initialize.apply(this, arguments); 
  };

  // 在 Model.prototype 中设置属性，供实例化使用
  // 使用 _.extends 为 Model 原型设置属性和方法，参数 2 ~ n 都会复制到参数 1,故原型上包含 Backbone.Events 中所有属性和方法
  _.extend(Model.prototype, Events, {
    // 本次 set 所改变的数据的 key:value 集合，在 new 对象时改成 {}
    changed: null,

    // 数据设置是否合法，结合自定义 this.validate 和 this._validate 使用
    validationError: null,

    //id 属性，可以修改
    idAttribute: 'id',

    // 用于作为cid的前缀
    cidPrefix: 'c',

    // 预定义函数，在初始化new中最先调用
    preinitialize: function(){},

    // 同样供用户自定义，在初始化new最后调用
    initialize: function(){},

    // 返回属性对象的浅拷贝，以防污染对象,用于调用者将其使用 JSON.stringify() 转为json字符串
    toJSON: function(options) {
      return _.clone(this.attributes);
    },

    // 在Collection和Model都使用了 Backbone.sync,返回一个对象
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    

    // 从model获取属性值,比如： model.get("title")
    get: function(attr) {
      return this.attributes[attr];
    },

    // 属性值进行特殊符号(html)转义
    // alert(hacker.escape('<script>'));  // 输出 &lt;script&lt;
    escape: function(attr) {
      // underscore _.escape(string)方法:将HTML字符串转化为实体字符集，替换 &, <, >, ", ', 和 / 字符为。
      return _.escape(this.get(attr));
    },

    // 判断model实例中是否包含某属性,若属性值设为 null,也返回 false
    has: function(attr) {
      return this.get(attr) != null;
    },

    // 特殊情况下代理 underscore's `_.matches` 方法
    matches: function(attrs) {
        // underscore _.iteratee(value, [context], [argCount])
        // 改进_.matches,因为不一定传对象，可能是字符串/函数/对象，此方法根据参数类型返回对应的回调
      return !!_.iteratee(attrs, this)(this.attributes);
    },

    /**
     * 设置，new 实例时，必然触发
     * 向 model 设置一个或多个 hash 属性(attributes)。如果任何一个属性改变了 model 的状态，在不传入 {silent: true} 选项参数的情况下
     * 会触发 "change" 事件，更改特定属性的事件也会触发
     * 可以绑定事件到某个属性，例如：change:title，及 change:content
     * @param {Object|String} key 当前属性/属性对象
     * @param {Object|String} val 当前属性的值/options
     * @param {Object} options options
     * @returns 
     * set 可能是嵌套的，即在set中调用set.但是需区分第一层的set与其他层set(内层set在if (changing) return this 中返回，而外层set不返回),故不使用 this._changing,而是单独定义一个 changeing
     * 第一层set肯定是上一个完结后/第一个，前者 this._changing为false,后者 this._changing为undefined,都不会在 if (changing) return this 中返回，而内层因为 this._changing为true,故返回
     */
    set: function(key, val, options) {
      if (key == null) return this; // 若没有需设置的属性，直接返回

      // 判断是 set('name','lyf',options) 还是 set({name:'lyf',...},options)
      var attrs; // 始终为 {name:'lyf',...}
      if (typeof key === 'object') {
        // 若key是对象,参数2将被视为options参数
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }
      // options 初始化为对象
      options || (options = {});

      // 对数据进行options验证,不通过则返回
      if (!this._validate(attrs, options)) return false;

      // 额外的属性和 options
      var unset      = options.unset; // Boolean 值，若options有此属性,表示删除某属性
      var silent     = options.silent; // 当为true时,不触发 change/[change:属性名] 等监听，只进行 set
      var changes    = []; // 本次set的操作的属性名数组集
      var changing   = this._changing; // this._changing 为 Boolean/undefined,赋值操作为深拷贝，即互不干扰.初次调用set时changing为this._chaning = undefined -> changing = undefined
      this._changing = true; // 赋值为 true

      // 在set之前将上次的this.attributes保存在this._previousAttributes中,以便使用历史变量对象
      // new实例时changing = undefined 必然触发，此时 this.changed = {}
      if (!changing) {
          // underscore _.clone(object) 创建 一个浅拷贝的克隆object。任何嵌套的对象或数组都通过引用拷贝，不会复制
        this._previousAttributes = _.clone(this.attributes);
        // 清空，this.changed存储变化记录，用于保存上一次`set`之后改变的数据字段。
        this.changed = {};
      }

      // 当前实例中的变量对象
      var current = this.attributes;
      // new 实例时为{}
      var changed = this.changed;  // 对象为浅拷贝
      // 保存set之前的变量,即现在内容上 current == prev 
      var prev    = this._previousAttributes;

      /** 对于每个attrs上的属性，遍历更新、删除当前值 */ 
      for (var attr in attrs) {
        // attr 存储当前属性名称， val 存储当前属性的值
        val = attrs[attr];

        // 若与现有属性不符，该属性名插入数组
        // underscore _.isEqual(object, other)方法:执行两个对象之间的优化深度比较，确定他们是否应被视为相等。
        if (!_.isEqual(current[attr], val)) changes.push(attr);

        // 如果上次属性不符，则在changed中保存该属性键值,否则，移除该键值
        if (!_.isEqual(prev[attr], val)) {
          changed[attr] = val; // 修改 changed,但没有修改 this.changed
        } else {
          delete changed[attr];
        }
        // 优先级删除大于更新，若不删除则更新
        unset ? delete current[attr] : current[attr] = val;
      }

      // 若在 set 中传入id属性,则可以更新实例的 id
      // 还可以触发 onchangeId 事件，前提是设置了监听 model.prototype.on('changeId')
      if (this.idAttribute in attrs) {
        var prevId = this.id;
        this.id = this.get(this.idAttribute); // this.attributes[attr]
        this.trigger('changeId', this, prevId, options); // 若此处再次进入 set,则 changing = true
      }

      // 判断 options 中是否有 {silent: true} 的设置，若没有，则操作
      // changes 的数组项保存此次set中的所有被修改的属性名，遍历触发 change:changes[i] 即 change:属性名 事件
      // trigger 的参数3为当前的
      // 同时 this._pending = options（后续步骤使用）
      if (!silent) {
        if (changes.length) this._pending = options;
        for (var i = 0; i < changes.length; i++) {
            // 传入this作为事件参数,则可以使用set等方法,会再次触发 set,可以一直迭代，但是若出现一直在此调用方法，则报错" Maximum call stack'
            // 若此处再次进入 set,则 changing = true
          this.trigger('change:' + changes[i], this, current[changes[i]], options); 
        }
      }

      // 若 changing 为 true，返回 this,中断下面代码
      // !silent 中触发的 change:属性名 事件可能再次导致 set 方法的调用，此时 this._changing为true,导致 changing = this.changing为true,代码执行至此，返回
      if (changing) return this;

      // 同样是在 silent 为 false 时触发，若set有修改属性 changes.push -> this._pending = options,进入while循环
      // 将 this._pending 设为 false,触发change事件,只会调用一次，若在change事件中进行set,仍不会再触发change事件
      if (!silent) {
        while (this._pending) {
          options = this._pending; // 前面的trigger有可能修改options,将options拿回
          this._pending = false; // 调用一次就设为 false,且需在trigger前,以防一直调用
          this.trigger('change', this, options); // 只有第一个set会触发,最后触发，可进行会再次触发 set,可以一直迭代，但是若出现一直在此调用方法，则报错" Maximum call stack'
        }
      }

      // 将 this._pending设为false 和 _changing设为false
      this._pending = false;
      this._changing = false;
      return this;
    },

    // 删除属性方法unset同样是调用set,只不过将options中的unset设为true,因为unset的优先级大于set,故执行删除
    // 因为是删除，故参数 val 传 void 0
    unset: function(attr, options) {
      return this.set(attr, void 0, _.extend({}, options, {unset: true}));
    },


    // 清除attributes中所有属性,触发change事件
    clear: function(options) {
      var attrs = {};
      for (var key in this.attributes) attrs[key] = void 0;
      return this.set(attrs, _.extend({}, options, {unset: true}));
    },

    // 因为调用 set(第一层)会重置 changed,故不会保留上次set所修改的属性,此方法通过changed判断上次set有没有改动参数attr属性,若不传参数则判断是否有属性被修改了
    hasChanged: function(attr) {
      // underscore _.isEmpty(object) 若对象 object 没有可枚举的属性，返回true。若字符串/类数组object的length为0，_.isEmpty返回true。
      if (attr == null) return !_.isEmpty(this.changed);
      return _.has(this.changed, attr);
    },


    // 对比参数diff和现有的属性对象,判断和预期的是否相同，若都和预期相同，返回 false,否则返回不匹配属性所构成的对象
    changedAttributes: function(diff) {
      if (!diff) return this.hasChanged() ? _.clone(this.changed) : false; // 若不传参数，返回一个包含所有被修改属性的对象，或 false
      var old = this._changing ? this._previousAttributes : this.attributes; // _changing 为 Boolean 值，完成set之后被设为false,仍在set中为true,根据此赋值
      var changed = {}; 
      var hasChanged;
      for (var attr in diff) {
        var val = diff[attr];
        if (_.isEqual(old[attr], val)) continue; // 若和预期值相同，则退出
        changed[attr] = val; // 和预期值不同，保存
        hasChanged = true;
      }
      return hasChanged ? changed : false;
    },


    // 返回属性的上一个值，无则返回 null
    previous: function(attr) {
      if (attr == null || !this._previousAttributes) return null;
      return this._previousAttributes[attr];
    },

    // 返回上一次的所有属性对象
    previousAttributes: function() {
      return _.clone(this._previousAttributes);
    },

    /*********************** fetch/save/destory 皆是发送请求 *************************/

    // options {Object} 至少包括 url/success/error
    // 等同于触发一个请求事件,调用$.ajax({}),最终得到一个 xhr 对象
    fetch: function(options) {
      options = _.extend({parse: true}, options); // parse 解析,常用来解析数据格式,当options的parse属性为true时,配套设置this.parse函数,否则不起效果

      // 封装options的成功函数,因为每个方法要封装的细节不同,没有抽取公共函数
      var success = options.success; 
      options.success = function(resp) { // 请求成功的回调函数
        var serverAttrs = options.parse ? model.parse(resp, options) : resp; // 若option有解析属性,表明数据不是set所需的数据格式,调用model.parse解析为所需格式
        if (!model.set(serverAttrs, options)) return false; // 此处return this
        if (success) success.call(options.context, model, resp, options); // 原有的success函数
        model.trigger('sync', model, resp, options); // 触发名为'sync'的事件
      };

      // 封装options的失败函数,直接调用公共疯装函数
      wrapError(this, options); 
      return this.sync('read', this, options); // 'read'触发get事件
    },


    /**
     * backbone的model.save方法会判断当前的model对象是否存在存在服务器中，如果存在服务器中，则调用"update" (HTTP PUT)
     * 如果不存在，则调用"create" (HTTP POST)， 判断的依据即为当前的model的属性'id'是否存在。
     * @param {String|Object} key 
     * @param {String|Object} val 为val字符串或options对象 
     * @param {*} options 
     * @returns 
     */
    save: function(key, val, options) {
      // 和set一样,参数有('name','lyf',options) 和 ({name:'lyf'},options),两种格式,需区分
      var attrs; // 类似于attributes,设为为{key:value}
      if (key == null || typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options = _.extend({validate: true, parse: true}, options); // 验证和解析格式在没有设置时,默认为true

      // 如果在options中设置了wait选项, 则被改变的数据将会被提前验证, 且服务器没有响应新数据(或响应失败)时
      // 本地数据会被还原为修改前的状态,如果没有设置wait选项, 则无论服务器是否设置成功, 本地数据均会被修改为最新状态
      var wait = options.wait;


      // 未设置 wait 选项时，直接将修改的attrs使用set保存在模型中,便于在sync方法中获取模型数据保存到服务器
      // 否则,先不进行set,但是对attrs进行提前验证合法(set里的某一步)
      if (attrs && !wait) {
          // 如果set失败，则返回false
        if (!this.set(attrs, options)) return false;
      } else if (!this._validate(attrs, options)) {
          // 设置了 wait 选项，对需要保存的数据提前进行验证
        return false;
      }

      // 成功的服务器端保存后，客户端（可选）会更新服务器端状态。
      var model = this;
      var success = options.success; // 成功的回调函数
      var attributes = this.attributes; // 当前的属性集,受wait影响会不同
      
      // 封装options的成功函数,因为每个方法要封装的细节不同,没有抽取公共函数
      options.success = function(resp) { // resp 为请求成功后服务器response的数据
        model.attributes = attributes; 
        var serverAttrs = options.parse ? model.parse(resp, options) : resp; // 解析数据
        if (wait) serverAttrs = _.extend({}, attrs, serverAttrs); // 不通过set,而是_.extend直接赋值
        if (serverAttrs && !model.set(serverAttrs, options)) return false; 
        if (success) success.call(options.context, model, resp, options);
        model.trigger('sync', model, resp, options); // 触发 'sync' 事件
      };

      // 封装错误函数
      wrapError(this, options); 

      if (attrs && wait) this.attributes = _.extend({}, attributes, attrs); // 因为wait没有set数据,现在使用_extend补上

      var method = this.isNew() ? 'create' : options.patch ? 'patch' : 'update'; // 确认method(请求方式),若当前model是新实例(即没有id),认为是'create',否者认为是'update'
      if (method === 'patch' && !options.attrs) options.attrs = attrs; // 本次save的数据
      var xhr = this.sync(method, this, options);

      // 还原属性
      this.attributes = attributes;

      return xhr;
    },

    // 销毁模型,可以在集合collection中移除,当wait为true时,需响应
    destroy: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;
      var wait = options.wait;

      var destroy = function() {
        model.stopListening(); // 停止监听事件
        model.trigger('destroy', model, model.collection, options); // 触发'destory'事件,若模型存在于Collection集合中, 集合将监听destroy事件并在触发时从集合中移除该模型
      };

      // 封装请求成功函数
      options.success = function(resp) {
        if (wait) destroy(); // TODO
        if (success) success.call(options.context, model, resp, options);
        if (!model.isNew()) model.trigger('sync', model, resp, options); // 如果模型不是新建的模型, 触发sync事件
      };

      var xhr = false;
      // 若Model是一个新建的模型
      if (this.isNew()) {
          // underscore _.defer(function, *arguments) 延迟调用function直到当前调用栈清空为止，类似使用延时为0的setTimeout方法。
        _.defer(options.success);
      } else {
        wrapError(this, options);  // 封装错误函数
        xhr = this.sync('delete', this, options); // 删除事件
      }
      if (!wait) destroy(); // 调用销毁事件
      return xhr;
    },

    // 返回模型资源在服务器上位置的相对 URL
    // 生成 URLs 的默认形式为："/[collection.url]/[id]"， 如果模型不是集合的一部分，你可以通过指定明确的urlRoot覆盖
    // 在访问服务器url时会在url后面追加上模型的id, 便于服务器标识一条记录, 因此模型中的id需要与服务器记录对应
    url: function() {
        // base 定义对应的url，若无法获取Model或Collection的url, 将调用urlError方法抛出一个异常
        // underscore _.result(object, property) 如果对象 object 中的属性 property 是函数, 则调用它, 否则, 返回它。
      var base =
        _.result(this, 'urlRoot') ||
        _.result(this.collection, 'url') ||
        urlError();
      if (this.isNew()) return base; // 当是新实例时,Model没有id,直接返回base
      var id = this.get(this.idAttribute); // 获取id
      // encodeURIComponent 传入一个url,对url进行编码,遇到标点符号(;/?:@&=+$,#)时,用转义字符(%2F)等替换
      return base.replace(/[^\/]$/, '$&/') + encodeURIComponent(id);  // 返回和id的拼接
    },

    // 常为用户自定义函数*
    // 当服务器返回的数据结构与set方法所需的数据结构不一致(例如服务器返回XML格式数据时), 调用parse方法进行转换
    parse: function(resp, options) {
      return resp;
    },

    // 返回与属性集的新实例
    clone: function() {
      return new this.constructor(this.attributes);
    },

    // 判断是否是新model。如果从未保存到服务器，而且缺少ID，则模型是新的。
    isNew: function() {
      return !this.has(this.idAttribute);
    },

    // 检验当前的属性集attributes是否合法
    // 有些属性在set的时候因为options.validate为false/undefined没有进行校验,本质是不合法的
    // 这个会将options.validate设为true,强制this._validate()调用this.validate,返回boolean值
    isValid: function(options) {
      return this._validate({}, _.extend({}, options, {validate: true}));
    },


    /**
     * 数据验证方法， 在调用 set, save, add 等数据更新方法时， 被自动执行
     * 当所有都通过验证时，返回 true,否则触发'invaild'事件
     * @param {Object} attrs 属性对象 
     * @param {Object} options 验证信息
     * @returns true/false
     */
    _validate: function(attrs, options) {
      if (!options.validate || !this.validate) return true; // options.validate为Boolean值,若没有要求,表明不需要校验,也返回true
      attrs = _.extend({}, this.attributes, attrs); // 因为有可能用上 this.attributes
      var error = this.validationError = this.validate(attrs, options) || null;// 上面定义的
      if (!error) return true;
      this.trigger('invalid', this, error, _.extend(options, {validationError: error}));
      return false;
    }

  });

  // Backbone.Collection 940-1476
  // -------------------

  // collection和model的区别莫过于model像单行数据,但collection像一个充满数据的表,集合维护其Model的索引，既按顺序排列，也按 `id` 查找。


  // 创建 Collection 的实例,可能包含特殊的model,如果指定了“comparator”，集合将按照排序顺序维护其模型，当它们被添加和删除。
  // this.model  和 this.models 的区别: 后者为所有
  var Collection = Backbone.Collection = function(models, options) {
    options || (options = {});
    this.preinitialize.apply(this, arguments); 
    if (options.model) this.model = options.model; // 实例集合的model属性设为 options.model
    if (options.comparator !== void 0) this.comparator = options.comparator; // options.comparator为排序器;集合中的数据将按照comparator的排序算法进行排序(在add方法中会自动调用)
    this._reset(); // 实例化会重置Collection内部属性,同时也初始化 this.length/models/_byId
    this.initialize.apply(this, arguments); 
    if (models) this.reset(models, _.extend({silent: true}, options)); // slient默认为true,将models清空并加入参数models
  };

  // 都作为参数,用于set方法中初始化配置对象
  var setOptions = {add: true, remove: true, merge: true};
  var addOptions = {add: true, remove: false};

  /**
   * 拼接数组,将insert插入到array中,插入位置由at决定,若at为负拼接在array前,若超过array的长度,拼接在array后
   * @param {Array} array 
   * @param {Array} insert 
   * @param {Number} at 拼接位置
   */
  var splice = function(array, insert, at) {
    at = Math.min(Math.max(at, 0), array.length); // 确定at的值,不小于0
    var tail = Array(array.length - at);
    var length = insert.length;
    var i;
    for (i = 0; i < tail.length; i++) tail[i] = array[i + at]; // tail == array[at]~array[array.length-1]
    for (i = 0; i < length; i++) array[i + at] = insert[i]; // array[at]~array[at+length-1] == insert
    for (i = 0; i < tail.length; i++) array[i + length + at] = tail[i]; // array[at+length]~array[at+length+tail] == tail
  };

  _.extend(Collection.prototype, Events, {

    // 初始化指向Model,若options中有model属性,会被覆盖
    model: Model,

    // 预初始化函数*
    preinitialize: function(){},

    // 初始化函数*
    initialize: function(){},

    // 将models遍历转化为JSON数据,并输出
    toJSON: function(options) {
        // this.map 从 underscore 中继承,其中参数1默认为this.models
      return this.map(function(model) { return model.toJSON(options); });
    },

    // 同样是代理Backbone.sync
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // 向集合中增加一个模型（或一个模型数组），触发"add"事件。  
    // 若重复添加已有的模型到集合，被忽略，除非传递{merge: true}，则将该模型的属性合并到原有模型中，触发任何适当的"change" 事件。   
    add: function(models, options) {
      return this.set(models, _.extend({merge: false}, options, addOptions)); // merge和remove设为false,避免重复添加和错误移除
    },

    // 移除模型事件,触发'remove'事件
    remove: function(models, options) {
      options = _.extend({}, options);
      // underscore _.isArray(object) 若object是一个数组，返回true。
      var singular = !_.isArray(models); // ! 取相反数
      models = singular ? [models] : models.slice(); // 若为数组使用slice拷贝(浅拷贝),若不为数组则为单个模型,放入数组中
      var removed = this._removeModels(models, options); // 被移除的model,若参数models的项皆是this.models中的,removed == models
      if (!options.silent && removed.length) {
        options.changes = {added: [], merged: [], removed: removed};
        this.trigger('update', this, options); // 因为this.models变了,触发更新事件
      }
      return singular ? removed[0] : removed; // 返回和参数models同类型的数据
    },

    // add/push/pop/shift/unshift/remove
    // 所有与model相关的增删改查都是调用set, 可添加新的模型，删除不再存在的模型，合并集合中已存在的模型
    // setOptions 默认将add/merge/remove 设为true,表示本次set可添加可合并需移除旧模型,但options一般会进行覆盖
    set: function(models, options) {
      if (models == null) return;

      options = _.extend({}, setOptions, options); // 以options为准,默认为全true
      if (options.parse && !this._isModel(models)) {
        models = this.parse(models, options) || []; // 若有parse需求,调用this.parse解析
      }

      var singular = !_.isArray(models); // 是否是单个模型
      models = singular ? [models] : models.slice();

      var at = options.at; // at表示插入this.models的位置
      if (at != null) at = +at; // 转为数值
      if (at > this.length) at = this.length;
      if (at < 0) at += this.length + 1;

      // 设置临时存储集合
      var set = []; // 本轮set的model
      var toAdd = []; // 本轮添加的 model
      var toMerge = []; // 本轮合并过的model
      var toRemove = []; // 本轮被移除的model
      var modelMap = {}; // 对象,将本轮被操作过的model的cid作为属性名,属性值设为true,也可用于过滤旧模型 

      // 皆是Boolean值
      var add = options.add; 
      var merge = options.merge; 
      var remove = options.remove;

      var sort = false;
      var sortable = this.comparator && at == null && options.sort !== false; // at 表示固定插入位置,comparator表示排序依据,一般是属性名,表示根据此排序
      // underscroe _.isString(obj) 判断obj是不是字符串,若是返回true
      var sortAttr = _.isString(this.comparator) ? this.comparator : null; // 排序依据数组,一般为属性名数组,若此次操作的model有该属性,进行排序

      var model, i;
      //  models = singular ? [models] : models.slice(); 已将models转为数组
      for (i = 0; i < models.length; i++) {
        model = models[i];

        // this.get 获取参数的cid,并根据其在this._byId中查找,并返回model
        var existing = this.get(model); // existing 能够确认是 Model 实例,但 model 不确认是 Model 实例
        
        // 当model已存在时(即两对象有相同的cid)
        if (existing) {

         // 若有merge,且返回的existing和传入的model不相等时,进行合并,修改this.models中某一项
          if (merge && model !== existing) { 
            // 若 model 是 Model 实例,取出model的属性集,其余情况不确定model的结构,直接返回
            var attrs = this._isModel(model) ? model.attributes : model; 
            // 若有parse属性,使用existing(能确认是Model实例)调用parse
            if (options.parse) attrs = existing.parse(attrs, options);
            existing.set(attrs, options); // 将model中数据合并至existing中 
            toMerge.push(existing);
            if (sortable && !sort) sort = existing.hasChanged(sortAttr); // sortable表示有排序器,!sort表示没有排序依据,由此调用hasChanged,返回究竟是否有排序依据
          }

          // 若不merge,以现存的existing为准,若merge以上述操作后的existing为准
          if (!modelMap[existing.cid]) {
            modelMap[existing.cid] = true; // 记录
            set.push(existing);
          }
          models[i] = existing; // 最终以 existing 为准

          // 当是新model时,在有add属性的情况下进行添加,此时没有修改this.models,而是将新增的model添加至toAdd数组中
        } else if (add) {
          model = models[i] = this._prepareModel(model, options); // 不是模型则试图将其转为模型,失败返回false,是模型则返回
          if (model) {
            toAdd.push(model);
            this._addReference(model, options); // 在this._byId中添加model
            modelMap[model.cid] = true; // 记录
            set.push(model);
          }
        }
      }

      // remove 为true时,移除this.models中的旧模型,此时是第一次操作this.models
      if (remove) {
        for (i = 0; i < this.length; i++) {
          model = this.models[i];
          if (!modelMap[model.cid]) toRemove.push(model); // 过滤旧模型
        }
        if (toRemove.length) this._removeModels(toRemove, options); // 内部方法,遍历toRemove将模型项清除
      }

      var orderChanged = false; // 排序修改
      var replace = !sortable && add && remove; // 在addOptions中remove:false
      if (set.length && replace) { // ???
        // underscore _.some(list, [predicate], [context]) 使用list中的项遍历predicate,若有调用返回true,则整体为true,且退出.
        orderChanged = this.length !== set.length || _.some(this.models, function(m, index) {
          return m !== set[index]; // 判断顺序是否已经发生变化
        });
        this.models.length = 0;
        splice(this.models, set, 0); // 将set拼接在this.models后
        this.length = this.models.length;
      } else if (toAdd.length) {
        if (sortable) sort = true;
        splice(this.models, toAdd, at == null ? this.length : at); // 将新增的model数组插入原有的this.models中
        this.length = this.models.length;
      }

      // 当有排序指标时,进行排序
      if (sort) this.sort({silent: true});

      // Unless silenced, it's time to fire all appropriate add/sort/update events.
      if (!options.silent) {
        for (i = 0; i < toAdd.length; i++) {
          if (at != null) options.index = at + i;
          model = toAdd[i];
          model.trigger('add', model, this, options);
        }
        if (sort || orderChanged) this.trigger('sort', this, options);
        if (toAdd.length || toRemove.length || toMerge.length) {
          options.changes = {
            added: toAdd,
            removed: toRemove,
            merged: toMerge
          };
          this.trigger('update', this, options);
        }
      }

      // Return the added (or merged) model (or models).
      return singular ? models[0] : models;
    },

    // models为传入的模型数组,重置集合的模型,如果不传递任何模型作为参数，将清空整个集合的模型,options为配置选项。
    // 调用栈:this.reset -> this._removeReference(清除_byId) -> this.modelId(找到idAttributes) -> this._reset(清除this.models) -> this.add(添加model数组) -> this.set(设置添加) -> ....
    reset: function(models, options) {
      options = options ? _.clone(options) : {}; // 避免污染options

      // 切断this.models和collection的联系,初始化时为[],但其余情况可能有值
      for (var i = 0; i < this.models.length; i++) {
        this._removeReference(this.models[i], options); // 循环切断this.models中所有model和collection的联系
      }

      options.previousModels = this.models; // 清空this.models前先保存
      this._reset(); // 清空状态,主要是清空this.models
      models = this.add(models, _.extend({silent: true}, options)); // 使用set.将models加入this.models
      // slient默认为 true,表示不触发'reset'事件,当options设置了false时才触发reset事件
      if (!options.silent) this.trigger('reset', this, options);
      return models;
    },

    // this.models的末尾插入model
    push: function(model, options) {
      return this.add(model, _.extend({at: this.length}, options));
    },

    // 移除models的最后一项
    pop: function(options) {
      var model = this.at(this.length - 1); // this.at(index) 获取models[index],此处表示最后一项
      return this.remove(model, options); // this.remove(model,options) 进行移除
    },

    // this.models的头部添加model
    unshift: function(model, options) {
      return this.add(model, _.extend({at: 0}, options));
    },

    // 移除models的第一项
    shift: function(options) {
      var model = this.at(0);
      return this.remove(model, options);
    },

    // 将参数变为数组
    slice: function() {
      return slice.apply(this.models, arguments); // Array.prototype.slice.apply()
    },

    // 传入一个model/model.attributes
    // 通过 id/cid、具有 id/cid 属性的model或 modelId 转换而来的id,从 this._byId 中获取模型
    get: function(obj) {
      if (obj == null) return void 0;
      return this._byId[obj] ||
        this._byId[this.modelId(this._isModel(obj) ? obj.attributes : obj, obj.idAttribute)] ||
        obj.cid && this._byId[obj.cid];
    },

    // 当collection中有obj时,返回true
    has: function(obj) {
      return this.get(obj) != null;
    },

    // 当index为负时,加长度,返回该索引的model
    at: function(index) {
      if (index < 0) index += this.length;
      return this.models[index];
    },

    // 调用 find 和 filter 方法,皆是从 underscroe中继承的
    where: function(attrs, first) {
      return this[first ? 'find' : 'filter'](attrs);
    },

    // 调用 this.where 且参数2传true,实际上调用 this.find
    findWhere: function(attrs) {
      return this.where(attrs, true);
    },


    // 当add事件时,一般会自主触发sort事件,可以传递{sort: false}给add。 调用sort会触发的集合的"sort"事件。
    sort: function(options) {
      var comparator = this.comparator; // 排序器,为一个数组,不存在时抛出错误
      if (!comparator) throw new Error('Cannot sort a set without a comparator');
      options || (options = {});

      var length = comparator.length;
      if (_.isFunction(comparator)) comparator = comparator.bind(this); // 一般不是函数,但是也有可能

      // 当排序器是字符串时
      if (length === 1 || _.isString(comparator)) {
        this.models = this.sortBy(comparator); // undersocre 参数一为this.models,若排序器为单个属性值:'name',直接调用传入
      } else { // 当排序器是函数时
        this.models.sort(comparator); // Array.sort(function)
      }
      if (!options.silent) this.trigger('sort', this, options);
      return this;
    },

    // Pluck an attribute from each model in the collection.
    pluck: function(attr) {
      return this.map(attr + '');
    },

    // Fetch the default set of models for this collection, resetting the
    // collection when they arrive. If `reset: true` is passed, the response
    // data will be passed through the `reset` method instead of `set`.
    fetch: function(options) {
      options = _.extend({parse: true}, options);
      var success = options.success;
      var collection = this;
      options.success = function(resp) {
        var method = options.reset ? 'reset' : 'set';
        collection[method](resp, options);
        if (success) success.call(options.context, collection, resp, options);
        collection.trigger('sync', collection, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Create a new instance of a model in this collection. Add the model to the
    // collection immediately, unless `wait: true` is passed, in which case we
    // wait for the server to agree.
    create: function(model, options) {
      options = options ? _.clone(options) : {};
      var wait = options.wait;
      model = this._prepareModel(model, options);
      if (!model) return false;
      if (!wait) this.add(model, options);
      var collection = this;
      var success = options.success;
      options.success = function(m, resp, callbackOpts) {
        if (wait) collection.add(m, callbackOpts);
        if (success) success.call(callbackOpts.context, m, resp, callbackOpts);
      };
      model.save(null, options);
      return model;
    },

    // 可自定义函数,将Collection数据格式化
    parse: function(resp, options) {
      return resp;
    },

    // Create a new collection with an identical list of models as this one.
    clone: function() {
      return new this.constructor(this.models, {
        model: this.model,
        comparator: this.comparator
      });
    },

    // 返回model的idAttribute,或options.model中的idAttribute
    modelId: function(attrs, idAttribute) {
      return attrs[idAttribute || this.model.prototype.idAttribute || 'id'];
    },

    // Get an iterator of all models in this collection.
    values: function() {
      return new CollectionIterator(this, ITERATOR_VALUES);
    },

    // Get an iterator of all model IDs in this collection.
    keys: function() {
      return new CollectionIterator(this, ITERATOR_KEYS);
    },

    // Get an iterator of all [ID, model] tuples in this collection.
    entries: function() {
      return new CollectionIterator(this, ITERATOR_KEYSVALUES);
    },

    // 内部方法,用于重置所有内部状态,在首次初始化或重置集合时调用
    _reset: function() {
      this.length = 0; // 删除集合元素
      this.models = []; // 重置当前集合中的model
      this._byId  = {}; // 重置集合状态
    },


    // 若是模型直接返回,否则将数据实例化为一个模型对象, 和将集合引用到模型的collection属性
    // return model实例 false
    _prepareModel: function(attrs, options) {
        // 若 attrs 是模型,且没有建立模型与collection 的联系, 将其collection设为this
      if (this._isModel(attrs)) {
        if (!attrs.collection) attrs.collection = this;
        return attrs;
      }

      // 若attrs不是模型,当成model.attributes,将其变成模型
      options = options ? _.clone(options) : {};
      options.collection = this;

      var model;
      // 根据是否有原型属性决定是new实例还是调用
      if (this.model.prototype) {
        model = new this.model(attrs, options); 
      } else {
        model = this.model(attrs, options);
      }

      if (!model.validationError) return model; // 验证成功,将模型返回,否则触发'invalid'事件且返回false
      this.trigger('invalid', this, model.validationError, options);
      return false;
    },

    // 内部方法,被remove和set方法调用
    _removeModels: function(models, options) {
      var removed = [];
      for (var i = 0; i < models.length; i++) {
        var model = this.get(models[i]); // 获取模型
        if (!model) continue;

        var index = this.indexOf(model); // 返回该模型在所有模型中的索引,若没有则返回-1
        this.models.splice(index, 1); // 从this.models中去除该模型
        this.length--;

        // 移除this._byId对模型cid的引用
        delete this._byId[model.cid];
        var id = this.modelId(model.attributes, model.idAttribute); // 获取模型的id
        if (id != null) delete this._byId[id]; // 移除this._byId对模型id的引用

        if (!options.silent) {// 如果没有设置silent属性, 则触发模型的remove事件
          options.index = index;
          model.trigger('remove', model, this, options);
        }

        removed.push(model);
        this._removeReference(model, options); // 前面移除了this.byId的引用,调用此方法再移除一遍,还包括模型对集合的引用和事件监听
      }
      return removed;
    },


    // 内部方法:传入一个模型.使用instanceof 判断是否是 Model的实例
    _isModel: function(model) {
      return model instanceof Model;
    },

    // 内部方法,建立this._byId和model的关系
    _addReference: function(model, options) {
      this._byId[model.cid] = model;  // _byId[cid] 保存 model
      var id = this.modelId(model.attributes, model.idAttribute);
      if (id != null) this._byId[id] = model; // _byId[id] 保存 model
      model.on('all', this._onModelEvent, this); // 触发'all'事件
    },

    // 私有方法,切断 model 和collection的联系
    _removeReference: function(model, options) {
      delete this._byId[model.cid]; // _byId列表中移除model的cid引用
      var id = this.modelId(model.attributes, model.idAttribute); // this.modelId 获取模型id
      if (id != null) delete this._byId[id]; // 移除模型id
      if (this === model.collection) delete model.collection; // 如果模型引用了当前集合, 则移除该引用(必须确保所有对模型的引用已经解除, 否则模型可能无法从内存中释放)
      model.off('all', this._onModelEvent, this); // 取消集合中监听的所有模型事件
    },

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    // 
    _onModelEvent: function(event, model, collection, options) {
      if (model) {
        if ((event === 'add' || event === 'remove') && collection !== this) return;
        if (event === 'destroy') this.remove(model, options);
        if (event === 'changeId') {
          var prevId = this.modelId(model.previousAttributes(), model.idAttribute);
          var id = this.modelId(model.attributes, model.idAttribute);
          if (prevId != null) delete this._byId[prevId];
          if (id != null) this._byId[id] = model;
        }
      }
      this.trigger.apply(this, arguments);
    }

  });

  // Defining an @@iterator method implements JavaScript's Iterable protocol.
  // In modern ES2015 browsers, this value is found at Symbol.iterator.
  /* global Symbol */
  var $$iterator = typeof Symbol === 'function' && Symbol.iterator;
  if ($$iterator) {
    Collection.prototype[$$iterator] = Collection.prototype.values;
  }

  // CollectionIterator
  // ------------------

  // A CollectionIterator implements JavaScript's Iterator protocol, allowing the
  // use of `for of` loops in modern browsers and interoperation between
  // Backbone.Collection and other JavaScript functions and third-party libraries
  // which can operate on Iterables.
  var CollectionIterator = function(collection, kind) {
    this._collection = collection;
    this._kind = kind;
    this._index = 0;
  };

  // This "enum" defines the three possible kinds of values which can be emitted
  // by a CollectionIterator that correspond to the values(), keys() and entries()
  // methods on Collection, respectively.
  var ITERATOR_VALUES = 1;
  var ITERATOR_KEYS = 2;
  var ITERATOR_KEYSVALUES = 3;

  // All Iterators should themselves be Iterable.
  if ($$iterator) {
    CollectionIterator.prototype[$$iterator] = function() {
      return this;
    };
  }

  CollectionIterator.prototype.next = function() {
    if (this._collection) {

      // Only continue iterating if the iterated collection is long enough.
      if (this._index < this._collection.length) {
        var model = this._collection.at(this._index);
        this._index++;

        // Construct a value depending on what kind of values should be iterated.
        var value;
        if (this._kind === ITERATOR_VALUES) {
          value = model;
        } else {
          var id = this._collection.modelId(model.attributes);
          if (this._kind === ITERATOR_KEYS) {
            value = id;
          } else { // ITERATOR_KEYSVALUES
            value = [id, model];
          }
        }
        return {value: value, done: false};
      }

      // Once exhausted, remove the reference to the collection so future
      // calls to the next method always return done.
      this._collection = void 0;
    }

    return {value: void 0, done: true};
  };

  // Backbone.View
  // -------------

  // Backbone Views are almost more convention than they are actual code. A View
  // is simply a JavaScript object that represents a logical chunk of UI in the
  // DOM. This might be a single item, an entire list, a sidebar or panel, or
  // even the surrounding frame which wraps your whole app. Defining a chunk of
  // UI as a **View** allows you to define your DOM events declaratively, without
  // having to worry about render order ... and makes it easy for the view to
  // react to specific changes in the state of your models.

  // Creating a Backbone.View creates its initial element outside of the DOM,
  // if an existing element is not provided...
  var View = Backbone.View = function(options) {
    this.cid = _.uniqueId('view');
    this.preinitialize.apply(this, arguments);
    _.extend(this, _.pick(options, viewOptions));
    this._ensureElement();
    this.initialize.apply(this, arguments);
  };

  // Cached regex to split keys for `delegate`.
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  // List of view options to be set as properties.
  var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

  // Set up all inheritable **Backbone.View** properties and methods.
  _.extend(View.prototype, Events, {

    // The default `tagName` of a View's element is `"div"`.
    tagName: 'div',

    // jQuery delegate for element lookup, scoped to DOM elements within the
    // current view. This should be preferred to global lookups where possible.
    $: function(selector) {
      return this.$el.find(selector);
    },

    // preinitialize is an empty function by default. You can override it with a function
    // or object.  preinitialize will run before any instantiation logic is run in the View
    preinitialize: function(){},

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // **render** is the core function that your view should override, in order
    // to populate its element (`this.el`), with the appropriate HTML. The
    // convention is for **render** to always return `this`.
    render: function() {
      return this;
    },

    // Remove this view by taking the element out of the DOM, and removing any
    // applicable Backbone.Events listeners.
    remove: function() {
      this._removeElement();
      this.stopListening();
      return this;
    },

    // Remove this view's element from the document and all event listeners
    // attached to it. Exposed for subclasses using an alternative DOM
    // manipulation API.
    _removeElement: function() {
      this.$el.remove();
    },

    // Change the view's element (`this.el` property) and re-delegate the
    // view's events on the new element.
    setElement: function(element) {
      this.undelegateEvents();
      this._setElement(element);
      this.delegateEvents();
      return this;
    },

    // Creates the `this.el` and `this.$el` references for this view using the
    // given `el`. `el` can be a CSS selector or an HTML string, a jQuery
    // context or an element. Subclasses can override this to utilize an
    // alternative DOM manipulation API and are only required to set the
    // `this.el` property.
    _setElement: function(el) {
      this.$el = el instanceof Backbone.$ ? el : Backbone.$(el);
      this.el = this.$el[0];
    },

    // Set callbacks, where `this.events` is a hash of
    //
    // *{"event selector": "callback"}*
    //
    //     {
    //       'mousedown .title':  'edit',
    //       'click .button':     'save',
    //       'click .open':       function(e) { ... }
    //     }
    //
    // pairs. Callbacks will be bound to the view, with `this` set properly.
    // Uses event delegation for efficiency.
    // Omitting the selector binds the event to `this.el`.
    delegateEvents: function(events) {
      events || (events = _.result(this, 'events'));
      if (!events) return this;
      this.undelegateEvents();
      for (var key in events) {
        var method = events[key];
        if (!_.isFunction(method)) method = this[method];
        if (!method) continue;
        var match = key.match(delegateEventSplitter);
        this.delegate(match[1], match[2], method.bind(this));
      }
      return this;
    },

    // Add a single event listener to the view's element (or a child element
    // using `selector`). This only works for delegate-able events: not `focus`,
    // `blur`, and not `change`, `submit`, and `reset` in Internet Explorer.
    delegate: function(eventName, selector, listener) {
      this.$el.on(eventName + '.delegateEvents' + this.cid, selector, listener);
      return this;
    },

    // Clears all callbacks previously bound to the view by `delegateEvents`.
    // You usually don't need to use this, but may wish to if you have multiple
    // Backbone views attached to the same DOM element.
    undelegateEvents: function() {
      if (this.$el) this.$el.off('.delegateEvents' + this.cid);
      return this;
    },

    // A finer-grained `undelegateEvents` for removing a single delegated event.
    // `selector` and `listener` are both optional.
    undelegate: function(eventName, selector, listener) {
      this.$el.off(eventName + '.delegateEvents' + this.cid, selector, listener);
      return this;
    },

    // Produces a DOM element to be assigned to your view. Exposed for
    // subclasses using an alternative DOM manipulation API.
    _createElement: function(tagName) {
      return document.createElement(tagName);
    },

    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties.
    _ensureElement: function() {
      if (!this.el) {
        var attrs = _.extend({}, _.result(this, 'attributes'));
        if (this.id) attrs.id = _.result(this, 'id');
        if (this.className) attrs['class'] = _.result(this, 'className');
        this.setElement(this._createElement(_.result(this, 'tagName')));
        this._setAttributes(attrs);
      } else {
        this.setElement(_.result(this, 'el'));
      }
    },

    // Set attributes from a hash on this view's element.  Exposed for
    // subclasses using an alternative DOM manipulation API.
    _setAttributes: function(attributes) {
      this.$el.attr(attributes);
    }

  });


  /*************************** Collection和Model的公共函数(1647-1827) 包括 Backbone.sync 和 underscore ****************************************/
  
  /*
   * 包装underscore的方法,将this.models 和this.attributes,作为迭代的参数1,
   * @param {*} base 
   * @param {*} length 
   * @param {*} method 
   * @param {*} attribute 
   * @returns 
   */
  var addMethod = function(base, length, method, attribute) {
    switch (length) {
      case 1: return function() {
        return base[method](this[attribute]);
      };
      case 2: return function(value) {
        return base[method](this[attribute], value);
      };
      case 3: return function(iteratee, context) {
        return base[method](this[attribute], cb(iteratee, this), context);
      };
      case 4: return function(iteratee, defaultVal, context) {
        return base[method](this[attribute], cb(iteratee, this), defaultVal, context);
      };
      default: return function() {
        var args = slice.call(arguments);
        args.unshift(this[attribute]);
        return base[method].apply(base, args);
      };
    }
  };

  var addUnderscoreMethods = function(Class, base, methods, attribute) {
    _.each(methods, function(length, method) {
      if (base[method]) Class.prototype[method] = addMethod(base, length, method, attribute);
    });
  };

  // Support `collection.sortBy('attr')` and `collection.findWhere({id: 1})`.
  var cb = function(iteratee, instance) {
    if (_.isFunction(iteratee)) return iteratee;
    if (_.isObject(iteratee) && !instance._isModel(iteratee)) return modelMatcher(iteratee);
    if (_.isString(iteratee)) return function(model) { return model.get(iteratee); };
    return iteratee;
  };

  // 返回一个断言函数
  var modelMatcher = function(attrs) {
    // underscore _.matches(attrs) 参数attrs为一个对象,此方法返回断言函数 matcher,内有参数compare为对象,判断compare对象是否匹配attrs,即attrs的属性值compare都要有,返回一个boolen值
    var matcher = _.matches(attrs);
    return function(model) {
      return matcher(model.attributes);
    };
  };


  // 因为this.models是数组,常常需要迭代遍历,故在Collection中代理 Underscore 中的迭代方法
  // 将Underscore中的方法包装为collection的同名方法,但是参数1始终为this.models,即本来underscore需传三个参数,到collection中就剩后两个参数
  var collectionMethods = {forEach: 3, each: 3, map: 3, collect: 3, reduce: 0,
    foldl: 0, inject: 0, reduceRight: 0, foldr: 0, find: 3, detect: 3, filter: 3,
    select: 3, reject: 3, every: 3, all: 3, some: 3, any: 3, include: 3, includes: 3,
    contains: 3, invoke: 0, max: 3, min: 3, toArray: 1, size: 1, first: 3,
    head: 3, take: 3, initial: 3, rest: 3, tail: 3, drop: 3, last: 3,
    without: 0, difference: 0, indexOf: 3, shuffle: 1, lastIndexOf: 3,
    isEmpty: 1, chain: 1, sample: 3, partition: 3, groupBy: 3, countBy: 3,
    sortBy: 3, indexBy: 3, findIndex: 3, findLastIndex: 3};

    // 将Underscore中的方法包装为Model的同名方法,但是参数1始终为this.attributes,
  var modelMethods = {keys: 1, values: 1, pairs: 1, invert: 1, pick: 0,
    omit: 0, chain: 1, isEmpty: 1};

  // underscore _.each(list, iteratee, [context]) iteratee函数遍历调用list项，context作为上下文。
  _.each([
    [Collection, collectionMethods, 'models'],
    [Model, modelMethods, 'attributes']
  ], function(config) {
    var Base = config[0],
        methods = config[1],
        attribute = config[2];
        
    // mixin方法可以在Model和    
    Base.mixin = function(obj) {
      // underscore _.reduce(list, iteratee, [memo], [context]) 类似于归并,iteratee遍历调用list项,参数1为上次调用的返回值,memo作为首次调用的参数1,若无memo则为0,参数2为list[调用次数]，context为上下文。  
      // undertscore _.functions(obj) 遍历obj的属性,若属性值为函数,将属性名保存在数组中,最终返回该数组
      var mappings = _.reduce(_.functions(obj), function(memo, name) { // mappings 形如 {show:0,name:0}
        memo[name] = 0; 
        return memo; 
      }, {});
      addUnderscoreMethods(Base, obj, mappings, attribute);
    };

    addUnderscoreMethods(Base, _, methods, attribute);
  });

  // Backbone.sync
  // -------------
  
  /**
   * Model和Collection的sync使用此函数,
   * 你需要传递 request 的类型以及有问题的 model。默认情况下，一个 RESTful Ajax 请求会调用 model 的 url() 方法。一些可能的使用场景：
   * 1、使用 setTimeout 将快速更新 批量导入到单个请求中。
   * 2、发送 XML 形式的 model
   * 3、通过WebSockets而不是Ajax来持久化模型。
   * @param {String} method 某增删改查方法名("create", "read", "update", "delete")
   * @param {function} model 要被保存的模型或要被读取的集合 Model/Collection/View
   * @param {Object} options 请求配置对象,为$.ajax请求的相关配置,故调用此法的options也会改变
   * @returns xhr 一个请求
   */
  Backbone.sync = function(method, model, options) {
    var type = methodMap[method]; // methodMap枚举了所有的增删改查的方法名 method:ajax-method

    // 兼容全局设置
    _.defaults(options || (options = {}), {
      emulateHTTP: Backbone.emulateHTTP,
      emulateJSON: Backbone.emulateJSON
    });

    // 额外的请求配置,最终和options合并
    var params = {type: type, dataType: 'json'};

    // 确保有配url,没有配则抛出一个错误
    if (!options.url) {
        // underscore _.result(object, property,defaultValue) 判断对象 object 中 property 属性是否是函数, 是则调用它, 否则返回它,或未定义时使用defaultValue定义
      params.url = _.result(model, 'url') || urlError();
    }

    // 确保请求数据是合适的
    // 若调用create/update/patch方法, 且没有在options中定义请求数据, 直接序列化传递给服务器
    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
      params.contentType = 'application/json';
      params.data = JSON.stringify(options.attrs || model.toJSON(options)); // $.ajax 中没有 attrs
    }

    // 当options.emulateJSON为true时,表示为旧服务器,需设置contentType和data的格式
    if (options.emulateJSON) {
      params.contentType = 'application/x-www-form-urlencoded';
      params.data = params.data ? {model: params.data} : {}; // html格式
    }

    // 若为旧服务器,且请求类型为 put/delete/patch,旧服务器无法实现,需使用post来伪装实现请求
    if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
      params.type = 'POST'; // 统一修改type为post
      if (options.emulateJSON) params.data._method = type; // 若不支持json格式
      var beforeSend = options.beforeSend; // $.ajax 发送前触发的函数,自定义,参数为xhr请求
      options.beforeSend = function(xhr) {
        xhr.setRequestHeader('X-HTTP-Method-Override', type); // 在自定义的函数中多加一段设置请求头的,再使用apply执行原有的beforeSend函数
        if (beforeSend) return beforeSend.apply(this, arguments);
      };
    }

    // 对于非 get 且非非json 数据的请求
    if (params.type !== 'GET' && !options.emulateJSON) {
      params.processData = false; // $.ajax 修改data格式,默认为true,会将对象转变为字符串,设为false则不改变
    }

    var error = options.error; // $.ajax 请求失败时的函数,有三个参数:xhr请求 错误信息(String) 捕获的错误对象
    options.error = function(xhr, textStatus, errorThrown) {
      options.textStatus = textStatus; // 将错误信息和捕获的错误对象保存在options中,再使用call执行原有的error函数
      options.errorThrown = errorThrown;
      if (error) error.call(options.context, xhr, textStatus, errorThrown);
    };

    var xhr = options.xhr = Backbone.ajax(_.extend(params, options)); // _.extend() 将params和options合并,并将params传入Backbone.ajax(),调用JQ的ajax,返回一个对象
    model.trigger('request', model, xhr, options); // 触发名为'request'的事件
    return xhr; // 返回xhr请求对象
  };

  // 从CRUD映射到HTTP，用于默认的`Backbone.sync` 的实现。
  var methodMap = {
    create: 'POST',
    update: 'PUT',
    patch: 'PATCH',
    delete: 'DELETE',
    read: 'GET'
  };

  // 本质就是JQuery中的$.ajax,将其封装成一个函数
  Backbone.ajax = function() {
    return Backbone.$.ajax.apply(Backbone.$, arguments); // Backbone.ajax = Backbone.$.ajax 执行$.ajax并返回执行结果xhr
  };

  // Backbone.Router
  // ---------------

  // Routers map faux-URLs to actions, and fire events when routes are
  // matched. Creating a new one sets its `routes` hash, if not set statically.
  var Router = Backbone.Router = function(options) {
    options || (options = {});
    this.preinitialize.apply(this, arguments);
    if (options.routes) this.routes = options.routes;
    this._bindRoutes();
    this.initialize.apply(this, arguments);
  };

  // Cached regular expressions for matching named param parts and splatted
  // parts of route strings.
  var optionalParam = /\((.*?)\)/g;
  var namedParam    = /(\(\?)?:\w+/g;
  var splatParam    = /\*\w+/g;
  var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

  // Set up all inheritable **Backbone.Router** properties and methods.
  _.extend(Router.prototype, Events, {

    // preinitialize is an empty function by default. You can override it with a function
    // or object.  preinitialize will run before any instantiation logic is run in the Router.
    preinitialize: function(){},

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Manually bind a single named route to a callback. For example:
    //
    //     this.route('search/:query/p:num', 'search', function(query, num) {
    //       ...
    //     });
    //
    route: function(route, name, callback) {
      if (!_.isRegExp(route)) route = this._routeToRegExp(route);
      if (_.isFunction(name)) {
        callback = name;
        name = '';
      }
      if (!callback) callback = this[name];
      var router = this;
      Backbone.history.route(route, function(fragment) {
        var args = router._extractParameters(route, fragment);
        if (router.execute(callback, args, name) !== false) {
          router.trigger.apply(router, ['route:' + name].concat(args));
          router.trigger('route', name, args);
          Backbone.history.trigger('route', router, name, args);
        }
      });
      return this;
    },

    // Execute a route handler with the provided parameters.  This is an
    // excellent place to do pre-route setup or post-route cleanup.
    execute: function(callback, args, name) {
      if (callback) callback.apply(this, args);
    },

    // Simple proxy to `Backbone.history` to save a fragment into the history.
    navigate: function(fragment, options) {
      Backbone.history.navigate(fragment, options);
      return this;
    },

    // Bind all defined routes to `Backbone.history`. We have to reverse the
    // order of the routes here to support behavior where the most general
    // routes can be defined at the bottom of the route map.
    _bindRoutes: function() {
      if (!this.routes) return;
      this.routes = _.result(this, 'routes');
      var route, routes = _.keys(this.routes);
      while ((route = routes.pop()) != null) {
        this.route(route, this.routes[route]);
      }
    },

    // Convert a route string into a regular expression, suitable for matching
    // against the current location hash.
    _routeToRegExp: function(route) {
      route = route.replace(escapeRegExp, '\\$&')
        .replace(optionalParam, '(?:$1)?')
        .replace(namedParam, function(match, optional) {
          return optional ? match : '([^/?]+)';
        })
        .replace(splatParam, '([^?]*?)');
      return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
    },

    // Given a route, and a URL fragment that it matches, return the array of
    // extracted decoded parameters. Empty or unmatched parameters will be
    // treated as `null` to normalize cross-browser behavior.
    _extractParameters: function(route, fragment) {
      var params = route.exec(fragment).slice(1);
      return _.map(params, function(param, i) {
        // Don't decode the search params.
        if (i === params.length - 1) return param || null;
        return param ? decodeURIComponent(param) : null;
      });
    }

  });

  // Backbone.History
  // ----------------

  // Handles cross-browser history management, based on either
  // [pushState](http://diveintohtml5.info/history.html) and real URLs, or
  // [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
  // and URL fragments. If the browser supports neither (old IE, natch),
  // falls back to polling.
  var History = Backbone.History = function() {
    this.handlers = [];
    this.checkUrl = this.checkUrl.bind(this);

    // Ensure that `History` can be used outside of the browser.
    if (typeof window !== 'undefined') {
      this.location = window.location;
      this.history = window.history;
    }
  };

  // Cached regex for stripping a leading hash/slash and trailing space.
  var routeStripper = /^[#\/]|\s+$/g;

  // Cached regex for stripping leading and trailing slashes.
  var rootStripper = /^\/+|\/+$/g;

  // Cached regex for stripping urls of hash.
  var pathStripper = /#.*$/;

  // Has the history handling already been started?
  History.started = false;

  // Set up all inheritable **Backbone.History** properties and methods.
  _.extend(History.prototype, Events, {

    // The default interval to poll for hash changes, if necessary, is
    // twenty times a second.
    interval: 50,

    // Are we at the app root?
    atRoot: function() {
      var path = this.location.pathname.replace(/[^\/]$/, '$&/');
      return path === this.root && !this.getSearch();
    },

    // Does the pathname match the root?
    matchRoot: function() {
      var path = this.decodeFragment(this.location.pathname);
      var rootPath = path.slice(0, this.root.length - 1) + '/';
      return rootPath === this.root;
    },

    // Unicode characters in `location.pathname` are percent encoded so they're
    // decoded for comparison. `%25` should not be decoded since it may be part
    // of an encoded parameter.
    decodeFragment: function(fragment) {
      return decodeURI(fragment.replace(/%25/g, '%2525'));
    },

    // In IE6, the hash fragment and search params are incorrect if the
    // fragment contains `?`.
    getSearch: function() {
      var match = this.location.href.replace(/#.*/, '').match(/\?.+/);
      return match ? match[0] : '';
    },

    // Gets the true hash value. Cannot use location.hash directly due to bug
    // in Firefox where location.hash will always be decoded.
    getHash: function(window) {
      var match = (window || this).location.href.match(/#(.*)$/);
      return match ? match[1] : '';
    },

    // Get the pathname and search params, without the root.
    getPath: function() {
      var path = this.decodeFragment(
        this.location.pathname + this.getSearch()
      ).slice(this.root.length - 1);
      return path.charAt(0) === '/' ? path.slice(1) : path;
    },

    // Get the cross-browser normalized URL fragment from the path or hash.
    getFragment: function(fragment) {
      if (fragment == null) {
        if (this._usePushState || !this._wantsHashChange) {
          fragment = this.getPath();
        } else {
          fragment = this.getHash();
        }
      }
      return fragment.replace(routeStripper, '');
    },

    // Start the hash change handling, returning `true` if the current URL matches
    // an existing route, and `false` otherwise.
    start: function(options) {
      if (History.started) throw new Error('Backbone.history has already been started');
      History.started = true;

      // Figure out the initial configuration. Do we need an iframe?
      // Is pushState desired ... is it available?
      this.options          = _.extend({root: '/'}, this.options, options);
      this.root             = this.options.root;
      this._wantsHashChange = this.options.hashChange !== false;
      this._hasHashChange   = 'onhashchange' in window && (document.documentMode === void 0 || document.documentMode > 7);
      this._useHashChange   = this._wantsHashChange && this._hasHashChange;
      this._wantsPushState  = !!this.options.pushState;
      this._hasPushState    = !!(this.history && this.history.pushState);
      this._usePushState    = this._wantsPushState && this._hasPushState;
      this.fragment         = this.getFragment();

      // Normalize root to always include a leading and trailing slash.
      this.root = ('/' + this.root + '/').replace(rootStripper, '/');

      // Transition from hashChange to pushState or vice versa if both are
      // requested.
      if (this._wantsHashChange && this._wantsPushState) {

        // If we've started off with a route from a `pushState`-enabled
        // browser, but we're currently in a browser that doesn't support it...
        if (!this._hasPushState && !this.atRoot()) {
          var rootPath = this.root.slice(0, -1) || '/';
          this.location.replace(rootPath + '#' + this.getPath());
          // Return immediately as browser will do redirect to new url
          return true;

        // Or if we've started out with a hash-based route, but we're currently
        // in a browser where it could be `pushState`-based instead...
        } else if (this._hasPushState && this.atRoot()) {
          this.navigate(this.getHash(), {replace: true});
        }

      }

      // Proxy an iframe to handle location events if the browser doesn't
      // support the `hashchange` event, HTML5 history, or the user wants
      // `hashChange` but not `pushState`.
      if (!this._hasHashChange && this._wantsHashChange && !this._usePushState) {
        this.iframe = document.createElement('iframe');
        this.iframe.src = 'javascript:0';
        this.iframe.style.display = 'none';
        this.iframe.tabIndex = -1;
        var body = document.body;
        // Using `appendChild` will throw on IE < 9 if the document is not ready.
        var iWindow = body.insertBefore(this.iframe, body.firstChild).contentWindow;
        iWindow.document.open();
        iWindow.document.close();
        iWindow.location.hash = '#' + this.fragment;
      }

      // Add a cross-platform `addEventListener` shim for older browsers.
      var addEventListener = window.addEventListener || function(eventName, listener) {
        return attachEvent('on' + eventName, listener);
      };

      // Depending on whether we're using pushState or hashes, and whether
      // 'onhashchange' is supported, determine how we check the URL state.
      if (this._usePushState) {
        addEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        addEventListener('hashchange', this.checkUrl, false);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
      }

      if (!this.options.silent) return this.loadUrl();
    },

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
    stop: function() {
      // Add a cross-platform `removeEventListener` shim for older browsers.
      var removeEventListener = window.removeEventListener || function(eventName, listener) {
        return detachEvent('on' + eventName, listener);
      };

      // Remove window listeners.
      if (this._usePushState) {
        removeEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        removeEventListener('hashchange', this.checkUrl, false);
      }

      // Clean up the iframe if necessary.
      if (this.iframe) {
        document.body.removeChild(this.iframe);
        this.iframe = null;
      }

      // Some environments will throw when clearing an undefined interval.
      if (this._checkUrlInterval) clearInterval(this._checkUrlInterval);
      History.started = false;
    },

    // Add a route to be tested when the fragment changes. Routes added later
    // may override previous routes.
    route: function(route, callback) {
      this.handlers.unshift({route: route, callback: callback});
    },

    // Checks the current URL to see if it has changed, and if it has,
    // calls `loadUrl`, normalizing across the hidden iframe.
    checkUrl: function(e) {
      var current = this.getFragment();

      // If the user pressed the back button, the iframe's hash will have
      // changed and we should use that for comparison.
      if (current === this.fragment && this.iframe) {
        current = this.getHash(this.iframe.contentWindow);
      }

      if (current === this.fragment) return false;
      if (this.iframe) this.navigate(current);
      this.loadUrl();
    },

    // Attempt to load the current URL fragment. If a route succeeds with a
    // match, returns `true`. If no defined routes matches the fragment,
    // returns `false`.
    loadUrl: function(fragment) {
      // If the root doesn't match, no routes can match either.
      if (!this.matchRoot()) return false;
      fragment = this.fragment = this.getFragment(fragment);
      return _.some(this.handlers, function(handler) {
        if (handler.route.test(fragment)) {
          handler.callback(fragment);
          return true;
        }
      });
    },

    // Save a fragment into the hash history, or replace the URL state if the
    // 'replace' option is passed. You are responsible for properly URL-encoding
    // the fragment in advance.
    //
    // The options object can contain `trigger: true` if you wish to have the
    // route callback be fired (not usually desirable), or `replace: true`, if
    // you wish to modify the current URL without adding an entry to the history.
    navigate: function(fragment, options) {
      if (!History.started) return false;
      if (!options || options === true) options = {trigger: !!options};

      // Normalize the fragment.
      fragment = this.getFragment(fragment || '');

      // Don't include a trailing slash on the root.
      var rootPath = this.root;
      if (fragment === '' || fragment.charAt(0) === '?') {
        rootPath = rootPath.slice(0, -1) || '/';
      }
      var url = rootPath + fragment;

      // Strip the fragment of the query and hash for matching.
      fragment = fragment.replace(pathStripper, '');

      // Decode for matching.
      var decodedFragment = this.decodeFragment(fragment);

      if (this.fragment === decodedFragment) return;
      this.fragment = decodedFragment;

      // If pushState is available, we use it to set the fragment as a real URL.
      if (this._usePushState) {
        this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

      // If hash changes haven't been explicitly disabled, update the hash
      // fragment to store history.
      } else if (this._wantsHashChange) {
        this._updateHash(this.location, fragment, options.replace);
        if (this.iframe && fragment !== this.getHash(this.iframe.contentWindow)) {
          var iWindow = this.iframe.contentWindow;

          // Opening and closing the iframe tricks IE7 and earlier to push a
          // history entry on hash-tag change.  When replace is true, we don't
          // want this.
          if (!options.replace) {
            iWindow.document.open();
            iWindow.document.close();
          }

          this._updateHash(iWindow.location, fragment, options.replace);
        }

      // If you've told us that you explicitly don't want fallback hashchange-
      // based history, then `navigate` becomes a page refresh.
      } else {
        return this.location.assign(url);
      }
      if (options.trigger) return this.loadUrl(fragment);
    },

    // Update the hash location, either replacing the current entry, or adding
    // a new one to the browser history.
    _updateHash: function(location, fragment, replace) {
      if (replace) {
        var href = location.href.replace(/(javascript:|#).*$/, '');
        location.replace(href + '#' + fragment);
      } else {
        // Some browsers require that `hash` contains a leading #.
        location.hash = '#' + fragment;
      }
    }

  });

  // Create the default Backbone.history.
  Backbone.history = new History;

  /**
   * 辅助函数，调用时创建一个 Model/Collection 类
   * 基于 this(Modal/Collection 函数对象),创建了一个 child,并将属性都承载到child上,相当于创建了一个this的副本
   * @param {Object} protoProps 
   * @param {Object} staticProps 
   * @returns child
   */
  var extend = function(protoProps, staticProps) {
    var parent = this; // extend 作为对象属性，this 指向当前对象，即 Modal、Collection等
    var child; // 最后返回的子类，为一个函数，有本对象(Modal、Collection)的所有功能，但是不污染本对象

    // underscore.js  _.has(object, key) 判断object是否包含key,等同于 object.hasOwnProperty(key)，但是使用 hasOwnProperty 函数的一个安全引用，以防意外覆盖。
    // 子类构造函数初始化，判断参数protoProps是否包含constructor属性,有则为child的构造函数,无则把父类constructor属性的apply调用,此时未继承父类的原型
    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ return parent.apply(this, arguments); }; // 子类复制父类函数，将this指向自己,apply 也不继承原型
    }

    // 将父类中的静态属性复制为子类静态属性，最终使用 staticProps 覆盖
    _.extend(child, parent, staticProps); // 包含父类属性 Parent.xxx

    // 子类继承父类的原型链，类似于寄生式继承，若想访问父类原型，需使用 child.prototype
    // underscore：_.create()，作用类似Object.create，返回一个对象obj，参数1表示该对象obj的原型对象，参数2对象obj的键值对
    child.prototype = _.create(parent.prototype, protoProps); // child.prototype == protoProps && child.prototype.__proto__ == parent.prototype
    child.prototype.constructor = child; // 将子类的构造函数重新指回子类


    // 提供一个访问父类原型的方式
    // 如果子类设置了constructor属性, 而上述是使用create创的副本,将子类的__super__属性指向父类的构造函数, child.__super__.constructor == parent
    // 若要调用父类，直接 parent.__super__.constructor.call(this);
    child.__super__ = parent.prototype;

    // 将子类返回
    return child; // 也是闭包，即访问了父函数的 this(parent = Parent.this)
  };

  // 此处将 extends 赋值给MCV和Router和History中的extend
  Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

  // 内部函数

  /*****************************    内部函数 ***********************************************/
  // 外部不能访问及修改，用于内部抛出错误


  // 未指定url错误，当使用Model/Collection进行请求都没有获取到url时,抛出错误
  var urlError = function() {
    throw new Error('A "url" property or function must be specified');
  };

  // 参数1一般为Model、Collection,参数2为options,封装了options的error函数
  var wrapError = function(model, options) {
    var error = options.error; // 请求失败的函数
    options.error = function(resp) {
      if (error) error.call(options.context, model, resp, options); // 调用原有的error函数
      model.trigger('error', model, resp, options); // 触发error事件
    };
  };

  return Backbone;
});
