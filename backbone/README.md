描述：基本只需要看 backbone.js 文件，内容为一个 (Fun(fn){fn()})(fn)
库：需要掌握 underscore.js JQuery
js 知识：需要掌握模块化、原型链和继承、this 指向、MVC 模式
backbone 模块：Events 和 MVC 和 Router 和 history
代码顺序：初始化(31-90) -> Events(90-491) -> Model(493-940) -> Collection(940-1476) -> View(1478-1645)-> Model/Collection 的公共部分(1647-1827) -> Router(1828-1932) -> History(1934-2239)-> Backbone 辅助(2241-end)

- 前半部解析

```js
// Fun(fn){fn()}
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

})(fn)
```
